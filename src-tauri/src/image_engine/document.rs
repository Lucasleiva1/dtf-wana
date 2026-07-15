use std::{path::Path, sync::Arc};

use image::{ColorType, DynamicImage};
use serde::Serialize;

use crate::alpha_engine::{self, AlphaAnalysis, AlphaTreatment, TreatmentImpact};

#[derive(Clone)]
pub enum PixelBuffer {
    Rgba8(Vec<u8>),
    Rgba16(Vec<u16>),
}

impl PixelBuffer {
    pub fn bit_depth(&self) -> u8 {
        match self {
            Self::Rgba8(_) => 8,
            Self::Rgba16(_) => 16,
        }
    }

    pub fn len_pixels(&self) -> usize {
        match self {
            Self::Rgba8(values) => values.len() / 4,
            Self::Rgba16(values) => values.len() / 4,
        }
    }
}

#[derive(Clone)]
pub enum PixelDelta {
    Rgba8(Vec<(usize, [u8; 4], [u8; 4])>),
    Rgba16(Vec<(usize, [u16; 4], [u16; 4])>),
}

#[derive(Clone)]
pub struct HistoryEntry {
    pub label: String,
    pub delta: PixelDelta,
}

pub struct ImageDocument {
    pub id: String,
    pub name: String,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub source_bytes: Arc<Vec<u8>>,
    pub original: PixelBuffer,
    pub working: PixelBuffer,
    pub revision: u64,
    pub analysis: Option<AlphaAnalysis>,
    pub history: Vec<HistoryEntry>,
    pub future: Vec<HistoryEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedDocument {
    pub document_id: String,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub revision: u64,
    pub source_byte_length: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreatmentResult {
    pub revision: u64,
    pub impact: TreatmentImpact,
    pub analysis: AlphaAnalysis,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportVerification {
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub dpi: u32,
    pub file_size_bytes: u64,
    pub partial_alpha_pixels: u64,
    pub verified_solid_alpha: bool,
    pub reopened_and_verified: bool,
}

impl ImageDocument {
    pub fn decode(
        id: String,
        name: String,
        bytes: Vec<u8>,
    ) -> Result<(Self, ImportedDocument), String> {
        let image_format = image::guess_format(&bytes)
            .map_err(|error| format!("No se pudo identificar el formato: {error}"))?;
        let decoded = image::load_from_memory_with_format(&bytes, image_format)
            .map_err(|error| format!("No se pudo decodificar la imagen: {error}"))?;
        let width = decoded.width();
        let height = decoded.height();
        let is_sixteen = matches!(
            decoded.color(),
            ColorType::L16 | ColorType::La16 | ColorType::Rgb16 | ColorType::Rgba16
        );
        let pixels = if is_sixteen {
            PixelBuffer::Rgba16(to_rgba16(decoded))
        } else {
            PixelBuffer::Rgba8(decoded.to_rgba8().into_raw())
        };
        let format = format!("{image_format:?}").to_uppercase();
        let imported = ImportedDocument {
            document_id: id.clone(),
            format: format.clone(),
            width,
            height,
            bit_depth: pixels.bit_depth(),
            revision: 0,
            source_byte_length: bytes.len(),
        };
        Ok((
            Self {
                id,
                name,
                format,
                width,
                height,
                source_bytes: Arc::new(bytes),
                original: pixels.clone(),
                working: pixels,
                revision: 0,
                analysis: None,
                history: Vec::new(),
                future: Vec::new(),
            },
            imported,
        ))
    }

    pub fn analyze(&mut self) -> AlphaAnalysis {
        let analysis = alpha_engine::analyze(
            &self.id,
            self.revision,
            self.width,
            self.height,
            &self.working,
        );
        self.analysis = Some(analysis.clone());
        analysis
    }

    pub fn treatment_impact(&self, treatment: &AlphaTreatment) -> TreatmentImpact {
        alpha_engine::estimate_treatment(&self.working, treatment)
    }

    pub fn apply_treatment(&mut self, treatment: &AlphaTreatment) -> TreatmentResult {
        let impact = self.treatment_impact(treatment);
        let delta =
            alpha_engine::apply_treatment(&mut self.working, self.width, self.height, treatment);
        self.revision += 1;
        self.history.push(HistoryEntry {
            label: treatment.label().into(),
            delta,
        });
        self.future.clear();
        let analysis = self.analyze();
        TreatmentResult {
            revision: self.revision,
            impact,
            analysis,
        }
    }

    pub fn undo(&mut self) -> bool {
        let Some(entry) = self.history.pop() else {
            return false;
        };
        apply_delta(&mut self.working, &entry.delta, false);
        self.revision += 1;
        self.future.push(entry);
        self.analysis = None;
        true
    }

    pub fn redo(&mut self) -> bool {
        let Some(entry) = self.future.pop() else {
            return false;
        };
        apply_delta(&mut self.working, &entry.delta, true);
        self.revision += 1;
        self.history.push(entry);
        self.analysis = None;
        true
    }

    pub fn preview_png(&self, mode: &str) -> Result<Vec<u8>, String> {
        let rgba = alpha_engine::preview_rgba8(
            if mode == "original" {
                &self.original
            } else {
                &self.working
            },
            mode,
        );
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, self.width, self.height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            encoder.set_compression(png::Compression::Fastest);
            let mut writer = encoder.write_header().map_err(|error| error.to_string())?;
            writer
                .write_image_data(&rgba)
                .map_err(|error| error.to_string())?;
        }
        Ok(bytes)
    }

    pub fn export_verified(
        &self,
        path: &Path,
        require_solid_alpha: bool,
        dpi: u32,
    ) -> Result<ExportVerification, String> {
        let before = alpha_engine::analyze(
            &self.id,
            self.revision,
            self.width,
            self.height,
            &self.working,
        );
        if require_solid_alpha && !before.verified_solid_alpha {
            return Err(format!(
                "EXPORT_BLOCKED_PARTIAL_ALPHA: quedan {} píxeles semitransparentes",
                before.partial_alpha_pixels
            ));
        }
        let encoded = self.encode_png(dpi)?;
        std::fs::write(path, &encoded)
            .map_err(|error| format!("No se pudo guardar el PNG: {error}"))?;
        let reopened = std::fs::read(path)
            .map_err(|error| format!("No se pudo reabrir el PNG exportado: {error}"))?;
        let (mut verification_document, imported) =
            ImageDocument::decode("export_verification".into(), "export.png".into(), reopened)?;
        let verification = verification_document.analyze();
        if imported.width != self.width || imported.height != self.height {
            return Err("EXPORT_DIMENSIONS_MISMATCH: las dimensiones cambiaron al exportar".into());
        }
        if imported.bit_depth != self.working.bit_depth() {
            return Err("EXPORT_DEPTH_MISMATCH: la profundidad cambió al exportar".into());
        }
        if require_solid_alpha && !verification.verified_solid_alpha {
            return Err(format!(
                "EXPORT_VERIFICATION_FAILED: se reabrió con {} píxeles semitransparentes",
                verification.partial_alpha_pixels
            ));
        }
        Ok(ExportVerification {
            path: path.to_string_lossy().into_owned(),
            width: imported.width,
            height: imported.height,
            bit_depth: imported.bit_depth,
            dpi,
            file_size_bytes: encoded.len() as u64,
            partial_alpha_pixels: verification.partial_alpha_pixels,
            verified_solid_alpha: verification.verified_solid_alpha,
            reopened_and_verified: true,
        })
    }

    fn encode_png(&self, dpi: u32) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, self.width, self.height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(if self.working.bit_depth() == 16 {
                png::BitDepth::Sixteen
            } else {
                png::BitDepth::Eight
            });
            let pixels_per_meter = ((dpi.max(1) as f64) / 0.0254).round() as u32;
            encoder.set_pixel_dims(Some(png::PixelDimensions {
                xppu: pixels_per_meter,
                yppu: pixels_per_meter,
                unit: png::Unit::Meter,
            }));
            encoder.set_source_srgb(png::SrgbRenderingIntent::Perceptual);
            let mut writer = encoder.write_header().map_err(|error| error.to_string())?;
            match &self.working {
                PixelBuffer::Rgba8(pixels) => writer
                    .write_image_data(pixels)
                    .map_err(|error| error.to_string())?,
                PixelBuffer::Rgba16(pixels) => {
                    let encoded_pixels: Vec<u8> = pixels
                        .iter()
                        .flat_map(|value| value.to_be_bytes())
                        .collect();
                    writer
                        .write_image_data(&encoded_pixels)
                        .map_err(|error| error.to_string())?;
                }
            }
        }
        Ok(bytes)
    }
}

