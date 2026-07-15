use serde::{Deserialize, Serialize};

use crate::{
    alpha_engine::ProgressCallback,
    image_engine::document::{PixelBuffer, PixelDelta},
};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgePolishIntensity {
    Soft,
    Medium,
    Strong,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgePolishMethod {
    BinarySmoothing,
    MajorityFilter,
    SpikeRounding,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct EdgePolishOptions {
    pub intensity: EdgePolishIntensity,
    pub radius: u32,
    pub method: EdgePolishMethod,
    pub protect_fine_detail: bool,
    pub protect_connected_texture: bool,
}

impl Default for EdgePolishOptions {
    fn default() -> Self {
        Self {
            intensity: EdgePolishIntensity::Soft,
            radius: 1,
            method: EdgePolishMethod::BinarySmoothing,
            protect_fine_detail: true,
            protect_connected_texture: true,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgePolishImpact {
    pub changed_pixels: u64,
    pub became_transparent: u64,
    pub became_opaque: u64,
    pub protected_pixels: u64,
    pub boundary_pixels_before: u64,
    pub boundary_pixels_after: u64,
    pub jagged_points_before: u64,
    pub jagged_points_after: u64,
    pub verified_binary: bool,
}

pub struct EdgePolishPlan {
    target_mask: Vec<u8>,
    pub impact: EdgePolishImpact,
    search_radius: usize,
}

pub fn plan(
    buffer: &PixelBuffer,
    width: u32,
    height: u32,
    options: &EdgePolishOptions,
    progress: &mut ProgressCallback<'_>,
) -> Result<EdgePolishPlan, String> {
    let width = width as usize;
    let height = height as usize;
    let radius = options.radius.clamp(1, 3) as usize;
    progress(1, "Validando máscara binaria", 0, height as u64)?;
    let source = extract_binary_mask(buffer, width, height, progress)?;
    progress(2, "Protegiendo detalle fino", 0, height as u64)?;
    let protected = protection_mask(
        &source,
        width,
        height,
        options.protect_fine_detail,
        options.protect_connected_texture,
        progress,
    )?;
    progress(3, "Puliendo contorno binario", 0, height as u64)?;
    let mut target = polish_mask(&source, width, height, radius, options, progress)?;

    let search_radius = (radius * 3).max(4);
    let mut protected_pixels = 0u64;
    for index in 0..target.len() {
        if source[index] == 1 && target[index] == 0 && protected[index] == 1 {
            target[index] = 1;
            protected_pixels += 1;
        }
        if source[index] == 0
            && target[index] == 1
            && !has_opaque_source(&source, width, height, index, search_radius)
        {
            target[index] = 0;
        }
    }

    let (boundary_before, jagged_before) = boundary_stats(&source, width, height);
    let (boundary_after, jagged_after) = boundary_stats(&target, width, height);
    let mut became_transparent = 0u64;
    let mut became_opaque = 0u64;
    for (&before, &after) in source.iter().zip(&target) {
        match (before, after) {
            (1, 0) => became_transparent += 1,
            (0, 1) => became_opaque += 1,
            _ => {}
        }
    }
    progress(3, "Puliendo contorno binario", height as u64, height as u64)?;
    Ok(EdgePolishPlan {
        target_mask: target,
        search_radius,
        impact: EdgePolishImpact {
            changed_pixels: became_transparent + became_opaque,
            became_transparent,
            became_opaque,
            protected_pixels,
            boundary_pixels_before: boundary_before,
            boundary_pixels_after: boundary_after,
            jagged_points_before: jagged_before,
            jagged_points_after: jagged_after,
            verified_binary: true,
        },
    })
}

pub fn apply_plan(
    buffer: &mut PixelBuffer,
    width: u32,
    height: u32,
    plan: &EdgePolishPlan,
    progress: &mut ProgressCallback<'_>,
) -> Result<PixelDelta, String> {
    progress(4, "Reconstruyendo color interior", 0, height as u64)?;
    match buffer {
        PixelBuffer::Rgba8(pixels) => {
            apply_u8(pixels, width as usize, height as usize, plan, progress).map(PixelDelta::Rgba8)
        }
        PixelBuffer::Rgba16(pixels) => {
            apply_u16(pixels, width as usize, height as usize, plan, progress)
                .map(PixelDelta::Rgba16)
        }
    }
}

fn extract_binary_mask(
    buffer: &PixelBuffer,
    width: usize,
    height: usize,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<u8>, String> {
    let mut mask = vec![0u8; width * height];
    match buffer {
        PixelBuffer::Rgba8(pixels) => {
            for y in 0..height {
                for x in 0..width {
                    let alpha = pixels[(y * width + x) * 4 + 3];
                    if alpha != 0 && alpha != u8::MAX {
                        return Err("EDGE_POLISH_REQUIRES_BINARY_ALPHA: resolvé y verificá las semitransparencias antes de pulir".into());
                    }
                    mask[y * width + x] = u8::from(alpha == u8::MAX);
                }
                if y % 32 == 0 || y + 1 == height {
                    progress(
                        1,
                        "Validando máscara binaria",
                        (y + 1) as u64,
                        height as u64,
                    )?;
                }
            }
        }
        PixelBuffer::Rgba16(pixels) => {
            for y in 0..height {
                for x in 0..width {
                    let alpha = pixels[(y * width + x) * 4 + 3];
                    if alpha != 0 && alpha != u16::MAX {
                        return Err("EDGE_POLISH_REQUIRES_BINARY_ALPHA: resolvé y verificá las semitransparencias antes de pulir".into());
                    }
                    mask[y * width + x] = u8::from(alpha == u16::MAX);
                }
                if y % 32 == 0 || y + 1 == height {
                    progress(
                        1,
                        "Validando máscara binaria",
                        (y + 1) as u64,
                        height as u64,
                    )?;
                }
            }
        }
    }
    Ok(mask)
}

fn protection_mask(
    mask: &[u8],
    width: usize,
    height: usize,
    fine: bool,
    connected: bool,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<u8>, String> {
    let mut protected = vec![0u8; mask.len()];
    if !fine && !connected {
        progress(2, "Protegiendo detalle fino", height as u64, height as u64)?;
        return Ok(protected);
    }
    for y in 0..height {
        for x in 0..width {
            let index = y * width + x;
            if mask[index] == 0 || !is_boundary(mask, width, height, x, y) {
                continue;
            }
            let neighbors = neighbor_values(mask, width, height, x, y);
            let count = neighbors.iter().map(|value| *value as u32).sum::<u32>();
            if fine && count <= 3 {
                protected[index] = 1;
            }
            if connected && neighbor_groups(&neighbors) > 1 {
                protected[index] = 1;
            }
        }
        if y % 32 == 0 || y + 1 == height {
            progress(2, "Protegiendo detalle fino", (y + 1) as u64, height as u64)?;
        }
    }
    Ok(protected)
}

fn polish_mask(
    source: &[u8],
    width: usize,
    height: usize,
    radius: usize,
    options: &EdgePolishOptions,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<u8>, String> {
    let iterations = match options.intensity {
        EdgePolishIntensity::Soft => 1,
        EdgePolishIntensity::Medium => 2,
        EdgePolishIntensity::Strong => 3,
    };
    let mut current = source.to_vec();
    match options.method {
        EdgePolishMethod::MajorityFilter => {
            for pass in 0..iterations {
                current = majority_pass(&current, width, height, radius, options.intensity);
                progress(
                    3,
                    "Puliendo contorno binario",
                    ((pass + 1) * height / iterations) as u64,
                    height as u64,
                )?;
            }
        }
        EdgePolishMethod::SpikeRounding => {
            for pass in 0..iterations.min(2) {
                current = spike_pass(&current, width, height, radius, options.intensity);
                progress(
                    3,
                    "Redondeando picos",
                    ((pass + 1) * height / iterations.min(2)) as u64,
                    height as u64,
                )?;
            }
        }
        EdgePolishMethod::BinarySmoothing => {
            let smoothed = morphology_smooth(&current, width, height, radius);
            current = if matches!(options.intensity, EdgePolishIntensity::Soft) {
                conservative_merge(source, &smoothed, width, height, radius)
            } else {
                smoothed
            };
            if matches!(options.intensity, EdgePolishIntensity::Strong) {
                current = morphology_smooth(&current, width, height, radius);
            }
            progress(
                3,
                "Suavizando máscara binaria",
                height as u64,
                height as u64,
            )?;
        }
    }
    Ok(current)
}

fn integral(mask: &[u8], width: usize, height: usize) -> Vec<u32> {
    let stride = width + 1;
    let mut table = vec![0u32; stride * (height + 1)];
    for y in 0..height {
        let mut row = 0u32;
        for x in 0..width {
            row += mask[y * width + x] as u32;
            table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + row;
        }
    }
    table
}

fn window(
    integral: &[u32],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    radius: usize,
) -> (u32, u32) {
    let x0 = x.saturating_sub(radius);
    let y0 = y.saturating_sub(radius);
    let x1 = (x + radius + 1).min(width);
    let y1 = (y + radius + 1).min(height);
    let stride = width + 1;
    let count = integral[y1 * stride + x1] + integral[y0 * stride + x0]
        - integral[y0 * stride + x1]
        - integral[y1 * stride + x0];
    (count, ((x1 - x0) * (y1 - y0)) as u32)
}

fn transform(mask: &[u8], width: usize, height: usize, radius: usize, kind: u8) -> Vec<u8> {
    let sums = integral(mask, width, height);
    let mut result = vec![0u8; mask.len()];
    for y in 0..height {
        for x in 0..width {
            let (count, area) = window(&sums, width, height, x, y, radius);
            result[y * width + x] = match kind {
                0 => u8::from(count > 0),
                _ => u8::from(count == area),
            };
        }
    }
    result
}

fn morphology_smooth(mask: &[u8], width: usize, height: usize, radius: usize) -> Vec<u8> {
    let dilated = transform(mask, width, height, radius, 0);
    let closed = transform(&dilated, width, height, radius, 1);
    let eroded = transform(&closed, width, height, radius, 1);
    transform(&eroded, width, height, radius, 0)
}

fn majority_pass(
    mask: &[u8],
    width: usize,
    height: usize,
    radius: usize,
    intensity: EdgePolishIntensity,
) -> Vec<u8> {
    let sums = integral(mask, width, height);
    let mut result = mask.to_vec();
    let (remove, add) = match intensity {
        EdgePolishIntensity::Soft => (30u32, 70u32),
        EdgePolishIntensity::Medium => (40, 60),
        EdgePolishIntensity::Strong => (49, 51),
    };
    for y in 0..height {
        for x in 0..width {
            let (count, area) = window(&sums, width, height, x, y, radius);
            let ratio = count * 100 / area.max(1);
            let index = y * width + x;
            let cardinal = [(-1isize, 0isize), (1, 0), (0, -1), (0, 1)]
                .iter()
                .filter(|(dx, dy)| {
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    nx >= 0
                        && ny >= 0
                        && nx < width as isize
                        && ny < height as isize
                        && mask[ny as usize * width + nx as usize] == 1
                })
                .count();
            if mask[index] == 1 && (ratio <= remove || cardinal <= 1) {
                result[index] = 0;
            }
            if mask[index] == 0 && ratio >= add {
                result[index] = 1;
            }
        }
    }
    result
}

fn spike_pass(
    mask: &[u8],
    width: usize,
    height: usize,
    radius: usize,
    intensity: EdgePolishIntensity,
) -> Vec<u8> {
    let sums = integral(mask, width, height);
    let mut result = mask.to_vec();
    let (remove, add) = match intensity {
        EdgePolishIntensity::Soft => (24u32, 84u32),
        EdgePolishIntensity::Medium => (32, 76),
        EdgePolishIntensity::Strong => (40, 68),
    };
    for y in 0..height {
        for x in 0..width {
            if !is_boundary_or_adjacent(mask, width, height, x, y) {
                continue;
            }
            let (count, area) = window(&sums, width, height, x, y, radius);
            let ratio = count * 100 / area.max(1);
            let index = y * width + x;
            let cardinal = [(-1isize, 0isize), (1, 0), (0, -1), (0, 1)]
                .iter()
                .filter(|(dx, dy)| {
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    nx >= 0
                        && ny >= 0
                        && nx < width as isize
                        && ny < height as isize
                        && mask[ny as usize * width + nx as usize] == 1
                })
                .count();
            if mask[index] == 1 && (ratio <= remove || cardinal <= 1) {
                result[index] = 0;
            }
            if mask[index] == 0 && ratio >= add {
                result[index] = 1;
            }
        }
    }
    result
}

fn conservative_merge(
    source: &[u8],
    candidate: &[u8],
    width: usize,
    height: usize,
    radius: usize,
) -> Vec<u8> {
    let sums = integral(source, width, height);
    let mut result = source.to_vec();
    for y in 0..height {
        for x in 0..width {
            let index = y * width + x;
            if source[index] == candidate[index] {
                continue;
            }
            let (count, area) = window(&sums, width, height, x, y, radius);
            let ratio = count * 100 / area.max(1);
            if (candidate[index] == 1 && ratio >= 66) || (candidate[index] == 0 && ratio <= 34) {
                result[index] = candidate[index];
            }
        }
    }
    result
}

fn neighbor_values(mask: &[u8], width: usize, height: usize, x: usize, y: usize) -> [u8; 8] {
    let offsets = [
        (-1, -1),
        (0, -1),
        (1, -1),
        (1, 0),
        (1, 1),
        (0, 1),
        (-1, 1),
        (-1, 0),
    ];
    let mut values = [0u8; 8];
    for (i, (dx, dy)) in offsets.iter().enumerate() {
        let nx = x as isize + dx;
        let ny = y as isize + dy;
        if nx >= 0 && ny >= 0 && nx < width as isize && ny < height as isize {
            values[i] = mask[ny as usize * width + nx as usize];
        }
    }
    values
}

fn neighbor_groups(values: &[u8; 8]) -> u8 {
    let mut groups = 0;
    for i in 0..8 {
        if values[i] == 1 && values[(i + 7) % 8] == 0 {
            groups += 1;
        }
    }
    groups
}

fn is_boundary(mask: &[u8], width: usize, height: usize, x: usize, y: usize) -> bool {
    if mask[y * width + x] == 0 {
        return false;
    }
    x == 0
        || y == 0
        || x + 1 == width
        || y + 1 == height
        || mask[y * width + x - 1] == 0
        || mask[y * width + x + 1] == 0
        || mask[(y - 1) * width + x] == 0
        || mask[(y + 1) * width + x] == 0
}

fn is_boundary_or_adjacent(mask: &[u8], width: usize, height: usize, x: usize, y: usize) -> bool {
    let value = mask[y * width + x];
    for dy in -1isize..=1 {
        for dx in -1isize..=1 {
            let nx = x as isize + dx;
            let ny = y as isize + dy;
            if nx >= 0
                && ny >= 0
                && nx < width as isize
                && ny < height as isize
                && mask[ny as usize * width + nx as usize] != value
            {
                return true;
            }
        }
    }
    false
}

fn boundary_stats(mask: &[u8], width: usize, height: usize) -> (u64, u64) {
    let mut boundary = 0;
    let mut jagged = 0;
    for y in 0..height {
        for x in 0..width {
            if !is_boundary(mask, width, height, x, y) {
                continue;
            }
            boundary += 1;
            let cardinal = [(0isize, -1isize), (1, 0), (0, 1), (-1, 0)]
                .iter()
                .filter(|(dx, dy)| {
                    let nx = x as isize + dx;
                    let ny = y as isize + dy;
                    nx >= 0
                        && ny >= 0
                        && nx < width as isize
                        && ny < height as isize
                        && mask[ny as usize * width + nx as usize] == 1
                })
                .count();
            if cardinal <= 1 {
                jagged += 1;
            }
        }
    }
    (boundary, jagged)
}

fn has_opaque_source(
    mask: &[u8],
    width: usize,
    height: usize,
    index: usize,
    radius: usize,
) -> bool {
    let x = index % width;
    let y = index / width;
    let x0 = x.saturating_sub(radius);
    let x1 = (x + radius + 1).min(width);
    let y0 = y.saturating_sub(radius);
    let y1 = (y + radius + 1).min(height);
    (y0..y1).any(|ny| (x0..x1).any(|nx| mask[ny * width + nx] == 1))
}

fn source_indices(
    mask: &[u8],
    width: usize,
    height: usize,
    index: usize,
    radius: usize,
) -> Vec<(usize, u64)> {
    let x = index % width;
    let y = index / width;
    let mut result = Vec::new();
    let x0 = x.saturating_sub(radius);
    let x1 = (x + radius + 1).min(width);
    let y0 = y.saturating_sub(radius);
    let y1 = (y + radius + 1).min(height);
    for ny in y0..y1 {
        for nx in x0..x1 {
            let source = ny * width + nx;
            if mask[source] == 1 {
                let distance = ((nx as isize - x as isize).unsigned_abs()
                    + (ny as isize - y as isize).unsigned_abs())
                .max(1) as u64;
                result.push((source, 1024 / distance));
            }
        }
    }
    result
}

fn apply_u8(
    pixels: &mut Vec<u8>,
    width: usize,
    height: usize,
    plan: &EdgePolishPlan,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<(usize, [u8; 4], [u8; 4])>, String> {
    let original = pixels.clone();
    let source: Vec<u8> = original
        .chunks_exact(4)
        .map(|p| u8::from(p[3] == u8::MAX))
        .collect();
    let mut changes = Vec::with_capacity(plan.impact.changed_pixels as usize);
    for y in 0..height {
        for x in 0..width {
            let index = y * width + x;
            if source[index] == plan.target_mask[index] {
                continue;
            }
            let old = [
                original[index * 4],
                original[index * 4 + 1],
                original[index * 4 + 2],
                original[index * 4 + 3],
            ];
            let mut new = old;
            if plan.target_mask[index] == 0 {
                new[3] = 0;
            } else {
                let sources = source_indices(&source, width, height, index, plan.search_radius);
                let weight: u64 = sources.iter().map(|(_, w)| *w).sum();
                if weight == 0 {
                    continue;
                }
                for channel in 0..3 {
                    new[channel] = (sources
                        .iter()
                        .map(|(i, w)| original[i * 4 + channel] as u64 * w)
                        .sum::<u64>()
                        / weight) as u8;
                }
                new[3] = u8::MAX;
            }
            pixels[index * 4..index * 4 + 4].copy_from_slice(&new);
            changes.push((index, old, new));
        }
        if y % 32 == 0 || y + 1 == height {
            progress(
                4,
                "Reconstruyendo color interior",
                (y + 1) as u64,
                height as u64,
            )?;
        }
    }
    Ok(changes)
}

fn apply_u16(
    pixels: &mut Vec<u16>,
    width: usize,
    height: usize,
    plan: &EdgePolishPlan,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<(usize, [u16; 4], [u16; 4])>, String> {
    let original = pixels.clone();
    let source: Vec<u8> = original
        .chunks_exact(4)
        .map(|p| u8::from(p[3] == u16::MAX))
        .collect();
    let mut changes = Vec::with_capacity(plan.impact.changed_pixels as usize);
    for y in 0..height {
        for x in 0..width {
            let index = y * width + x;
            if source[index] == plan.target_mask[index] {
                continue;
            }
            let old = [
                original[index * 4],
                original[index * 4 + 1],
                original[index * 4 + 2],
                original[index * 4 + 3],
            ];
            let mut new = old;
            if plan.target_mask[index] == 0 {
                new[3] = 0;
            } else {
                let sources = source_indices(&source, width, height, index, plan.search_radius);
                let weight: u64 = sources.iter().map(|(_, w)| *w).sum();
                if weight == 0 {
                    continue;
                }
                for channel in 0..3 {
                    new[channel] = (sources
                        .iter()
                        .map(|(i, w)| original[i * 4 + channel] as u64 * w)
                        .sum::<u64>()
                        / weight) as u16;
                }
                new[3] = u16::MAX;
            }
            pixels[index * 4..index * 4 + 4].copy_from_slice(&new);
            changes.push((index, old, new));
        }
        if y % 32 == 0 || y + 1 == height {
            progress(
                4,
                "Reconstruyendo color interior",
                (y + 1) as u64,
                height as u64,
            )?;
        }
    }
    Ok(changes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(method: EdgePolishMethod) -> EdgePolishOptions {
        EdgePolishOptions {
            method,
            ..Default::default()
        }
    }

    #[test]
    fn rejects_partial_alpha() {
        let buffer = PixelBuffer::Rgba8(vec![10, 20, 30, 128]);
        let error = plan(
            &buffer,
            1,
            1,
            &options(EdgePolishMethod::MajorityFilter),
            &mut |_, _, _, _| Ok(()),
        )
        .err()
        .unwrap();
        assert!(error.contains("REQUIRES_BINARY_ALPHA"));
    }

    #[test]
    fn rounds_spike_without_creating_partial_alpha_and_is_undoable_delta() {
        let width = 9;
        let height = 9;
        let mut pixels = vec![0u8; width * height * 4];
        for y in 2..7 {
            for x in 2..7 {
                let i = (y * width + x) * 4;
                pixels[i..i + 4].copy_from_slice(&[120, 80, 40, 255]);
            }
        }
        let tip = (1 * width + 4) * 4;
        pixels[tip..tip + 4].copy_from_slice(&[120, 80, 40, 255]);
        let mut buffer = PixelBuffer::Rgba8(pixels.clone());
        let mut value = options(EdgePolishMethod::SpikeRounding);
        value.protect_fine_detail = false;
        value.protect_connected_texture = false;
        let plan = plan(
            &buffer,
            width as u32,
            height as u32,
            &value,
            &mut |_, _, _, _| Ok(()),
        )
        .unwrap();
        let delta = apply_plan(
            &mut buffer,
            width as u32,
            height as u32,
            &plan,
            &mut |_, _, _, _| Ok(()),
        )
        .unwrap();
        let PixelBuffer::Rgba8(result) = &buffer else {
            unreachable!()
        };
        assert!(result.chunks_exact(4).all(|p| p[3] == 0 || p[3] == 255));
        assert!(matches!(delta,PixelDelta::Rgba8(changes) if !changes.is_empty()));
    }

    #[test]
    fn all_methods_preserve_binary_alpha() {
        for method in [
            EdgePolishMethod::BinarySmoothing,
            EdgePolishMethod::MajorityFilter,
            EdgePolishMethod::SpikeRounding,
        ] {
            let mut pixels = vec![0u8; 11 * 11 * 4];
            for y in 3..8 {
                for x in 3..8 {
                    pixels[(y * 11 + x) * 4 + 3] = 255;
                }
            }
            let mut buffer = PixelBuffer::Rgba8(pixels);
            let plan = plan(&buffer, 11, 11, &options(method), &mut |_, _, _, _| Ok(())).unwrap();
            apply_plan(&mut buffer, 11, 11, &plan, &mut |_, _, _, _| Ok(())).unwrap();
            let PixelBuffer::Rgba8(result) = buffer else {
                unreachable!()
            };
            assert!(result.chunks_exact(4).all(|p| p[3] == 0 || p[3] == 255));
        }
    }
}
