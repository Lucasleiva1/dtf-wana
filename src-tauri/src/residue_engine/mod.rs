use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

use crate::{
    alpha_engine::{AlphaRegion, ProgressCallback},
    image_engine::document::PixelBuffer,
};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MaskMode {
    Add,
    Subtract,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaskPoint {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum MaskEdit {
    Component {
        x: u32,
        y: u32,
        mode: MaskMode,
    },
    Rectangle {
        start: MaskPoint,
        end: MaskPoint,
        mode: MaskMode,
    },
    Lasso {
        points: Vec<MaskPoint>,
        mode: MaskMode,
    },
    Brush {
        points: Vec<MaskPoint>,
        radius: u32,
        mode: MaskMode,
    },
    Clear,
    SelectAll,
    Invert,
    Undo,
    Redo,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResidueCleanupOptions {
    pub isolated_particles: bool,
    pub weak_edge_fragments: bool,
    pub exterior_contour_remains: bool,
    pub include_protected_selected: bool,
    pub max_region_size: u32,
    pub max_distance: u32,
    pub minimum_connection_thickness: u32,
    pub contour_sensitivity: u8,
    #[serde(default)]
    pub protected_region_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MaskSummary {
    pub selected_pixels: u64,
    pub selected_regions: u32,
    pub has_selection: bool,
    pub can_undo: bool,
    pub can_redo: bool,
}

#[derive(Clone, Copy)]
struct MaskValue([u8; 3]);

#[derive(Clone)]
struct MaskChange {
    index: usize,
    before: MaskValue,
    after: MaskValue,
}

#[derive(Clone, Default)]
struct MaskHistoryEntry {
    changes: Vec<MaskChange>,
}

#[derive(Clone, Default)]
pub struct ResidueMask {
    automatic: Vec<u8>,
    manual_add: Vec<u8>,
    manual_remove: Vec<u8>,
    history: Vec<MaskHistoryEntry>,
    future: Vec<MaskHistoryEntry>,
}

impl ResidueMask {
    pub fn new(pixel_count: usize) -> Self {
        Self {
            automatic: vec![0; pixel_count],
            manual_add: vec![0; pixel_count],
            manual_remove: vec![0; pixel_count],
            history: Vec::new(),
            future: Vec::new(),
        }
    }

    pub fn ensure_len(&mut self, pixel_count: usize) {
        if self.automatic.len() != pixel_count {
            *self = Self::new(pixel_count);
        }
    }

    pub fn is_selected(&self, index: usize) -> bool {
        self.manual_add[index] != 0
            || (self.automatic[index] != 0 && self.manual_remove[index] == 0)
    }

    pub fn selected_indices(&self) -> Vec<usize> {
        (0..self.automatic.len())
            .filter(|&index| self.is_selected(index))
            .collect()
    }

    pub fn clear_after_apply(&mut self) {
        let len = self.automatic.len();
        *self = Self::new(len);
    }

    fn value(&self, index: usize) -> MaskValue {
        MaskValue([
            self.automatic[index],
            self.manual_add[index],
            self.manual_remove[index],
        ])
    }

    fn set_value(&mut self, index: usize, value: MaskValue) {
        self.automatic[index] = value.0[0];
        self.manual_add[index] = value.0[1];
        self.manual_remove[index] = value.0[2];
    }

    fn set_manual(&mut self, index: usize, mode: MaskMode) {
        match mode {
            MaskMode::Add => {
                self.manual_add[index] = 1;
                self.manual_remove[index] = 0;
            }
            MaskMode::Subtract => {
                self.manual_add[index] = 0;
                self.manual_remove[index] = 1;
            }
        }
    }

    fn commit<F>(&mut self, candidates: impl IntoIterator<Item = usize>, mut update: F)
    where
        F: FnMut(&mut Self, usize),
    {
        let mut unique: Vec<usize> = candidates.into_iter().collect();
        unique.sort_unstable();
        unique.dedup();
        let mut changes = Vec::new();
        for index in unique {
            if index >= self.automatic.len() {
                continue;
            }
            let before = self.value(index);
            update(self, index);
            let after = self.value(index);
            if before.0 != after.0 {
                changes.push(MaskChange {
                    index,
                    before,
                    after,
                });
            }
        }
        if !changes.is_empty() {
            self.history.push(MaskHistoryEntry { changes });
            self.future.clear();
            if self.history.len() > 50 {
                self.history.remove(0);
            }
        }
    }

    fn undo(&mut self) {
        let Some(entry) = self.history.pop() else {
            return;
        };
        for change in &entry.changes {
            self.set_value(change.index, change.before);
        }
        self.future.push(entry);
    }

    fn redo(&mut self) {
        let Some(entry) = self.future.pop() else {
            return;
        };
        for change in &entry.changes {
            self.set_value(change.index, change.after);
        }
        self.history.push(entry);
    }
}

pub fn edit_mask(
    mask: &mut ResidueMask,
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    edit: &MaskEdit,
) -> MaskSummary {
    mask.ensure_len((width as usize).saturating_mul(height as usize));
    match edit {
        MaskEdit::Undo => mask.undo(),
        MaskEdit::Redo => mask.redo(),
        MaskEdit::Clear => {
            let indices = (0..mask.automatic.len())
                .filter(|&i| mask.is_selected(i) || mask.manual_remove[i] != 0);
            mask.commit(indices.collect::<Vec<_>>(), |state, index| {
                state.set_value(index, MaskValue([0, 0, 0]))
            });
        }
        MaskEdit::SelectAll => {
            let indices = (0..mask.automatic.len())
                .filter(|&i| alpha_nonzero(pixels, i))
                .collect::<Vec<_>>();
            mask.commit(indices, |state, index| {
                state.set_manual(index, MaskMode::Add)
            });
        }
        MaskEdit::Invert => {
            let indices = (0..mask.automatic.len())
                .filter(|&i| alpha_nonzero(pixels, i))
                .collect::<Vec<_>>();
            mask.commit(indices, |state, index| {
                if state.is_selected(index) {
                    state.set_manual(index, MaskMode::Subtract);
                } else {
                    state.set_manual(index, MaskMode::Add);
                }
            });
        }
        MaskEdit::Component { x, y, mode } => {
            let indices = connected_component(pixels, width, height, *x, *y);
            mask.commit(indices, |state, index| state.set_manual(index, *mode));
        }
        MaskEdit::Rectangle { start, end, mode } => {
            let min_x = start.x.min(end.x).floor().max(0.0) as u32;
            let max_x = start.x.max(end.x).ceil().min(width as f32) as u32;
            let min_y = start.y.min(end.y).floor().max(0.0) as u32;
            let max_y = start.y.max(end.y).ceil().min(height as f32) as u32;
            let mut indices = Vec::new();
            for y in min_y..max_y {
                for x in min_x..max_x {
                    let index = y as usize * width as usize + x as usize;
                    if alpha_nonzero(pixels, index) {
                        indices.push(index);
                    }
                }
            }
            mask.commit(indices, |state, index| state.set_manual(index, *mode));
        }
        MaskEdit::Lasso { points, mode } => {
            if points.len() >= 3 {
                let min_x = points
                    .iter()
                    .map(|p| p.x)
                    .fold(f32::INFINITY, f32::min)
                    .floor()
                    .max(0.0) as u32;
                let max_x = points
                    .iter()
                    .map(|p| p.x)
                    .fold(f32::NEG_INFINITY, f32::max)
                    .ceil()
                    .min(width as f32) as u32;
                let min_y = points
                    .iter()
                    .map(|p| p.y)
                    .fold(f32::INFINITY, f32::min)
                    .floor()
                    .max(0.0) as u32;
                let max_y = points
                    .iter()
                    .map(|p| p.y)
                    .fold(f32::NEG_INFINITY, f32::max)
                    .ceil()
                    .min(height as f32) as u32;
                let mut indices = Vec::new();
                for y in min_y..max_y {
                    for x in min_x..max_x {
                        let index = y as usize * width as usize + x as usize;
                        if alpha_nonzero(pixels, index)
                            && point_in_polygon(x as f32 + 0.5, y as f32 + 0.5, points)
                        {
                            indices.push(index);
                        }
                    }
                }
                mask.commit(indices, |state, index| state.set_manual(index, *mode));
            }
        }
        MaskEdit::Brush {
            points,
            radius,
            mode,
        } => {
            let indices = brush_indices(points, (*radius).clamp(1, 500), width, height, pixels);
            mask.commit(indices, |state, index| state.set_manual(index, *mode));
        }
    }
    summary(mask, width, height)
}

pub fn classify_residues(
    mask: &mut ResidueMask,
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    options: &ResidueCleanupOptions,
    protected_regions: &[AlphaRegion],
    progress: &mut ProgressCallback<'_>,
) -> Result<MaskSummary, String> {
    let len = width as usize * height as usize;
    mask.ensure_len(len);
    progress(1, "Mapeando diseño principal", 0, height as u64)?;
    let components = all_components(pixels, width, height, progress)?;
    let main_index = components
        .iter()
        .enumerate()
        .max_by_key(|(_, c)| c.len())
        .map(|(i, _)| i);
    let main_bounds = main_index.map(|i| component_bounds(&components[i], width));
    progress(
        2,
        "Clasificando partículas y contornos",
        0,
        components.len() as u64,
    )?;
    let mut automatic = vec![0u8; len];
    for (component_index, component) in components.iter().enumerate() {
        if Some(component_index) != main_index {
            let bounds = component_bounds(component, width);
            let distance = main_bounds
                .map(|main| bounds_distance(bounds, main))
                .unwrap_or(u32::MAX);
            let isolated = options.isolated_particles
                && component.len() <= options.max_region_size.max(1) as usize;
            let exterior = options.exterior_contour_remains
                && component.len() <= options.max_region_size.max(1) as usize * 4
                && distance <= options.max_distance;
            if isolated || exterior {
                for &index in component {
                    automatic[index] = 1;
                }
            }
        }
        progress(
            2,
            "Clasificando partículas y contornos",
            (component_index + 1) as u64,
            components.len().max(1) as u64,
        )?;
    }
    if options.weak_edge_fragments {
        progress(3, "Detectando conexiones débiles", 0, height as u64)?;
        let neighbor_limit = (options.minimum_connection_thickness.clamp(1, 8)
            + options.contour_sensitivity as u32 / 35)
            .clamp(2, 8);
        let mut weak_candidates = vec![false; len];
        for y in 0..height {
            for x in 0..width {
                let index = y as usize * width as usize + x as usize;
                if !alpha_nonzero(pixels, index) || automatic[index] != 0 {
                    continue;
                }
                let neighbors = nonzero_neighbors(pixels, width, height, x, y);
                if neighbors <= neighbor_limit
                    && (alpha_is_partial(pixels, index) || options.contour_sensitivity >= 45)
                {
                    weak_candidates[index] = true;
                }
            }
            if y % 16 == 0 || y + 1 == height {
                progress(
                    3,
                    "Detectando conexiones débiles",
                    (y + 1) as u64,
                    height as u64,
                )?;
            }
        }
        let max_weak_size = options.max_region_size.max(1) as usize * 2;
        for component in binary_components(&weak_candidates, width, height) {
            if component.len() <= max_weak_size {
                for index in component {
                    automatic[index] = 1;
                }
            }
        }
    }
    if options.include_protected_selected && !options.protected_region_ids.is_empty() {
        progress(4, "Incluyendo zonas protegidas seleccionadas", 0, 1)?;
        for region in protected_regions {
            if !options.protected_region_ids.contains(&region.id) {
                continue;
            }
            for y in region.min_y..=region.max_y.min(height.saturating_sub(1)) {
                for x in region.min_x..=region.max_x.min(width.saturating_sub(1)) {
                    let index = y as usize * width as usize + x as usize;
                    if alpha_nonzero(pixels, index) {
                        automatic[index] = 1;
                    }
                }
            }
        }
        progress(4, "Incluyendo zonas protegidas seleccionadas", 1, 1)?;
    }
    let indices = 0..len;
    mask.commit(indices, |state, index| {
        state.automatic[index] = automatic[index]
    });
    progress(
        5,
        "Generando previsualización roja",
        height as u64,
        height as u64,
    )?;
    Ok(summary(mask, width, height))
}

pub fn summary(mask: &ResidueMask, width: u32, height: u32) -> MaskSummary {
    let mut selected = vec![false; width as usize * height as usize];
    let mut selected_pixels = 0u64;
    for (index, value) in selected.iter_mut().enumerate() {
        *value = mask.is_selected(index);
        if *value {
            selected_pixels += 1;
        }
    }
    let selected_regions = binary_region_count(&selected, width, height);
    MaskSummary {
        selected_pixels,
        selected_regions,
        has_selection: selected_pixels > 0,
        can_undo: !mask.history.is_empty(),
        can_redo: !mask.future.is_empty(),
    }
}

pub fn preview_rgba8(mask: &ResidueMask, pixels: &PixelBuffer) -> Vec<u8> {
    let mut rgba = base_rgba8(pixels);
    for index in 0..mask.automatic.len() {
        if mask.is_selected(index) {
            let offset = index * 4;
            rgba[offset] = 255;
            rgba[offset + 1] = 35;
            rgba[offset + 2] = 45;
            rgba[offset + 3] = 255;
        }
    }
    rgba
}

fn alpha_nonzero(pixels: &PixelBuffer, index: usize) -> bool {
    match pixels {
        PixelBuffer::Rgba8(values) => values[index * 4 + 3] != 0,
        PixelBuffer::Rgba16(values) => values[index * 4 + 3] != 0,
    }
}

fn alpha_is_partial(pixels: &PixelBuffer, index: usize) -> bool {
    match pixels {
        PixelBuffer::Rgba8(values) => (1..=254).contains(&values[index * 4 + 3]),
        PixelBuffer::Rgba16(values) => (1..=65534).contains(&values[index * 4 + 3]),
    }
}

fn connected_component(
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    x: u32,
    y: u32,
) -> Vec<usize> {
    if x >= width || y >= height {
        return Vec::new();
    }
    let start = y as usize * width as usize + x as usize;
    if !alpha_nonzero(pixels, start) {
        return Vec::new();
    }
    let weak_seed = nonzero_neighbors(pixels, width, height, x, y) <= 3;
    let mut seen = vec![false; width as usize * height as usize];
    let mut queue = VecDeque::from([start]);
    seen[start] = true;
    let mut result = Vec::new();
    while let Some(index) = queue.pop_front() {
        result.push(index);
        let px = index as u32 % width;
        let py = index as u32 / width;
        for (nx, ny) in neighbors8(px, py, width, height) {
            let next = ny as usize * width as usize + nx as usize;
            let traversable = !weak_seed || nonzero_neighbors(pixels, width, height, nx, ny) <= 4;
            if !seen[next] && alpha_nonzero(pixels, next) && traversable {
                seen[next] = true;
                queue.push_back(next);
            }
        }
    }
    result
}

fn all_components(
    pixels: &PixelBuffer,
    width: u32,
    height: u32,
    progress: &mut ProgressCallback<'_>,
) -> Result<Vec<Vec<usize>>, String> {
    let mut seen = vec![false; width as usize * height as usize];
    let mut components = Vec::new();
    for y in 0..height {
        for x in 0..width {
            let start = y as usize * width as usize + x as usize;
            if seen[start] || !alpha_nonzero(pixels, start) {
                continue;
            }
            seen[start] = true;
            let mut queue = VecDeque::from([start]);
            let mut component = Vec::new();
            while let Some(index) = queue.pop_front() {
                component.push(index);
                let px = index as u32 % width;
                let py = index as u32 / width;
                for (nx, ny) in neighbors8(px, py, width, height) {
                    let next = ny as usize * width as usize + nx as usize;
                    if !seen[next] && alpha_nonzero(pixels, next) {
                        seen[next] = true;
                        queue.push_back(next);
                    }
                }
            }
            components.push(component);
        }
        if y % 16 == 0 || y + 1 == height {
            progress(
                1,
                "Mapeando diseño principal",
                (y + 1) as u64,
                height as u64,
            )?;
        }
    }
    Ok(components)
}

fn brush_indices(
    points: &[MaskPoint],
    radius: u32,
    width: u32,
    height: u32,
    pixels: &PixelBuffer,
) -> Vec<usize> {
    if points.is_empty() {
        return Vec::new();
    }
    let mut samples = Vec::new();
    for pair in points.windows(2) {
        let dx = pair[1].x - pair[0].x;
        let dy = pair[1].y - pair[0].y;
        let steps = (dx.hypot(dy) / (radius as f32 * 0.35).max(1.0))
            .ceil()
            .max(1.0) as usize;
        for step in 0..steps {
            let t = step as f32 / steps as f32;
            samples.push(MaskPoint {
                x: pair[0].x + dx * t,
                y: pair[0].y + dy * t,
            });
        }
    }
    samples.push(*points.last().unwrap());
    let mut result = Vec::new();
    let radius = radius as i32;
    for point in samples {
        let cx = point.x.round() as i32;
        let cy = point.y.round() as i32;
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                if dx * dx + dy * dy > radius * radius {
                    continue;
                }
                let x = cx + dx;
                let y = cy + dy;
                if x < 0 || y < 0 || x >= width as i32 || y >= height as i32 {
                    continue;
                }
                let index = y as usize * width as usize + x as usize;
                if alpha_nonzero(pixels, index) {
                    result.push(index);
                }
            }
        }
    }
    result
}

fn point_in_polygon(x: f32, y: f32, points: &[MaskPoint]) -> bool {
    let mut inside = false;
    let mut previous = points.len() - 1;
    for current in 0..points.len() {
        let a = points[current];
        let b = points[previous];
        if ((a.y > y) != (b.y > y)) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x {
            inside = !inside;
        }
        previous = current;
    }
    inside
}

fn neighbors8(x: u32, y: u32, width: u32, height: u32) -> impl Iterator<Item = (u32, u32)> {
    let mut values = Vec::with_capacity(8);
    for dy in -1i32..=1 {
        for dx in -1i32..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;
            if nx >= 0 && ny >= 0 && nx < width as i32 && ny < height as i32 {
                values.push((nx as u32, ny as u32));
            }
        }
    }
    values.into_iter()
}

fn nonzero_neighbors(pixels: &PixelBuffer, width: u32, height: u32, x: u32, y: u32) -> u32 {
    neighbors8(x, y, width, height)
        .filter(|(nx, ny)| alpha_nonzero(pixels, *ny as usize * width as usize + *nx as usize))
        .count() as u32
}

fn component_bounds(component: &[usize], width: u32) -> (u32, u32, u32, u32) {
    component
        .iter()
        .fold((u32::MAX, u32::MAX, 0, 0), |bounds, index| {
            let x = *index as u32 % width;
            let y = *index as u32 / width;
            (
                bounds.0.min(x),
                bounds.1.min(y),
                bounds.2.max(x),
                bounds.3.max(y),
            )
        })
}

fn bounds_distance(a: (u32, u32, u32, u32), b: (u32, u32, u32, u32)) -> u32 {
    let dx = if a.2 < b.0 {
        b.0 - a.2
    } else if b.2 < a.0 {
        a.0 - b.2
    } else {
        0
    };
    let dy = if a.3 < b.1 {
        b.1 - a.3
    } else if b.3 < a.1 {
        a.1 - b.3
    } else {
        0
    };
    dx.max(dy)
}

fn binary_region_count(mask: &[bool], width: u32, height: u32) -> u32 {
    binary_components(mask, width, height).len() as u32
}

fn binary_components(mask: &[bool], width: u32, height: u32) -> Vec<Vec<usize>> {
    let mut seen = vec![false; mask.len()];
    let mut components = Vec::new();
    for start in 0..mask.len() {
        if seen[start] || !mask[start] {
            continue;
        }
        seen[start] = true;
        let mut queue = VecDeque::from([start]);
        let mut component = Vec::new();
        while let Some(index) = queue.pop_front() {
            component.push(index);
            let x = index as u32 % width;
            let y = index as u32 / width;
            for (nx, ny) in neighbors8(x, y, width, height) {
                let next = ny as usize * width as usize + nx as usize;
                if !seen[next] && mask[next] {
                    seen[next] = true;
                    queue.push_back(next);
                }
            }
        }
        components.push(component);
    }
    components
}

fn base_rgba8(pixels: &PixelBuffer) -> Vec<u8> {
    match pixels {
        PixelBuffer::Rgba8(values) => values.clone(),
        PixelBuffer::Rgba16(values) => values.iter().map(|value| (value >> 8) as u8).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pixels(width: usize, height: usize, filled: &[(usize, usize)]) -> PixelBuffer {
        let mut rgba = vec![0u8; width * height * 4];
        for &(x, y) in filled {
            rgba[(y * width + x) * 4..(y * width + x) * 4 + 4].copy_from_slice(&[10, 20, 30, 255]);
        }
        PixelBuffer::Rgba8(rgba)
    }

    #[test]
    fn component_click_selects_whole_particle_and_undoes() {
        let image = pixels(8, 8, &[(1, 1), (1, 2), (6, 6)]);
        let mut mask = ResidueMask::new(64);
        let selected = edit_mask(
            &mut mask,
            &image,
            8,
            8,
            &MaskEdit::Component {
                x: 1,
                y: 1,
                mode: MaskMode::Add,
            },
        );
        assert_eq!(selected.selected_pixels, 2);
        let undone = edit_mask(&mut mask, &image, 8, 8, &MaskEdit::Undo);
        assert_eq!(undone.selected_pixels, 0);
        assert!(undone.can_redo);
    }

    #[test]
    fn interpolated_brush_has_no_gaps_and_subtract_overrides_auto() {
        let filled: Vec<_> = (0..20).map(|x| (x, 5)).collect();
        let image = pixels(20, 10, &filled);
        let mut mask = ResidueMask::new(200);
        edit_mask(
            &mut mask,
            &image,
            20,
            10,
            &MaskEdit::Brush {
                points: vec![MaskPoint { x: 0.0, y: 5.0 }, MaskPoint { x: 19.0, y: 5.0 }],
                radius: 1,
                mode: MaskMode::Add,
            },
        );
        assert_eq!(summary(&mask, 20, 10).selected_pixels, 20);
        mask.automatic[10 * 0 + 5 * 20] = 1;
        edit_mask(
            &mut mask,
            &image,
            20,
            10,
            &MaskEdit::Brush {
                points: vec![MaskPoint { x: 5.0, y: 5.0 }],
                radius: 1,
                mode: MaskMode::Subtract,
            },
        );
        assert!(!mask.is_selected(5 * 20 + 5));
    }
}