fn to_rgba16(image: DynamicImage) -> Vec<u16> {
    image.to_rgba16().into_raw()
}

fn apply_delta(buffer: &mut PixelBuffer, delta: &PixelDelta, forward: bool) {
    match (buffer, delta) {
        (PixelBuffer::Rgba8(pixels), PixelDelta::Rgba8(changes)) => {
            for (index, old, new) in changes {
                let value = if forward { new } else { old };
                pixels[*index * 4..*index * 4 + 4].copy_from_slice(value);
            }
        }
        (PixelBuffer::Rgba16(pixels), PixelDelta::Rgba16(changes)) => {
            for (index, old, new) in changes {
                let value = if forward { new } else { old };
                pixels[*index * 4..*index * 4 + 4].copy_from_slice(value);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn png8_all_alpha() -> Vec<u8> {
        let pixels: Vec<u8> = (0u8..=255).flat_map(|alpha| [11, 22, 33, alpha]).collect();
        encode_png(256, 1, png::BitDepth::Eight, &pixels)
    }

    fn png16_critical_alpha() -> Vec<u8> {
        let values = [0u16, 1, 2, 32767, 32768, 65533, 65534, 65535];
        let pixels: Vec<u8> = values
            .into_iter()
            .flat_map(|alpha| [1000u16, 2000, 3000, alpha])
            .flat_map(u16::to_be_bytes)
            .collect();
        encode_png(8, 1, png::BitDepth::Sixteen, &pixels)
    }

    fn encode_png(width: u32, height: u32, depth: png::BitDepth, pixels: &[u8]) -> Vec<u8> {
        let mut result = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut result, width, height);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(depth);
            let mut writer = encoder.write_header().unwrap();
            writer.write_image_data(pixels).unwrap();
        }
        result
    }

    #[test]
    fn decodes_real_png8_and_preserves_original_bytes() {
        let bytes = png8_all_alpha();
        let original = bytes.clone();
        let (mut document, imported) =
            ImageDocument::decode("doc8".into(), "fixture8.png".into(), bytes).unwrap();
        assert_eq!(imported.bit_depth, 8);
        assert_eq!(document.analyze().partial_alpha_pixels, 254);
        document.apply_treatment(&AlphaTreatment::Threshold {
            threshold: 128,
            reconstruct_radius: 2,
        });
        assert_eq!(document.source_bytes.as_slice(), original.as_slice());
        assert!(document.analysis.as_ref().unwrap().verified_solid_alpha);
    }

    #[test]
    fn decodes_real_png16_without_reducing_depth() {
        let (mut document, imported) = ImageDocument::decode(
            "doc16".into(),
            "fixture16.png".into(),
            png16_critical_alpha(),
        )
        .unwrap();
        assert_eq!(imported.bit_depth, 16);
        let analysis = document.analyze();
        assert_eq!(analysis.partial_alpha_pixels, 6);
        assert_eq!(analysis.partial_alpha_min, Some(1));
        assert_eq!(analysis.partial_alpha_max, Some(65534));
    }

    #[test]
    fn overlay_preview_marks_only_partial_alpha_magenta() {
        let (document, _) =
            ImageDocument::decode("preview".into(), "fixture.png".into(), png8_all_alpha())
                .unwrap();
        let overlay = crate::alpha_engine::preview_rgba8(&document.working, "partial_overlay");
        assert_eq!(&overlay[0..4], &[11, 22, 33, 0]);
        assert_eq!(&overlay[4..8], &[255, 57, 209, 255]);
        assert_eq!(&overlay[255 * 4..256 * 4], &[11, 22, 33, 255]);
    }

    #[test]
    fn exports_reopens_and_verifies_solid_alpha_without_touching_source() {
        let bytes = png8_all_alpha();
        let source = bytes.clone();
        let (mut document, _) =
            ImageDocument::decode("export".into(), "fixture.png".into(), bytes).unwrap();
        document.apply_treatment(&AlphaTreatment::Threshold {
            threshold: 128,
            reconstruct_radius: 2,
        });
        let path = std::env::temp_dir().join(format!("dtf-pro-export-{}.png", std::process::id()));
        let result = document.export_verified(&path, true, 300).unwrap();
        assert!(result.reopened_and_verified);
        assert!(result.verified_solid_alpha);
        assert_eq!(result.partial_alpha_pixels, 0);
        assert_eq!(result.dpi, 300);
        assert_eq!(document.source_bytes.as_slice(), source.as_slice());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn blocks_solid_export_when_partial_alpha_remains() {
        let (document, _) =
            ImageDocument::decode("blocked".into(), "fixture.png".into(), png8_all_alpha())
                .unwrap();
        let path = std::env::temp_dir().join(format!("dtf-pro-blocked-{}.png", std::process::id()));
        let error = document.export_verified(&path, true, 300).unwrap_err();
        assert!(error.starts_with("EXPORT_BLOCKED_PARTIAL_ALPHA"));
        assert!(!path.exists());
    }
}
