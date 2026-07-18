use std::{
    path::Path,
    sync::{atomic::{AtomicBool, Ordering}, OnceLock},
    time::Instant,
};

use image::{imageops::FilterType, ImageBuffer, Rgb, RgbImage};
use ort::{
    ep,
    session::{builder::GraphOptimizationLevel, Session},
    value::Tensor,
};
use rayon::prelude::*;

use crate::image_engine::document::PixelBuffer;

use super::types::InferenceDevice;

pub const MODEL_WIDTH: usize = 1024;
pub const MODEL_HEIGHT: usize = 1024;
pub const MODEL_SIZE_BYTES: u64 = 224_005_088;
pub const MODEL_SHA256: &str = "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333";
pub const ONNX_RUNTIME_SIZE_BYTES: u64 = 17_328_152;
pub const ONNX_PROVIDERS_SIZE_BYTES: u64 = 22_040;
pub const DIRECTML_SIZE_BYTES: u64 = 18_527_776;

const IMAGE_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const IMAGE_STD: [f32; 3] = [0.229, 0.224, 0.225];
static DIRECTML_DISABLED: AtomicBool = AtomicBool::new(false);

pub struct InferenceOutput {
    pub alpha: Vec<u16>,
    pub provider: String,
    pub elapsed_ms: u128,
}

