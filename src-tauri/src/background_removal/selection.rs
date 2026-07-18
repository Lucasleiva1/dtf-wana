use rayon::prelude::*;
use std::collections::VecDeque;

use crate::image_engine::document::PixelBuffer;

use super::{
    color::{chroma, delta_e_2000, delta_e_76, rgb_to_lab, Lab},
    types::{BoundarySegment, MaskPoint, WandSettings},
};

pub fn magic_wand_mask(
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    seed_x: u32,
    seed_y: u32,
    settings: &WandSettings,
    blocked: &[bool],
) -> Vec<u8> {
    magic_wand_mask_from_seeds(
        pixels,
        width,
        height,
        &[(seed_x, seed_y)],
        settings,
        blocked,
    )
}

pub fn magic_wand_mask_from_seeds(
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    seeds: &[(u32, u32)],
    settings: &WandSettings,
    blocked: &[bool],
) -> Vec<u8> {
    let count = width as usize * height as usize;
    let mut output = vec![0; count];
    if seeds.is_empty() || blocked.len() != count {
        return output;
    }
    let labs = labs_for_pixels(pixels);
    let seed_samples: Vec<(usize, Lab, f32)> = seeds
        .iter()
        .filter_map(|(x, y)| {
            if *x >= width || *y >= height {
                return None;
            }
            let index = *y as usize * width as usize + *x as usize;
            (!blocked[index]).then_some((index, labs[index], chroma(labs[index])))
        })
        .collect();
    if seed_samples.is_empty() {
        return output;
    }
    let matches_seed = |seed: Lab, seed_chroma: f32, candidate: Lab| {
        let distance = if settings.precise_color {
            delta_e_2000(seed, candidate)
        } else {
            delta_e_76(seed, candidate)
        };
        distance <= settings.tolerance.max(0.1)
            && (candidate.l - seed.l).abs() <= settings.luminance_range.max(0.0)
            && (chroma(candidate) - seed_chroma).abs() <= settings.saturation_range.max(0.0)
    };
    if !settings.contiguous {
        for (index, candidate) in labs.iter().copied().enumerate() {
            if !blocked[index]
                && seed_samples
                    .iter()
                    .any(|(_, seed, seed_chroma)| matches_seed(*seed, *seed_chroma, candidate))
            {
                output[index] = 255;
            }
        }
        return output;
    }

    let edge_limit = (34.0 - settings.edge_barrier_strength.clamp(0.0, 100.0) * 0.30).max(2.0);
    let offsets: &[(i32, i32)] = if settings.connectivity == 8 {
        &[
            (-1, -1),
            (0, -1),
            (1, -1),
            (-1, 0),
            (1, 0),
            (-1, 1),
            (0, 1),
            (1, 1),
        ]
    } else {
        &[(0, -1), (-1, 0), (1, 0), (0, 1)]
    };
    for (seed_index, seed, seed_chroma) in seed_samples {
        if output[seed_index] != 0 {
            continue;
        }
        let mut queue = VecDeque::from([seed_index]);
        let mut region = vec![seed_index];
        output[seed_index] = 255;
        while let Some(index) = queue.pop_front() {
            let x = index % width as usize;
            let y = index / width as usize;
            for (dx, dy) in offsets {
                let nx = x as i32 + dx;
                let ny = y as i32 + dy;
                if nx < 0 || ny < 0 || nx >= width as i32 || ny >= height as i32 {
                    continue;
                }
                let neighbor = ny as usize * width as usize + nx as usize;
                if output[neighbor] != 0
                    || blocked[neighbor]
                    || !matches_seed(seed, seed_chroma, labs[neighbor])
                {
                    continue;
                }
                if settings.protect_edges
                    && settings.stop_at_strong_edge
                    && (labs[index].l - labs[neighbor].l).abs() > edge_limit
                {
                    continue;
                }
                output[neighbor] = 255;
                region.push(neighbor);
                queue.push_back(neighbor);
            }
        }
        if region.len() < settings.minimum_region_size as usize {
            for index in region {
                output[index] = 0;
            }
        }
    }
    output
}

