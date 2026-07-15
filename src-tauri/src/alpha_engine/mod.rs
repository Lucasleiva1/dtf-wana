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
#[serde(rename_all = "snake_case")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationPreset {
    pub name: &'static str,
    pub threshold: u16,
    pub description: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlphaRecommendation {
    pub recommended_threshold: u16,
    pub safe_min: u16,
    pub safe_max: u16,
    pub explanation: String,
    pub estimated_transparent: u64,
    pub estimated_opaque: u64,
    pub edge_affected_percent: f64,
    pub risk: RiskLevel,
    pub conservative: RecommendationPreset,
    pub balanced: RecommendationPreset,
    pub aggressive: RecommendationPreset,
    pub connected_edge_pixels: u64,
    pub fine_detail_pixels: u64,
    pub isolated_component_pixels: u64,
    pub recommended_radius: u32,
    pub contamination_risk: RiskLevel,
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
    pub recommendation: Option<AlphaRecommendation>,
}

pub type ProgressCallback<'a> = dyn FnMut(u8, &str, u64, u64) -> Result<(), String> + 'a;

#[derive(Debug, Clone, Deserialize)]
#[serde(
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    tag = "action"
)]
pub enum AlphaTreatment {
    MakeTransparent,
    MakeOpaque {
        #[serde(default = "default_radius")]
        reconstruct_radius: u32,
        #[serde(default)]
        reconstruction_mode: ReconstructionMode,
    },
    Threshold {
        threshold: u16,
        #[serde(default = "default_radius")]
        reconstruct_radius: u32,
        #[serde(default)]
        reconstruction_mode: ReconstructionMode,
        #[serde(default)]
        protections: ProtectionOptions,
    },
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReconstructionMode {
    #[default]
    Automatic,
    Manual,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProtectionOptions {
    pub protect_connected_texture: bool,
    pub protect_fine_lines: bool,
    pub protect_grunge: bool,
    pub only_isolated_particles: bool,
    pub preserved_region_ids: Vec<String>,
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
    pub protected_pixels: u64,
    pub pending_pixels: u64,
    pub edge_affected_percent: f64,
    pub reconstructed_pixels: u64,
    pub estimated_radius: u32,
    pub contamination_risk: RiskLevel,
}

#[derive(Debug, Clone)]
pub struct TreatmentPlan {
    decisions: Vec<u8>,
    pub impact: TreatmentImpact,
    pub effective_radius: u32,
}

const DECISION_UNCHANGED: u8 = 0;
const DECISION_TRANSPARENT: u8 = 1;
const DECISION_OPAQUE: u8 = 2;
const DECISION_PROTECTED_OPAQUE: u8 = 3;
const DECISION_PENDING: u8 = 4;

pub fn analyze(
    document_id: &str,
    revision: u64,
    width: u32,
    height: u32,
    buffer: &PixelBuffer,
) -> AlphaAnalysis {
    analyze_with_progress(
        document_id,
        revision,
        width,
        height,
        buffer,
        &mut |_, _, _, _| Ok(()),
    )
    .expect("el análisis sin cancelación no puede fallar")
}

pub fn analyze_with_progress(
    document_id: &str,
    revision: u64,
    width: u32,
    height: u32,
    buffer: &PixelBuffer,
    progress: &mut ProgressCallback<'_>,
) -> Result<AlphaAnalysis, String> {
    progress(1, "Leyendo imagen", 1, 1)?;
    let bit_depth = buffer.bit_depth();
    let max_alpha = if bit_depth == 8 { 255 } else { 65535 };
    let histogram_exact = exact_histogram_with_progress(buffer, width, height, progress)?;
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
    let regions = connected_regions_with_progress(width, height, buffer, max_alpha, progress)?;
    let recommendation = if partial_alpha_pixels == 0 {
        progress(4, "Calculando recomendación", 1, 1)?;
        None
    } else {
        Some(build_recommendation(
            width,
            height,
            buffer,
            max_alpha,
            &histogram_exact,
            &regions,
            progress,
        )?)
    };
    let histogram = grouped_histogram(&histogram_exact, bit_depth);
    Ok(AlphaAnalysis {
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
        recommendation,
    })
}

pub fn apply_treatment(
    buffer: &mut PixelBuffer,
    width: u32,
    height: u32,
    treatment: &AlphaTreatment,
) -> PixelDelta {
    let plan = plan_treatment(buffer, width, height, treatment);
    apply_treatment_plan(buffer, width, height, &plan, &mut |_, _, _, _| Ok(()))
        .expect("la aplicación sin cancelación no puede fallar")
}

pub fn plan_treatment(
    buffer: &PixelBuffer,
    width: u32,
    height: u32,
    treatment: &AlphaTreatment,
) -> TreatmentPlan {
    plan_treatment_with_progress(buffer, width, height, treatment, &mut |_, _, _, _| Ok(()))
        .expect("la planificación sin cancelación no puede fallar")
}

pub fn plan_treatment_with_progress(
    buffer: &PixelBuffer,
    width: u32,
    height: u32,
    treatment: &AlphaTreatment,
    progress: &mut ProgressCallback<'_>,
) -> Result<TreatmentPlan, String> {
    let max_alpha = if buffer.bit_depth() == 8 { 255 } else { 65535 };
    let len = buffer.len_pixels();
    let mut decisions = vec![DECISION_UNCHANGED; len];
    let mut visited = vec![false; len];
    let width_usize = width as usize;
    let mut queue = VecDeque::new();
    let mut component = Vec::new();
    let protections = match treatment {
        AlphaTreatment::Threshold { protections, .. } => Some(protections),
        _ => None,
    };

    for index in 0..len {
        let alpha = alpha_at(buffer, index);
        if alpha > 0 && alpha < max_alpha {
            decisions[index] = match treatment {
                AlphaTreatment::MakeTransparent => DECISION_TRANSPARENT,
                AlphaTreatment::MakeOpaque { .. } => DECISION_OPAQUE,
                AlphaTreatment::Threshold { threshold, .. } => {
                    if alpha < *threshold {
                        DECISION_TRANSPARENT
                    } else {
                        DECISION_OPAQUE
                    }
                }
            };
        }
        if index % 65_536 == 0 {
            progress(1, "Calculando impacto", index as u64, len as u64)?;
        }
    }

    if let Some(protections) = protections {
        let mut region_number = 0usize;
        for start in 0..len {
            let alpha = alpha_at(buffer, start);
            if visited[start] || alpha == 0 || alpha == max_alpha {
                continue;
            }
            region_number += 1;
            visited[start] = true;
            queue.push_back(start);
            component.clear();
            let mut min_x = width;
            let mut min_y = height;
            let mut max_x = 0u32;
            let mut max_y = 0u32;
            let mut touches_opaque = false;
            while let Some(index) = queue.pop_front() {
                component.push(index);
                let x = index % width_usize;
                let y = index / width_usize;
                min_x = min_x.min(x as u32);
                min_y = min_y.min(y as u32);
                max_x = max_x.max(x as u32);
                max_y = max_y.max(y as u32);
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
                        let neighbor = ny as usize * width_usize + nx as usize;
                        let neighbor_alpha = alpha_at(buffer, neighbor);
                        if neighbor_alpha == max_alpha {
                            touches_opaque = true;
                        } else if neighbor_alpha > 0 && !visited[neighbor] {
                            visited[neighbor] = true;
                            queue.push_back(neighbor);
                        }
                    }
                }
            }

            let region_id = format!("alpha_region_{region_number:05}");
            let component_width = max_x - min_x + 1;
            let component_height = max_y - min_y + 1;
            let thin = component_width <= 4 || component_height <= 4 || component.len() <= 16;
            let area = component_width as usize * component_height as usize;
            let grunge = component.len() <= 256 && area > component.len().saturating_mul(2);
            let isolated = !touches_opaque && component.len() <= 64;
            let manual = protections
                .preserved_region_ids
                .iter()
                .any(|id| id == &region_id);

            for &index in &component {
                if protections.only_isolated_particles && !isolated {
                    decisions[index] = DECISION_PENDING;
                    continue;
                }
                if decisions[index] != DECISION_TRANSPARENT {
                    continue;
                }
                let x = index % width_usize;
                let y = index / width_usize;
                let locally_connected = has_opaque_neighbor(buffer, width, height, x, y, max_alpha);
                if manual
                    || (protections.protect_connected_texture && locally_connected)
                    || (protections.protect_fine_lines && thin)
                    || (protections.protect_grunge && grunge)
                {
                    decisions[index] = DECISION_PROTECTED_OPAQUE;
                }
            }
            if start % 65_536 == 0 || region_number % 128 == 0 {
                progress(2, "Protegiendo detalles", start as u64, len as u64)?;
            }
        }
    }
    progress(2, "Protegiendo detalles", len as u64, len as u64)?;