pub fn run_birefnet(
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    model_path: &Path,
    device: InferenceDevice,
) -> Result<InferenceOutput, String> {
    if width == 0 || height == 0 {
        return Err("La imagen no tiene dimensiones válidas".into());
    }
    initialize_runtime(model_path)?;
    let started = Instant::now();
    let input = preprocess(pixels, width, height)?;
    let (logits, provider) = if device == InferenceDevice::Gpu
        && !DIRECTML_DISABLED.load(Ordering::Relaxed)
    {
        match run_model(model_path, &input, InferenceDevice::Gpu) {
            Ok(output) => output,
            Err(_) => {
                DIRECTML_DISABLED.store(true, Ordering::Relaxed);
                let (logits, _) = run_model(model_path, &input, InferenceDevice::Cpu)?;
                (logits, "CPU · retorno desde DirectML por memoria".into())
            }
        }
    } else {
        let (logits, provider) = run_model(model_path, &input, InferenceDevice::Cpu)?;
        let provider = if device == InferenceDevice::Gpu {
            "CPU · DirectML desactivado por memoria".into()
        } else {
            provider
        };
        (logits, provider)
    };
    let probabilities: Vec<f32> = logits.par_iter().map(|value| sigmoid(*value)).collect();
    let alpha = resize_mask_bilinear(
        &probabilities,
        MODEL_WIDTH,
        MODEL_HEIGHT,
        width as usize,
        height as usize,
    );
    Ok(InferenceOutput {
        alpha,
        provider,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

fn run_model(
    model_path: &Path,
    input: &[f32],
    device: InferenceDevice,
) -> Result<(Vec<f32>, String), String> {
    let (mut session, provider) = create_session(model_path, device)?;
    let tensor = Tensor::from_array((
        [1_usize, 3, MODEL_HEIGHT, MODEL_WIDTH],
        input.to_vec(),
    ))
    .map_err(|error| format!("No se pudo crear el tensor de BiRefNet Lite: {error}"))?;
    let outputs = session
        .run(ort::inputs![tensor])
        .map_err(|error| format!("Falló la inferencia BiRefNet Lite: {error}"))?;
    if outputs.len() == 0 {
        return Err("BiRefNet Lite no devolvió una máscara".into());
    }
    let output = outputs
        .get("output_image")
        .or_else(|| outputs.get("output"))
        .unwrap_or(&outputs[0]);
    let (shape, logits) = output
        .try_extract_tensor::<f32>()
        .map_err(|error| format!("La salida de BiRefNet Lite no es f32: {error}"))?;
    if logits.len() < MODEL_WIDTH * MODEL_HEIGHT {
        return Err(format!(
            "BiRefNet Lite devolvió una salida incompleta {shape:?}"
        ));
    }
    let offset = logits.len() - MODEL_WIDTH * MODEL_HEIGHT;
    Ok((logits[offset..].to_vec(), provider))
}

pub fn runtime_is_complete(model_path: &Path) -> bool {
    let Some(model_dir) = model_path.parent() else {
        return false;
    };
    let runtime_dir = model_dir.join("runtime");
    [
        ("onnxruntime.dll", ONNX_RUNTIME_SIZE_BYTES),
        ("onnxruntime_providers_shared.dll", ONNX_PROVIDERS_SIZE_BYTES),
        ("DirectML.dll", DIRECTML_SIZE_BYTES),
    ]
    .iter()
    .all(|(name, size)| {
        runtime_dir
            .join(name)
            .metadata()
            .map(|metadata| metadata.is_file() && metadata.len() == *size)
            .unwrap_or(false)
    })
}

fn initialize_runtime(model_path: &Path) -> Result<(), String> {
    static INITIALIZED: OnceLock<Result<(), String>> = OnceLock::new();
    INITIALIZED
        .get_or_init(|| {
            let model_dir = model_path
                .parent()
                .ok_or_else(|| "Ruta inválida para BiRefNet Lite".to_string())?;
            let runtime_dir = model_dir.join("runtime");
            if !runtime_is_complete(model_path) {
                return Err("ONNX Runtime está incompleto; faltan DLL oficiales".into());
            }
            ort::util::preload_dylib(runtime_dir.join("DirectML.dll"))
                .map_err(|error| format!("No se pudo cargar DirectML.dll: {error}"))?;
            ort::util::preload_dylib(runtime_dir.join("onnxruntime_providers_shared.dll"))
                .map_err(|error| format!("No se pudo cargar el proveedor compartido: {error}"))?;
            ort::init_from(runtime_dir.join("onnxruntime.dll"))
                .map_err(|error| format!("No se pudo cargar ONNX Runtime oficial: {error}"))?
                .commit();
            Ok(())
        })
        .clone()
}

fn create_session(model_path: &Path, device: InferenceDevice) -> Result<(Session, String), String> {
    if device == InferenceDevice::Gpu {
        let gpu = (|| {
            let mut builder = Session::builder()?
                .with_optimization_level(GraphOptimizationLevel::All)?
                .with_execution_providers([
                    ep::DirectML::default()
                        .with_performance_preference(
                            ep::directml::PerformancePreference::HighPerformance,
                        )
                        .build(),
                ])?;
            builder.commit_from_file(model_path)
        })();
        if let Ok(session) = gpu {
            return Ok((session, "GPU · DirectML".into()));
        }
    }
    let threads = std::thread::available_parallelism()
        .map(|count| count.get().clamp(1, 12))
        .unwrap_or(4);
    let mut builder = Session::builder()
        .map_err(|error| format!("No se pudo iniciar ONNX Runtime: {error}"))?
        .with_optimization_level(GraphOptimizationLevel::All)
        .map_err(|error| format!("No se pudo optimizar BiRefNet Lite: {error}"))?
        .with_intra_threads(threads)
        .map_err(|error| format!("No se pudo configurar ONNX Runtime: {error}"))?;
    let session = builder
        .commit_from_file(model_path)
        .map_err(|error| format!("No se pudo cargar BiRefNet Lite: {error}"))?;
    let provider = if device == InferenceDevice::Gpu {
        "CPU · retorno desde DirectML"
    } else {
        "CPU · ONNX Runtime"
    };
    Ok((session, provider.into()))
}

fn preprocess(pixels: &PixelBuffer, width: u32, height: u32) -> Result<Vec<f32>, String> {
    let source = rgb_image(pixels, width, height)?;
    let resized = image::imageops::resize(
        &source,
        MODEL_WIDTH as u32,
        MODEL_HEIGHT as u32,
        FilterType::Triangle,
    );
    let plane = MODEL_WIDTH * MODEL_HEIGHT;
    let mut input = vec![0.0_f32; plane * 3];
    for (index, pixel) in resized.pixels().enumerate() {
        for channel in 0..3 {
            let value = pixel[channel] as f32 / 255.0;
            input[channel * plane + index] = (value - IMAGE_MEAN[channel]) / IMAGE_STD[channel];
        }
    }
    Ok(input)
}

fn rgb_image(pixels: &PixelBuffer, width: u32, height: u32) -> Result<RgbImage, String> {
    let expected = width as usize * height as usize;
    let data: Vec<u8> = match pixels {
        PixelBuffer::Rgba8(values) => values
            .chunks_exact(4)
            .flat_map(|pixel| [pixel[0], pixel[1], pixel[2]])
            .collect(),
        PixelBuffer::Rgba16(values) => values
            .chunks_exact(4)
            .flat_map(|pixel| {
                [
                    (pixel[0] >> 8) as u8,
                    (pixel[1] >> 8) as u8,
                    (pixel[2] >> 8) as u8,
                ]
            })
            .collect(),
    };
    if data.len() != expected * 3 {
        return Err("El buffer de imagen no coincide con sus dimensiones".into());
    }
    ImageBuffer::<Rgb<u8>, Vec<u8>>::from_raw(width, height, data)
        .ok_or_else(|| "No se pudo preparar la imagen para BiRefNet Lite".into())
}

fn sigmoid(value: f32) -> f32 {
    if value >= 0.0 {
        1.0 / (1.0 + (-value).exp())
    } else {
        let exp = value.exp();
        exp / (1.0 + exp)
    }
}

fn resize_mask_bilinear(
    source: &[f32],
    source_width: usize,
    source_height: usize,
    target_width: usize,
    target_height: usize,
) -> Vec<u16> {
    let mut target = vec![0_u16; target_width.saturating_mul(target_height)];
    target.par_iter_mut().enumerate().for_each(|(index, value)| {
        let x = index % target_width;
        let y = index / target_width;
        let source_x = ((x as f32 + 0.5) * source_width as f32 / target_width as f32 - 0.5)
            .clamp(0.0, source_width.saturating_sub(1) as f32);
        let source_y = ((y as f32 + 0.5) * source_height as f32 / target_height as f32 - 0.5)
            .clamp(0.0, source_height.saturating_sub(1) as f32);
        let x0 = source_x.floor() as usize;
        let y0 = source_y.floor() as usize;
        let x1 = (x0 + 1).min(source_width - 1);
        let y1 = (y0 + 1).min(source_height - 1);
        let tx = source_x - x0 as f32;
        let ty = source_y - y0 as f32;
        let top = source[y0 * source_width + x0] * (1.0 - tx)
            + source[y0 * source_width + x1] * tx;
        let bottom = source[y1 * source_width + x0] * (1.0 - tx)
            + source[y1 * source_width + x1] * tx;
        let probability = (top * (1.0 - ty) + bottom * ty).clamp(0.0, 1.0);
        *value = (probability * u16::MAX as f32).round() as u16;
    });
    target
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sigmoid_is_stable_and_centered() {
        assert!((sigmoid(0.0) - 0.5).abs() < f32::EPSILON);
        assert!(sigmoid(30.0) > 0.999);
        assert!(sigmoid(-30.0) < 0.001);
    }

    #[test]
    fn bilinear_mask_preserves_corners_and_range() {
        let resized = resize_mask_bilinear(&[0.0, 1.0, 1.0, 0.0], 2, 2, 4, 4);
        assert_eq!(resized.len(), 16);
        assert_eq!(resized[0], 0);
        assert_eq!(resized[3], u16::MAX);
        assert_eq!(resized[12], u16::MAX);
        assert_eq!(resized[15], 0);
    }

    #[test]
    #[ignore = "requiere DTF_BIREFNET_MODEL y ejecuta una inferencia ONNX real"]
    fn installed_model_runs_end_to_end() {
        let model = std::env::var("DTF_BIREFNET_MODEL").expect("DTF_BIREFNET_MODEL");
        let device = match std::env::var("DTF_BIREFNET_DEVICE").as_deref() {
            Ok("cpu") => InferenceDevice::Cpu,
            _ => InferenceDevice::Gpu,
        };
        let mut pixels = vec![255_u8; 64 * 64 * 4];
        for y in 16..48 {
            for x in 16..48 {
                let offset = (y * 64 + x) * 4;
                pixels[offset..offset + 3].copy_from_slice(&[28, 62, 130]);
            }
        }
        let result = run_birefnet(
            &PixelBuffer::Rgba8(pixels),
            64,
            64,
            Path::new(&model),
            device,
        )
        .expect("inferencia BiRefNet Lite");
        assert_eq!(result.alpha.len(), 64 * 64);
        assert!(result.alpha.iter().any(|value| *value > 0));
        eprintln!("provider={} elapsed_ms={}", result.provider, result.elapsed_ms);
    }
}