pub fn stroke_indices(points: &[MaskPoint], radius: u32, width: u32, height: u32) -> Vec<usize> {
    if points.is_empty() || width == 0 || height == 0 {
        return Vec::new();
    }
    let radius = radius.max(1) as f32;
    let mut samples = Vec::new();
    samples.push(points[0]);
    for pair in points.windows(2) {
        let dx = pair[1].x - pair[0].x;
        let dy = pair[1].y - pair[0].y;
        let distance = (dx * dx + dy * dy).sqrt();
        let steps = (distance / (radius * 0.35).max(0.5)).ceil().max(1.0) as usize;
        for step in 1..=steps {
            let t = step as f32 / steps as f32;
            samples.push(MaskPoint {
                x: pair[0].x + dx * t,
                y: pair[0].y + dy * t,
            });
        }
    }
    let mut indices = Vec::new();
    let radius_squared = radius * radius;
    for sample in samples {
        let min_x = (sample.x - radius).floor().max(0.0) as u32;
        let max_x = (sample.x + radius)
            .ceil()
            .min(width.saturating_sub(1) as f32) as u32;
        let min_y = (sample.y - radius).floor().max(0.0) as u32;
        let max_y = (sample.y + radius)
            .ceil()
            .min(height.saturating_sub(1) as f32) as u32;
        for y in min_y..=max_y {
            for x in min_x..=max_x {
                let dx = x as f32 + 0.5 - sample.x;
                let dy = y as f32 + 0.5 - sample.y;
                if dx * dx + dy * dy <= radius_squared {
                    indices.push(y as usize * width as usize + x as usize);
                }
            }
        }
    }
    indices.sort_unstable();
    indices.dedup();
    indices
}

pub fn dilate(mask: &[u8], width: u32, height: u32, radius: u32) -> Vec<u8> {
    morph(mask, width, height, radius, true)
}

pub fn erode(mask: &[u8], width: u32, height: u32, radius: u32) -> Vec<u8> {
    morph(mask, width, height, radius, false)
}

pub fn smooth(mask: &[u8], width: u32, height: u32, radius: u32) -> Vec<u8> {
    let opened = dilate(&erode(mask, width, height, radius), width, height, radius);
    erode(
        &dilate(&opened, width, height, radius),
        width,
        height,
        radius,
    )
}

fn morph(mask: &[u8], width: u32, height: u32, radius: u32, grow: bool) -> Vec<u8> {
    if radius == 0 || mask.is_empty() {
        return mask.to_vec();
    }
    let mut current = mask.to_vec();
    for _ in 0..radius.min(64) {
        let previous = current.clone();
        for y in 0..height as usize {
            for x in 0..width as usize {
                let index = y * width as usize + x;
                let neighbor_values = neighbors(x, y, width as usize, height as usize, true)
                    .into_iter()
                    .map(|neighbor| previous[neighbor] != 0);
                current[index] = if grow {
                    if previous[index] != 0 || neighbor_values.into_iter().any(|value| value) {
                        255
                    } else {
                        0
                    }
                } else if previous[index] != 0 && neighbor_values.into_iter().all(|value| value) {
                    255
                } else {
                    0
                };
            }
        }
    }
    current
}

pub fn remove_small_components(mask: &[u8], width: u32, height: u32, minimum: u32) -> Vec<u8> {
    let mut output = mask.to_vec();
    let mut visited = vec![false; mask.len()];
    for start in 0..mask.len() {
        if visited[start] || mask[start] == 0 {
            continue;
        }
        let mut queue = VecDeque::from([start]);
        let mut component = Vec::new();
        visited[start] = true;
        while let Some(index) = queue.pop_front() {
            component.push(index);
            let x = index % width as usize;
            let y = index / width as usize;
            for neighbor in neighbors(x, y, width as usize, height as usize, true) {
                if !visited[neighbor] && mask[neighbor] != 0 {
                    visited[neighbor] = true;
                    queue.push_back(neighbor);
                }
            }
        }
        if component.len() < minimum as usize {
            for index in component {
                output[index] = 0;
            }
        }
    }
    output
}

pub fn fill_small_holes(mask: &[u8], width: u32, height: u32, maximum: u32) -> Vec<u8> {
    let inverted: Vec<u8> = mask
        .iter()
        .map(|value| if *value == 0 { 255 } else { 0 })
        .collect();
    let cleaned = remove_small_components(&inverted, width, height, maximum);
    mask.iter()
        .zip(inverted.iter().zip(cleaned.iter()))
        .map(|(original, (before, after))| {
            if *before != 0 && *after == 0 {
                255
            } else {
                *original
            }
        })
        .collect()
}