    let transparent = decisions
        .iter()
        .filter(|decision| **decision == DECISION_TRANSPARENT)
        .count() as u64;
    let opaque = decisions
        .iter()
        .filter(|decision| matches!(**decision, DECISION_OPAQUE | DECISION_PROTECTED_OPAQUE))
        .count() as u64;
    let protected = decisions
        .iter()
        .filter(|decision| **decision == DECISION_PROTECTED_OPAQUE)
        .count() as u64;
    let pending = decisions
        .iter()
        .filter(|decision| **decision == DECISION_PENDING)
        .count() as u64;
    let effective_radius = treatment_radius_for_image(treatment, width, height);
    let existing_opaque = (0..len)
        .filter(|index| alpha_at(buffer, *index) == max_alpha)
        .count() as u64;
    let contamination_risk = if existing_opaque < opaque / 4 {
        RiskLevel::High
    } else if existing_opaque < opaque {
        RiskLevel::Medium
    } else {
        RiskLevel::Low
    };
    let edge_affected_percent = if transparent + protected == 0 {
        0.0
    } else {
        transparent as f64 * 100.0 / (transparent + protected) as f64
    };

    Ok(TreatmentPlan {
        decisions,
        effective_radius,
        impact: TreatmentImpact {
            will_modify_pixels: transparent + opaque,
            will_become_transparent: transparent,
            will_become_opaque: opaque,
            requires_confirmation: transparent + opaque > 0,
            protected_pixels: protected,
            pending_pixels: pending,
            edge_affected_percent,
            reconstructed_pixels: opaque,
            estimated_radius: effective_radius,
            contamination_risk,
        },
    })
}

