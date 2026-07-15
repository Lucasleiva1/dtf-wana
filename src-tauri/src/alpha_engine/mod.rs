use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

use crate::image_engine::document::{PixelBuffer, PixelDelta};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistogramBin {
    pub start: u16,
    pub end: u16,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlphaRegion {
    pub id: String,
    pub pixel_count: u64,
    pub min_x: u32,
    pub min_y: u32,
    pub max_x: u32,
    pub max_y: u32,
    pub center_x: f64,
    pub center_y: f64,
    pub min_alpha: u16,
    pub max_alpha: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlphaAnalysis {
    pub schema_version: &'static str,
    pub document_id: String,
    pub revision: u64,
    pub width: u32,
    pub height: u32,
    pub bit_depth: u8,
    pub max_alpha: u16,
    pub total_pixels: u64,
    pub transparent_pixels: u64,
    pub partial_alpha_pixels: u64,
    pub opaque_pixels: u64,
    pub partial_alpha_min: Option<u16>,
    pub partial_alpha_max: Option<u16>,
    pub partial_alpha_percent: f64,
    pub affected_regions: usize,
    pub verified_solid_alpha: bool,
    pub histogram: Vec<HistogramBin>,
    pub regions: Vec<AlphaRegion>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case", tag = "action")]
pub enum AlphaTreatment {
    MakeTransparent,
    MakeOpaque {
        #[serde(default = "default_radius")]
        reconstruct_radius: u32,
    },
    Threshold {
        threshold: u16,
        #[serde(default = "default_radius")]
        reconstruct_radius: u32,
    },
}

fn default_radius() -> u32 {
    8
}

impl AlphaTreatment {
    pub fn label(&self) -> &'static str {
        match self {
            Self::MakeTransparent => "Convertir alfa parcial en transparente",
            Self::MakeOpaque { .. } => "Convertir alfa parcial en opaco",
            Self::Threshold { .. } => "Aplicar umbral binario de alfa",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreatmentImpact {
    pub will_modify_pixels: u64,
    pub will_become_transparent: u64,
    pub will_become_opaque: u64,
    pub requires_confirmation: bool,
}

pub fn analyze(
    document_id: &str,
    revision: u64,
    width: u32,
    height: u32,
    buffer: &PixelBuffer,
) -> AlphaAnalysis {
    let bit_depth = buffer.bit_depth();
    let max_alpha = if bit_depth == 8 { 255 } else { 65535 };
    let histogram_exact = exact_histogram(buffer);
    let transparent_pixels = histogram_exact[0];
    let opaque_pixels = histogram_exact[max_alpha as usize];
    let total_pixels = buffer.len_pixels() as u64;
    let partial_alpha_pixels = total_pixels.saturating_sub(transparent_pixels + opaque_pixels);
    let partial_alpha_min = if partial_alpha_pixels == 0 {
        None
    } else {
        histogram_exact[1..max_alpha as usize]
            .iter()
            .position(|value| *value > 0)
            .map(|index| (index + 1) as u16)
    };
    let partial_alpha_max = if partial_alpha_pixels == 0 {
        None
    } else {
        histogram_exact[1..max_alpha as usize]
            .iter()
            .rposition(|value| *value > 0)
            .map(|index| (index + 1) as u16)
    };
    let regions = connected_regions(width, height, buffer, max_alpha);
    let histogram = grouped_histogram(&histogram_exact, bit_depth);
    AlphaAnalysis {
        schema_version: "1.0",
        document_id: document_id.into(),
        revision,
        width,
        height,
        bit_depth,
        max_alpha,
        total_pixels,
        transparent_pixels,
        partial_alpha_pixels,
        opaque_pixels,
        partial_alpha_min,
        partial_alpha_max,
        partial_alpha_percent: if total_pixels == 0 {
            0.0
        } else {
            partial_alpha_pixels as f64 * 100.0 / total_pixels as f64
        },
        affected_regions: regions.len(),
        verified_solid_alpha: partial_alpha_pixels == 0,
        histogram,
        regions,
    }
}

pub fn estimate_treatment(buffer: &PixelBuffer, treatment: &AlphaTreatment) -> TreatmentImpact {
    let max_alpha = if buffer.bit_depth() == 8 { 255 } else { 65535 };
    let mut transparent = 0u64;
    let mut opaque = 0u64;
    for index in 0..buffer.len_pixels() {
        let alpha = alpha_at(buffer, index);
        if alpha == 0 || alpha == max_alpha {
            continue;
        }
        match treatment {
            AlphaTreatment::MakeTransparent => transparent += 1,
            AlphaTreatment::MakeOpaque { .. } => opaque += 1,
            AlphaTreatment::Threshold { threshold, .. } => {
                if alpha < *threshold {
                    transparent += 1
                } else {
                    opaque += 1
                }
            }
        }
    }
    TreatmentImpact {
        will_modify_pixels: transparent + opaque,
        will_become_transparent: transparent,
        will_become_opaque: opaque,
        requires_confirmation: transparent + opaque > 0,
    }
}

pub fn apply_treatment(
    buffer: &mut PixelBuffer,
    width: u32,
    height: u32,
    treatment: &AlphaTreatment,
) -> PixelDelta {
    match buffer {
        PixelBuffer::Rgba8(pixels) => PixelDelta::Rgba8(apply_u8(pixels, width, height, treatment)),
        PixelBuffer::Rgba16(pixels) => {
            PixelDelta::Rgba16(apply_u16(pixels, width, height, treatment))
        }
    }
}

pub fn preview_rgba8(buffer: &PixelBuffer, mode: &str) -> Vec<u8> {
    match buffer {
        PixelBuffer::Rgba8(values) => preview_from_u8(values, mode),
        PixelBuffer::Rgba16(values) => {
            let downsampled: Vec<u8> = values.iter().map(|value| (value >> 8) as u8).collect();
            preview_from_u8(&downsampled, mode)
        }
    }
}

fn preview_from_u8(values: &[u8], mode: &str) -> Vec<u8> {
    let mut preview = values.to_vec();
    for pixel in preview.chunks_exact_mut(4) {
        let alpha = pixel[3];
        match mode {
            "partial_overlay" if alpha > 0 && alpha < 255 => {
                pixel.copy_from_slice(&[255, 57, 209, 255])
            }
            "alpha" => pixel.copy_from_slice(&[alpha, alpha, alpha, 255]),
            _ => {}
        }
    }
    preview
}

fn exact_histogram(buffer: &PixelBuffer) -> Vec<u64> {
    let size = if buffer.bit_depth() == 8 { 256 } else { 65536 };
    let mut histogram = vec![0u64; size];
    for index in 0..buffer.len_pixels() {
        histogram[alpha_at(buffer, index) as usize] += 1;
    }
    histogram
}

fn grouped_histogram(exact: &[u64], bit_depth: u8) -> Vec<HistogramBin> {
    if bit_depth == 8 {
        return exact
            .iter()
            .enumerate()
            .map(|(value, count)| HistogramBin {
                start: value as u16,
                end: value as u16,
                count: *count,
            })
            .collect();
    }
    exact
        .chunks(256)
        .enumerate()
        .map(|(index, chunk)| HistogramBin {
            start: (index * 256) as u16,
            end: (index * 256 + 255) as u16,
            count: chunk.iter().sum(),
        })
        .collect()
}

fn connected_regions(
    width: u32,
    height: u32,
    buffer: &PixelBuffer,
    max_alpha: u16,
) -> Vec<AlphaRegion> {
    let len = buffer.len_pixels();
    let mut visited = vec![false; len];
    let mut regions = Vec::new();
    let mut queue = VecDeque::new();
    for start in 0..len {
        let start_alpha = alpha_at(buffer, start);
        if visited[start] || start_alpha == 0 || start_alpha == max_alpha {
            continue;
        }
        visited[start] = true;
        queue.push_back(start);
        let mut count = 0u64;
        let mut sum_x = 0u64;
        let mut sum_y = 0u64;
        let mut min_x = width;
        let mut min_y = height;
        let mut max_x = 0u32;
        let mut max_y = 0u32;
        let mut min_alpha = max_alpha;
        let mut region_max_alpha = 0u16;
        while let Some(index) = queue.pop_front() {
            let x = (index as u32) % width;
            let y = (index as u32) / width;
            let alpha = alpha_at(buffer, index);
            count += 1;
            sum_x += x as u64;
            sum_y += y as u64;
            min_x = min_x.min(x);
            min_y = min_y.min(y);
            max_x = max_x.max(x);
            max_y = max_y.max(y);
            min_alpha = min_alpha.min(alpha);
            region_max_alpha = region_max_alpha.max(alpha);
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    if dx == 0 && dy == 0 {
                        continue;
                    }
                    let nx = x as i32 + dx;
                    let ny = y as i32 + dy;
                    if nx < 0 || ny < 0 || nx >= width as i32 || ny >= height as i32 {
                        continue;
                    }
                    let neighbor = ny as usize * width as usize + nx as usize;
                    if visited[neighbor] {
                        continue;
                    }
                    let neighbor_alpha = alpha_at(buffer, neighbor);
                    if neighbor_alpha > 0 && neighbor_alpha < max_alpha {
                        visited[neighbor] = true;
                        queue.push_back(neighbor);
                    }
                }
            }
        }
        regions.push(AlphaRegion {
            id: format!("alpha_region_{:05}", regions.len() + 1),
            pixel_count: count,
            min_x,
            min_y,
            max_x,
            max_y,
            center_x: sum_x as f64 / count as f64,
            center_y: sum_y as f64 / count as f64,
            min_alpha,
            max_alpha: region_max_alpha,
        });
    }
    regions
}

fn alpha_at(buffer: &PixelBuffer, index: usize) -> u16 {
    match buffer {
        PixelBuffer::Rgba8(values) => values[index * 4 + 3] as u16,
        PixelBuffer::Rgba16(values) => values[index * 4 + 3],
    }
}

fn target_alpha(alpha: u16, max: u16, treatment: &AlphaTreatment) -> Option<u16> {
    if alpha == 0 || alpha == max {
        return None;
    }
    Some(match treatment {
        AlphaTreatment::MakeTransparent => 0,
        AlphaTreatment::MakeOpaque { .. } => max,
        AlphaTreatment::Threshold { threshold, .. } => {
            if alpha < *threshold {
                0
            } else {
                max
            }
        }
    })
}

fn treatment_radius(treatment: &AlphaTreatment) -> u32 {
    match treatment {
        AlphaTreatment::MakeTransparent => 0,
        AlphaTreatment::MakeOpaque { reconstruct_radius }
        | AlphaTreatment::Threshold {
            reconstruct_radius, ..
        } => (*reconstruct_radius).min(64),
    }
}

fn apply_u8(
    pixels: &mut [u8],
    width: u32,
    height: u32,
    treatment: &AlphaTreatment,
) -> Vec<(usize, [u8; 4], [u8; 4])> {
    let source = pixels.to_vec();
    let radius = treatment_radius(treatment);
    let nearest_opaque =
        nearest_opaque_sources(width, height, radius, |index| source[index * 4 + 3] == 255);
    let mut changes = Vec::new();
    for index in 0..pixels.len() / 4 {
        let alpha = source[index * 4 + 3] as u16;
        let Some(target) = target_alpha(alpha, 255, treatment) else {
            continue;
        };
        let old: [u8; 4] = source[index * 4..index * 4 + 4].try_into().unwrap();
        let mut new = old;
        if target == 255 && radius > 0 {
            let source_index = nearest_opaque[index];
            if source_index != u32::MAX {
                let source_index = source_index as usize;
                new[..3].copy_from_slice(&source[source_index * 4..source_index * 4 + 3]);
            }
        }
        new[3] = target as u8;
        pixels[index * 4..index * 4 + 4].copy_from_slice(&new);
        changes.push((index, old, new));
    }
    changes
}

fn apply_u16(
    pixels: &mut [u16],
    width: u32,
    height: u32,
    treatment: &AlphaTreatment,
) -> Vec<(usize, [u16; 4], [u16; 4])> {
    let source = pixels.to_vec();
    let radius = treatment_radius(treatment);
    let nearest_opaque = nearest_opaque_sources(width, height, radius, |index| {
        source[index * 4 + 3] == 65535
    });
    let mut changes = Vec::new();
    for index in 0..pixels.len() / 4 {
        let alpha = source[index * 4 + 3];
        let Some(target) = target_alpha(alpha, 65535, treatment) else {
            continue;
        };
        let old: [u16; 4] = source[index * 4..index * 4 + 4].try_into().unwrap();
        let mut new = old;
        if target == 65535 && radius > 0 {
            let source_index = nearest_opaque[index];
            if source_index != u32::MAX {
                let source_index = source_index as usize;
                new[..3].copy_from_slice(&source[source_index * 4..source_index * 4 + 3]);
            }
        }
        new[3] = target;
        pixels[index * 4..index * 4 + 4].copy_from_slice(&new);
        changes.push((index, old, new));
    }
    changes
}

fn nearest_opaque_sources<F>(width: u32, height: u32, radius: u32, is_opaque: F) -> Vec<u32>
where
    F: Fn(usize) -> bool,
{
    let len = width as usize * height as usize;
    if radius == 0 || len == 0 {
        return Vec::new();
    }

    let mut nearest = vec![u32::MAX; len];
    let mut distance = vec![u8::MAX; len];
    for index in 0..len {
        if is_opaque(index) {
            nearest[index] = index as u32;
            distance[index] = 0;
        }
    }

    let width = width as usize;
    let height = height as usize;
    let radius = radius.min(u8::MAX as u32) as u8;
    for y in 0..height {
        for x in 0..width {
            let index = y * width + x;
            if distance[index] == 0 {
                continue;
            }
            if x > 0 {
                adopt_nearest(index, index - 1, radius, &mut distance, &mut nearest);
            }
            if y > 0 {
                adopt_nearest(index, index - width, radius, &mut distance, &mut nearest);
                if x > 0 {
                    adopt_nearest(
                        index,
                        index - width - 1,
                        radius,
                        &mut distance,
                        &mut nearest,
                    );
                }
                if x + 1 < width {
                    adopt_nearest(
                        index,
                        index - width + 1,
                        radius,
                        &mut distance,
                        &mut nearest,
                    );
                }
            }
        }
    }

    for y in (0..height).rev() {
        for x in (0..width).rev() {
            let index = y * width + x;
            if distance[index] == 0 {
                continue;
            }
            if x + 1 < width {
                adopt_nearest(index, index + 1, radius, &mut distance, &mut nearest);
            }
            if y + 1 < height {
                adopt_nearest(index, index + width, radius, &mut distance, &mut nearest);
                if x > 0 {
                    adopt_nearest(
                        index,
                        index + width - 1,
                        radius,
                        &mut distance,
                        &mut nearest,
                    );
                }
                if x + 1 < width {
                    adopt_nearest(
                        index,
                        index + width + 1,
                        radius,
                        &mut distance,
                        &mut nearest,
                    );
                }
            }
        }
    }
    nearest
}

fn adopt_nearest(
    index: usize,
    neighbor: usize,
    radius: u8,
    distance: &mut [u8],
    nearest: &mut [u32],
) {
    let candidate = distance[neighbor].saturating_add(1);
    if candidate <= radius && candidate < distance[index] {
        distance[index] = candidate;
        nearest[index] = nearest[neighbor];
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analyzes_every_u8_alpha_value_exactly() {
        let mut pixels = Vec::new();
        for alpha in 0u8..=255 {
            pixels.extend_from_slice(&[10, 20, 30, alpha]);
        }
        let analysis = analyze("fixture8", 0, 256, 1, &PixelBuffer::Rgba8(pixels));
        assert_eq!(analysis.transparent_pixels, 1);
        assert_eq!(analysis.partial_alpha_pixels, 254);
        assert_eq!(analysis.opaque_pixels, 1);
        assert_eq!(analysis.partial_alpha_min, Some(1));
        assert_eq!(analysis.partial_alpha_max, Some(254));
        assert_eq!(analysis.histogram.len(), 256);
        assert!(analysis.histogram.iter().all(|bin| bin.count == 1));
    }

    #[test]
    fn analyzes_u16_without_quantizing() {
        let values = [0u16, 1, 2, 32767, 32768, 65533, 65534, 65535];
        let mut pixels = Vec::new();
        for alpha in values {
            pixels.extend_from_slice(&[1000, 2000, 3000, alpha]);
        }
        let analysis = analyze("fixture16", 0, 8, 1, &PixelBuffer::Rgba16(pixels));
        assert_eq!(analysis.bit_depth, 16);
        assert_eq!(analysis.transparent_pixels, 1);
        assert_eq!(analysis.partial_alpha_pixels, 6);
        assert_eq!(analysis.opaque_pixels, 1);
        assert_eq!(analysis.partial_alpha_min, Some(1));
        assert_eq!(analysis.partial_alpha_max, Some(65534));
    }

    #[test]
    fn threshold_is_idempotent_and_leaves_zero_partial_alpha() {
        let mut buffer =
            PixelBuffer::Rgba8((0u8..=255).flat_map(|alpha| [10, 20, 30, alpha]).collect());
        let treatment = AlphaTreatment::Threshold {
            threshold: 128,
            reconstruct_radius: 2,
        };
        let first = apply_treatment(&mut buffer, 256, 1, &treatment);
        let second = apply_treatment(&mut buffer, 256, 1, &treatment);
        assert!(matches!(first, PixelDelta::Rgba8(changes) if changes.len() == 254));
        assert!(matches!(second, PixelDelta::Rgba8(changes) if changes.is_empty()));
        assert!(analyze("fixture", 1, 256, 1, &buffer).verified_solid_alpha);
    }

    #[test]
    fn detects_diagonally_connected_partial_pixels_as_one_region() {
        let mut pixels = vec![0u8; 3 * 3 * 4];
        for index in 0..9 {
            pixels[index * 4 + 3] = if index == 0 || index == 4 || index == 8 {
                128
            } else {
                0
            };
        }
        let analysis = analyze("regions", 0, 3, 3, &PixelBuffer::Rgba8(pixels));
        assert_eq!(analysis.affected_regions, 1);
        assert_eq!(analysis.regions[0].pixel_count, 3);
    }

    #[test]
    fn large_threshold_finishes_with_zero_partial_alpha() {
        let width = 1200u32;
        let height = 1000u32;
        let mut pixels = Vec::with_capacity(width as usize * height as usize * 4);
        for index in 0..width as usize * height as usize {
            let alpha = if index % 97 == 0 {
                255
            } else if index % 3 == 0 {
                64
            } else {
                192
            };
            pixels.extend_from_slice(&[40, 90, 150, alpha]);
        }
        let mut buffer = PixelBuffer::Rgba8(pixels);
        let treatment = AlphaTreatment::Threshold {
            threshold: 128,
            reconstruct_radius: 10,
        };
        let delta = apply_treatment(&mut buffer, width, height, &treatment);
        assert!(matches!(delta, PixelDelta::Rgba8(changes) if changes.len() > 1_000_000));
        assert!(analyze("large", 1, width, height, &buffer).verified_solid_alpha);
    }
}