pub fn boundary_segments(
    mask: &[u8],
    width: u32,
    height: u32,
    limit: usize,
) -> Vec<BoundarySegment> {
    let mut segments = Vec::new();
    let selected = |x: i32, y: i32| -> bool {
        x >= 0
            && y >= 0
            && x < width as i32
            && y < height as i32
            && mask[y as usize * width as usize + x as usize] != 0
    };
    for y in 0..height as i32 {
        for x in 0..width as i32 {
            if !selected(x, y) {
                continue;
            }
            let candidates = [
                (
                    !selected(x, y - 1),
                    BoundarySegment {
                        x1: x as u32,
                        y1: y as u32,
                        x2: x as u32 + 1,
                        y2: y as u32,
                    },
                ),
                (
                    !selected(x + 1, y),
                    BoundarySegment {
                        x1: x as u32 + 1,
                        y1: y as u32,
                        x2: x as u32 + 1,
                        y2: y as u32 + 1,
                    },
                ),
                (
                    !selected(x, y + 1),
                    BoundarySegment {
                        x1: x as u32 + 1,
                        y1: y as u32 + 1,
                        x2: x as u32,
                        y2: y as u32 + 1,
                    },
                ),
                (
                    !selected(x - 1, y),
                    BoundarySegment {
                        x1: x as u32,
                        y1: y as u32 + 1,
                        x2: x as u32,
                        y2: y as u32,
                    },
                ),
            ];
            for (include, segment) in candidates {
                if include {
                    segments.push(segment);
                    if segments.len() >= limit {
                        return segments;
                    }
                }
            }
        }
    }
    segments
}

pub fn labs_for_pixels(pixels: &PixelBuffer) -> Vec<Lab> {
    match pixels {
        PixelBuffer::Rgba8(values) => values
            .par_chunks_exact(4)
            .map(|pixel| rgb_to_lab(pixel[0] as u16, pixel[1] as u16, pixel[2] as u16, 255))
            .collect(),
        PixelBuffer::Rgba16(values) => values
            .par_chunks_exact(4)
            .map(|pixel| rgb_to_lab(pixel[0], pixel[1], pixel[2], u16::MAX))
            .collect(),
    }
}

fn neighbors(x: usize, y: usize, width: usize, height: usize, diagonal: bool) -> Vec<usize> {
    let mut output = Vec::with_capacity(if diagonal { 8 } else { 4 });
    let offsets: &[(i32, i32)] = if diagonal {
        &[
            (-1, -1),
            (0, -1),
            (1, -1),
            (-1, 0),
            (1, 0),
            (-1, 1),
            (0, 1),
            (1, 1),
        ]
    } else {
        &[(0, -1), (-1, 0), (1, 0), (0, 1)]
    };
    for (dx, dy) in offsets {
        let nx = x as i32 + dx;
        let ny = y as i32 + dy;
        if nx >= 0 && ny >= 0 && nx < width as i32 && ny < height as i32 {
            output.push(ny as usize * width + nx as usize);
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rgba(width: usize, colors: &[[u8; 4]]) -> PixelBuffer {
        assert_eq!(width, colors.len());
        PixelBuffer::Rgba8(colors.iter().flatten().copied().collect())
    }

    #[test]
    fn contiguous_wand_does_not_jump_across_different_color() {
        let pixels = rgba(
            5,
            &[
                [250, 250, 250, 255],
                [248, 248, 248, 255],
                [20, 20, 20, 255],
                [249, 249, 249, 255],
                [250, 250, 250, 255],
            ],
        );
        let settings = WandSettings {
            tolerance: 5.0,
            contiguous: true,
            ..WandSettings::default()
        };
        let mask = magic_wand_mask(&pixels, 5, 1, 0, 0, &settings, &[false; 5]);
        assert_eq!(mask, vec![255, 255, 0, 0, 0]);
    }

    #[test]
    fn protected_pixel_blocks_wand_growth() {
        let pixels = rgba(4, &[[250, 250, 250, 255]; 4]);
        let mask = magic_wand_mask(
            &pixels,
            4,
            1,
            0,
            0,
            &WandSettings::default(),
            &[false, true, false, false],
        );
        assert_eq!(mask, vec![255, 0, 0, 0]);
    }

    #[test]
    fn multi_seed_wand_finds_disconnected_border_regions_in_one_analysis() {
        let pixels = rgba(
            5,
            &[
                [250, 250, 250, 255],
                [249, 249, 249, 255],
                [15, 15, 15, 255],
                [249, 249, 249, 255],
                [250, 250, 250, 255],
            ],
        );
        let settings = WandSettings {
            tolerance: 5.0,
            contiguous: true,
            precise_color: false,
            ..WandSettings::default()
        };
        let mask =
            magic_wand_mask_from_seeds(&pixels, 5, 1, &[(0, 0), (4, 0)], &settings, &[false; 5]);
        assert_eq!(mask, vec![255, 255, 0, 255, 255]);
    }

    #[test]
    fn stroke_interpolation_has_no_gaps() {
        let points = [MaskPoint { x: 1.0, y: 1.0 }, MaskPoint { x: 18.0, y: 1.0 }];
        let indices = stroke_indices(&points, 2, 20, 3);
        assert!((1..19).all(|x| indices.contains(&(20 + x))));
    }
}