pub fn apply_treatment_plan(
    buffer: &mut PixelBuffer,
    width: u32,
    height: u32,
    plan: &TreatmentPlan,
    progress: &mut ProgressCallback<'_>,
) -> Result<PixelDelta, String> {
    match buffer {
        PixelBuffer::Rgba8(pixels) => {
            apply_u8(pixels, width, height, plan, progress).map(PixelDelta::Rgba8)
        }
        PixelBuffer::Rgba16(pixels) => {
            apply_u16(pixels, width, height, plan, progress).map(PixelDelta::Rgba16)
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

pub fn treatment_preview_rgba8(buffer: &PixelBuffer, plan: &TreatmentPlan) -> Vec<u8> {
    let mut preview = match buffer {
        PixelBuffer::Rgba8(values) => values.clone(),
        PixelBuffer::Rgba16(values) => values.iter().map(|value| (value >> 8) as u8).collect(),
    };
    for (index, pixel) in preview.chunks_exact_mut(4).enumerate() {
        match plan.decisions[index] {
            DECISION_TRANSPARENT => pixel.copy_from_slice(&[255, 45, 45, 255]),
            DECISION_OPAQUE => pixel.copy_from_slice(&[0, 220, 255, 255]),
            DECISION_PROTECTED_OPAQUE | DECISION_PENDING => {
                pixel.copy_from_slice(&[255, 57, 209, 255])
            }
            _ => {}
        }
    }
    preview
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

fn exact_histogram_with_progress(
    buffer: &PixelBuffer,
    width: u32,
    height: u32,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<u64>, String> {
    let size = if buffer.bit_depth() == 8 { 256 } else { 65536 };
    let mut histogram = vec![0u64; size];
    let width = width as usize;
    for y in 0..height as usize {
        let start = y * width;
        let end = ((y + 1) * width).min(buffer.len_pixels());
        for index in start..end {
            histogram[alpha_at(buffer, index) as usize] += 1;
        }
        if y % 16 == 0 || y + 1 == height as usize {
            progress(2, "Analizando canal alfa", (y + 1) as u64, height as u64)?;
        }
    }
    Ok(histogram)
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

fn connected_regions_with_progress(
    width: u32,
    height: u32,
    buffer: &PixelBuffer,
    max_alpha: u16,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<AlphaRegion>, String> {
    let len = buffer.len_pixels();
    let mut visited = vec![false; len];
    let mut regions = Vec::new();
    let mut queue = VecDeque::new();
    let mut grouped_partial = 0usize;
    for start in 0..len {
        if start % 65_536 == 0 {
            progress(
                3,
                "Agrupando regiones",
                start.max(grouped_partial) as u64,
                len as u64,
            )?;
        }
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
            grouped_partial += 1;
            if grouped_partial % 65_536 == 0 {
                progress(
                    3,
                    "Agrupando regiones",
                    start.max(grouped_partial) as u64,
                    len as u64,
                )?;
            }
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
    progress(3, "Agrupando regiones", len as u64, len as u64)?;
    Ok(regions)
}

fn build_recommendation(
    width: u32,
    height: u32,
    buffer: &PixelBuffer,
    max_alpha: u16,
    histogram: &[u64],
    regions: &[AlphaRegion],
    progress: &mut ProgressCallback<'_>,
) -> Result<AlphaRecommendation, String> {
    let partial_total: u64 = histogram[1..max_alpha as usize].iter().sum();
    let mut total_weight = 0u64;
    let mut weighted_sum = 0f64;
    for (alpha, count) in histogram
        .iter()
        .enumerate()
        .take(max_alpha as usize)
        .skip(1)
    {
        total_weight += *count;
        weighted_sum += alpha as f64 * *count as f64;
    }
    let mut background_weight = 0u64;
    let mut background_sum = 0f64;
    let mut best_variance = -1.0f64;
    let mut otsu = max_alpha / 2;
    for alpha in 1..max_alpha as usize {
        let count = histogram[alpha];
        background_weight += count;
        if background_weight == 0 || background_weight == total_weight {
            continue;
        }
        background_sum += alpha as f64 * count as f64;
        let foreground_weight = total_weight - background_weight;
        let mean_background = background_sum / background_weight as f64;
        let mean_foreground = (weighted_sum - background_sum) / foreground_weight as f64;
        let variance = background_weight as f64
            * foreground_weight as f64
            * (mean_background - mean_foreground).powi(2);
        if variance > best_variance {
            best_variance = variance;
            otsu = alpha as u16;
        }
    }

    let scale = (width.max(height) as f64 / 2048.0).clamp(0.5, 2.0);
    let fine_limit = (4.0 * scale).round().max(2.0) as u32;
    let fine_detail_pixels: u64 = regions
        .iter()
        .filter(|region| {
            let region_width = region.max_x - region.min_x + 1;
            let region_height = region.max_y - region.min_y + 1;
            region_width <= fine_limit || region_height <= fine_limit || region.pixel_count <= 16
        })
        .map(|region| region.pixel_count)
        .sum();
    let isolated_component_pixels: u64 = regions
        .iter()
        .filter(|region| region.pixel_count <= 32)
        .map(|region| region.pixel_count)
        .sum();

    let mut connected_edge_pixels = 0u64;
    let mut edge_removed = 0u64;
    let width_usize = width as usize;
    for y in 0..height as usize {
        for x in 0..width_usize {
            let index = y * width_usize + x;
            let alpha = alpha_at(buffer, index);
            if alpha == 0 || alpha == max_alpha {
                continue;
            }
            let min_x = x.saturating_sub(1);
            let max_x = (x + 1).min(width_usize - 1);
            let min_y = y.saturating_sub(1);
            let max_y = (y + 1).min(height as usize - 1);
            let connected = (min_y..=max_y).any(|ny| {
                (min_x..=max_x).any(|nx| alpha_at(buffer, ny * width_usize + nx) == max_alpha)
            });
            if connected {
                connected_edge_pixels += 1;
                if alpha < otsu {
                    edge_removed += 1;
                }
            }
        }
        if y % 16 == 0 || y + 1 == height as usize {
            progress(4, "Calculando recomendación", (y + 1) as u64, height as u64)?;
        }
    }

    let fine_ratio = if partial_total == 0 {
        0.0
    } else {
        fine_detail_pixels as f64 / partial_total as f64
    };
    let edge_ratio = if connected_edge_pixels == 0 {
        0.0
    } else {
        edge_removed as f64 / connected_edge_pixels as f64
    };
    let protection_shift =
        ((fine_ratio * 0.12 + edge_ratio * 0.08) * max_alpha as f64).round() as u16;
    let minimum = (max_alpha as f64 * 0.12).round() as u16;
    let maximum = (max_alpha as f64 * 0.88).round() as u16;
    let recommended = otsu
        .saturating_sub(protection_shift)
        .clamp(minimum, maximum);
    let safe_span =
        (max_alpha as f64 * if fine_ratio > 0.12 { 0.045 } else { 0.075 }).round() as u16;
    let safe_min = recommended.saturating_sub(safe_span).max(1);
    let safe_max = recommended.saturating_add(safe_span).min(max_alpha - 1);
    let preset_span = (max_alpha as f64 * 0.12).round() as u16;
    let conservative = recommended.saturating_sub(preset_span).max(1);
    let aggressive = recommended.saturating_add(preset_span).min(max_alpha - 1);
    let estimated_transparent: u64 = histogram[1..recommended as usize].iter().sum();
    let estimated_opaque = partial_total.saturating_sub(estimated_transparent);
    let edge_affected_percent = edge_ratio * 100.0;
    let risk = if fine_ratio > 0.18 || edge_affected_percent > 38.0 {
        RiskLevel::High
    } else if fine_ratio > 0.06 || edge_affected_percent > 16.0 {
        RiskLevel::Medium
    } else {
        RiskLevel::Low
    };
    let contamination_risk = if histogram[max_alpha as usize] < connected_edge_pixels / 3 {
        RiskLevel::High
    } else if histogram[max_alpha as usize] < connected_edge_pixels {
        RiskLevel::Medium
    } else {
        RiskLevel::Low
    };
    let recommended_radius = ((width.max(height) as f64 / 2048.0) * 2.0)
        .round()
        .clamp(1.0, 4.0) as u32;
    let explanation = format!(
        "Se buscó el valle del histograma y se ajustó para conservar {} píxeles de detalle fino y {} píxeles conectados al borde.",
        fine_detail_pixels, connected_edge_pixels
    );

    Ok(AlphaRecommendation {
        recommended_threshold: recommended,
        safe_min,
        safe_max,
        explanation,
        estimated_transparent,
        estimated_opaque,
        edge_affected_percent,
        risk,
        conservative: RecommendationPreset {
            name: "Conservador",
            threshold: conservative,
            description: "Conserva más textura y líneas finas.",
        },
        balanced: RecommendationPreset {
            name: "Equilibrado",
            threshold: recommended,
            description: "Balance recomendado entre limpieza y detalle.",
        },
        aggressive: RecommendationPreset {
            name: "Agresivo",
            threshold: aggressive,
            description: "Elimina más borde tenue y partículas.",
        },
        connected_edge_pixels,
        fine_detail_pixels,
        isolated_component_pixels,
        recommended_radius,
        contamination_risk,
    })
}

fn alpha_at(buffer: &PixelBuffer, index: usize) -> u16 {
    match buffer {
        PixelBuffer::Rgba8(values) => values[index * 4 + 3] as u16,
        PixelBuffer::Rgba16(values) => values[index * 4 + 3],
    }
}

fn treatment_radius_for_image(treatment: &AlphaTreatment, width: u32, height: u32) -> u32 {
    match treatment {
        AlphaTreatment::MakeTransparent => 0,
        AlphaTreatment::MakeOpaque {
            reconstruct_radius,
            reconstruction_mode,
        }
        | AlphaTreatment::Threshold {
            reconstruct_radius,
            reconstruction_mode,
            ..
        } => match reconstruction_mode {
            ReconstructionMode::Automatic => ((width.max(height) as f64 / 2048.0) * 2.0)
                .round()
                .clamp(1.0, 4.0) as u32,
            ReconstructionMode::Manual => (*reconstruct_radius).clamp(1, 16),
        },
    }
}

fn has_opaque_neighbor(
    buffer: &PixelBuffer,
    width: u32,
    height: u32,
    x: usize,
    y: usize,
    max_alpha: u16,
) -> bool {
    let width = width as usize;
    let height = height as usize;
    let min_x = x.saturating_sub(1);
    let max_x = (x + 1).min(width - 1);
    let min_y = y.saturating_sub(1);
    let max_y = (y + 1).min(height - 1);
    (min_y..=max_y)
        .any(|ny| (min_x..=max_x).any(|nx| alpha_at(buffer, ny * width + nx) == max_alpha))
}

fn apply_u8(
    pixels: &mut [u8],
    width: u32,
    height: u32,
    plan: &TreatmentPlan,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<(usize, [u8; 4], [u8; 4])>, String> {
    let source = pixels.to_vec();
    let radius = plan.effective_radius;
    let nearest_opaque = nearest_opaque_sources(
        width,
        height,
        radius,
        |index| source[index * 4 + 3] == 255,
        progress,
    )?;
    let mut changes = Vec::new();
    for index in 0..pixels.len() / 4 {
        let target = match plan.decisions[index] {
            DECISION_TRANSPARENT => 0,
            DECISION_OPAQUE | DECISION_PROTECTED_OPAQUE => 255,
            _ => continue,
        };
        let old: [u8; 4] = source[index * 4..index * 4 + 4].try_into().unwrap();
        let mut new = old;
        if target == 255 && radius > 0 {
            let source_index = nearest_opaque[index];
            if source_index != u32::MAX {
                let source_index = source_index as usize;
                let interior = &source[source_index * 4..source_index * 4 + 3];
                if trusted_interior_u8(&old[..3], interior) {
                    new[..3].copy_from_slice(interior);
                }
            }
        }
        new[3] = target as u8;
        pixels[index * 4..index * 4 + 4].copy_from_slice(&new);
        changes.push((index, old, new));
        if index % (width as usize * 16).max(1) == 0 {
            progress(
                4,
                "Aplicando tratamiento",
                index as u64,
                plan.decisions.len() as u64,
            )?;
        }
    }
    progress(
        4,
        "Aplicando tratamiento",
        plan.decisions.len() as u64,
        plan.decisions.len() as u64,
    )?;
    Ok(changes)
}

fn apply_u16(
    pixels: &mut [u16],
    width: u32,
    height: u32,
    plan: &TreatmentPlan,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<(usize, [u16; 4], [u16; 4])>, String> {
    let source = pixels.to_vec();
    let radius = plan.effective_radius;
    let nearest_opaque = nearest_opaque_sources(
        width,
        height,
        radius,
        |index| source[index * 4 + 3] == 65535,
        progress,
    )?;
    let mut changes = Vec::new();
    for index in 0..pixels.len() / 4 {
        let target = match plan.decisions[index] {
            DECISION_TRANSPARENT => 0,
            DECISION_OPAQUE | DECISION_PROTECTED_OPAQUE => 65535,
            _ => continue,
        };
        let old: [u16; 4] = source[index * 4..index * 4 + 4].try_into().unwrap();
        let mut new = old;
        if target == 65535 && radius > 0 {
            let source_index = nearest_opaque[index];
            if source_index != u32::MAX {
                let source_index = source_index as usize;
                let interior = &source[source_index * 4..source_index * 4 + 3];
                if trusted_interior_u16(&old[..3], interior) {
                    new[..3].copy_from_slice(interior);
                }
            }
        }
        new[3] = target;
        pixels[index * 4..index * 4 + 4].copy_from_slice(&new);
        changes.push((index, old, new));
        if index % (width as usize * 16).max(1) == 0 {
            progress(
                4,
                "Aplicando tratamiento",
                index as u64,
                plan.decisions.len() as u64,
            )?;
        }
    }
    progress(
        4,
        "Aplicando tratamiento",
        plan.decisions.len() as u64,
        plan.decisions.len() as u64,
    )?;
    Ok(changes)
}

fn trusted_interior_u8(edge: &[u8], interior: &[u8]) -> bool {
    edge.iter()
        .zip(interior)
        .map(|(a, b)| (*a as i32 - *b as i32).pow(2) as u32)
        .sum::<u32>()
        <= 3 * 96 * 96
}

fn trusted_interior_u16(edge: &[u16], interior: &[u16]) -> bool {
    let limit = 96u64 * 257;
    edge.iter()
        .zip(interior)
        .map(|(a, b)| (*a as i64 - *b as i64).pow(2) as u64)
        .sum::<u64>()
        <= 3 * limit * limit
}

fn nearest_opaque_sources<F>(
    width: u32,
    height: u32,
    radius: u32,
    is_opaque: F,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<u32>, String>
where
    F: Fn(usize) -> bool,
{
    let len = width as usize * height as usize;
    if radius == 0 || len == 0 {
        progress(3, "Reconstruyendo bordes", 1, 1)?;
        return Ok(Vec::new());
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
        if y % 16 == 0 || y + 1 == height {
            progress(
                3,
                "Buscando color interior confiable",
                (y + 1) as u64,
                (height * 2) as u64,
            )?;
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
        if y % 16 == 0 || y == 0 {
            progress(
                3,
                "Reconstruyendo bordes",
                (height * 2 - y) as u64,
                (height * 2) as u64,
            )?;
        }
    }
    Ok(nearest)
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
            reconstruction_mode: ReconstructionMode::Manual,
            protections: ProtectionOptions::default(),
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
            reconstruction_mode: ReconstructionMode::Manual,
            protections: ProtectionOptions::default(),
        };
        let delta = apply_treatment(&mut buffer, width, height, &treatment);
        assert!(matches!(delta, PixelDelta::Rgba8(changes) if changes.len() > 1_000_000));
        assert!(analyze("large", 1, width, height, &buffer).verified_solid_alpha);
    }

    #[test]
    fn recommendation_is_deterministic_and_inside_safe_range() {
        let mut pixels = Vec::new();
        for alpha in [0, 20, 40, 80, 120, 160, 200, 230, 255] {
            pixels.extend_from_slice(&[30, 60, 90, alpha]);
        }
        let buffer = PixelBuffer::Rgba8(pixels);
        let first = analyze("recommend", 0, 9, 1, &buffer);
        let second = analyze("recommend", 0, 9, 1, &buffer);
        let first = first.recommendation.unwrap();
        let second = second.recommendation.unwrap();
        assert_eq!(first.recommended_threshold, second.recommended_threshold);
        assert!(first.recommended_threshold >= first.safe_min);
        assert!(first.recommended_threshold <= first.safe_max);
        assert!(first.estimated_transparent + first.estimated_opaque > 0);
    }

    #[test]
    fn connected_texture_protection_resolves_to_opaque_not_partial() {
        let alphas = [255u8, 64, 0, 64, 0];
        let mut buffer = PixelBuffer::Rgba8(
            alphas
                .into_iter()
                .flat_map(|alpha| [80, 100, 120, alpha])
                .collect(),
        );
        let treatment = AlphaTreatment::Threshold {
            threshold: 128,
            reconstruct_radius: 2,
            reconstruction_mode: ReconstructionMode::Manual,
            protections: ProtectionOptions {
                protect_connected_texture: true,
                ..ProtectionOptions::default()
            },
        };
        let plan = plan_treatment(&buffer, 5, 1, &treatment);
        assert_eq!(plan.impact.protected_pixels, 1);
        let preview = treatment_preview_rgba8(&buffer, &plan);
        assert_eq!(&preview[4..8], &[255, 57, 209, 255]);
        let _ = apply_treatment(&mut buffer, 5, 1, &treatment);
        assert!(analyze("protected", 1, 5, 1, &buffer).verified_solid_alpha);
    }

    #[test]
    fn treatment_contract_accepts_frontend_camel_case_fields() {
        let treatment: AlphaTreatment = serde_json::from_value(serde_json::json!({
            "action": "threshold",
            "threshold": 128,
            "reconstructRadius": 3,
            "reconstructionMode": "manual",
            "protections": {
                "protectConnectedTexture": true,
                "protectFineLines": true,
                "protectGrunge": false,
                "onlyIsolatedParticles": false,
                "preservedRegionIds": ["alpha_region_00001"]
            }
        }))
        .unwrap();
        match treatment {
            AlphaTreatment::Threshold {
                reconstruct_radius,
                reconstruction_mode,
                protections,
                ..
            } => {
                assert_eq!(reconstruct_radius, 3);
                assert!(matches!(reconstruction_mode, ReconstructionMode::Manual));
                assert!(protections.protect_connected_texture);
                assert_eq!(protections.preserved_region_ids, vec!["alpha_region_00001"]);
            }
            _ => panic!("se esperaba un tratamiento por umbral"),
        }
    }

    #[test]
    fn reconstruction_rejects_a_dissimilar_contaminating_color() {
        let mut buffer = PixelBuffer::Rgba8(vec![0, 0, 255, 255, 255, 0, 0, 200]);
        let treatment = AlphaTreatment::Threshold {
            threshold: 128,
            reconstruct_radius: 2,
            reconstruction_mode: ReconstructionMode::Manual,
            protections: ProtectionOptions::default(),
        };
        let _ = apply_treatment(&mut buffer, 2, 1, &treatment);
        match buffer {
            PixelBuffer::Rgba8(pixels) => assert_eq!(&pixels[4..8], &[255, 0, 0, 255]),
            _ => unreachable!(),
        }
    }
}
