use super::{
    color::{delta_e_2000, Lab},
    selection::{self, boundary_segments, labs_for_pixels},
    types::{
        BackgroundEraserRequest, BackgroundRemovalSummary, BackgroundRemovalUpdate, BackgroundView,
        BoundarySegment, CleanupSettings, MagicWandRequest, MaskTarget, OutputAlphaMode,
        RefineSettings, SelectionAction, SelectionMode, StrokeMode, StrokeRequest,
    },
};
use crate::image_engine::document::PixelBuffer;
use std::sync::Arc;

#[derive(Clone, Copy, Default, PartialEq, Eq)]
struct MaskPixel {
    selection: u8,
    foreground: u8,
    background: u8,
    never_remove: u8,
    unknown: u8,
    user_add: u8,
    user_subtract: u8,
    refined_alpha: u16,
}

#[derive(Clone)]
struct MaskChange {
    index: usize,
    before: MaskPixel,
    after: MaskPixel,
}

#[derive(Clone)]
enum MaskHistoryEntry {
    Sparse(Vec<MaskChange>),
    Ai {
        before: Option<Arc<Vec<u16>>>,
        after: Option<Arc<Vec<u16>>>,
    },
}

#[derive(Clone)]
pub struct BackgroundRemovalState {
    selection: Vec<u8>,
    foreground_lock: Vec<u8>,
    background_lock: Vec<u8>,
    never_remove: Vec<u8>,
    unknown_band: Vec<u8>,
    user_add: Vec<u8>,
    user_subtract: Vec<u8>,
    refined_alpha: Vec<u16>,
    ai_alpha: Option<Arc<Vec<u16>>>,
    mask_revision: u64,
    history: Vec<MaskHistoryEntry>,
    future: Vec<MaskHistoryEntry>,
}

impl BackgroundRemovalState {
    pub fn new(pixel_count: usize) -> Self {
        Self {
            selection: vec![0; pixel_count],
            foreground_lock: vec![0; pixel_count],
            background_lock: vec![0; pixel_count],
            never_remove: vec![0; pixel_count],
            unknown_band: vec![0; pixel_count],
            user_add: vec![0; pixel_count],
            user_subtract: vec![0; pixel_count],
            refined_alpha: vec![u16::MAX; pixel_count],
            ai_alpha: None,
            mask_revision: 0,
            history: Vec::new(),
            future: Vec::new(),
        }
    }

    pub fn ensure_len(&mut self, pixel_count: usize) {
        if self.selection.len() != pixel_count {
            *self = Self::new(pixel_count);
        }
    }

    pub fn summary(&self) -> BackgroundRemovalSummary {
        let count = |mask: &[u8]| mask.iter().filter(|value| **value != 0).count() as u64;
        let partial_alpha_pixels = (0..self.selection.len())
            .filter(|index| {
                let alpha = self.mask_alpha_without_source(*index);
                alpha > 0 && alpha < u16::MAX
            })
            .count() as u64;
        BackgroundRemovalSummary {
            mask_revision: self.mask_revision,
            ai_mask_active: self.ai_alpha.is_some(),
            selected_pixels: count(&self.selection),
            foreground_locked_pixels: count(&self.foreground_lock),
            background_locked_pixels: count(&self.background_lock),
            never_remove_pixels: count(&self.never_remove),
            unknown_pixels: count(&self.unknown_band),
            user_added_pixels: count(&self.user_add),
            user_subtracted_pixels: count(&self.user_subtract),
            partial_alpha_pixels,
            can_undo: !self.history.is_empty(),
            can_redo: !self.future.is_empty(),
        }
    }

    pub fn magic_wand(
        &mut self,
        pixels: &PixelBuffer,
        width: u32,
        height: u32,
        request: &MagicWandRequest,
    ) -> BackgroundRemovalUpdate {
        self.ensure_len(width as usize * height as usize);
        let blocked: Vec<bool> = self
            .never_remove
            .iter()
            .zip(&self.foreground_lock)
            .map(|(never, foreground)| *never != 0 || *foreground != 0)
            .collect();
        let candidate = selection::magic_wand_mask(
            pixels,
            width,
            height,
            request.x,
            request.y,
            &request.settings,
            &blocked,
        );
        self.apply_selection(&candidate, request.mode)
    }

    pub fn select_from_borders(
        &mut self,
        pixels: &PixelBuffer,
        width: u32,
        height: u32,
        settings: &super::types::WandSettings,
    ) -> BackgroundRemovalUpdate {
        self.ensure_len(width as usize * height as usize);
        let blocked: Vec<bool> = self
            .never_remove
            .iter()
            .zip(&self.foreground_lock)
            .map(|(never, foreground)| *never != 0 || *foreground != 0)
            .collect();
        let seeds = [
            (0, 0),
            (width.saturating_sub(1), 0),
            (0, height.saturating_sub(1)),
            (width.saturating_sub(1), height.saturating_sub(1)),
        ];
        let candidate = selection::magic_wand_mask_from_seeds(
            pixels, width, height, &seeds, settings, &blocked,
        );
        self.apply_selection(&candidate, SelectionMode::New)
    }

    pub fn selection_action(
        &mut self,
        action: SelectionAction,
        radius: u32,
        width: u32,
        height: u32,
    ) -> BackgroundRemovalUpdate {
        self.ensure_len(width as usize * height as usize);
        if action == SelectionAction::Delete {
            return self.delete_selection();
        }
        let candidate = match action {
            SelectionAction::SelectAll => vec![255; self.selection.len()],
            SelectionAction::Clear => vec![0; self.selection.len()],
            SelectionAction::Invert => self
                .selection
                .iter()
                .map(|value| if *value == 0 { 255 } else { 0 })
                .collect(),
            SelectionAction::Expand => {
                selection::dilate(&self.selection, width, height, radius.max(1))
            }
            SelectionAction::Contract => {
                selection::erode(&self.selection, width, height, radius.max(1))
            }
            SelectionAction::Smooth => {
                selection::smooth(&self.selection, width, height, radius.max(1))
            }
            SelectionAction::Delete => unreachable!(),
        };
        self.apply_selection(&candidate, SelectionMode::New)
    }

    fn delete_selection(&mut self) -> BackgroundRemovalUpdate {
        let truncated = (0..self.selection.len())
            .filter(|index| {
                self.selection[*index] != 0
                    && (self.never_remove[*index] != 0 || self.foreground_lock[*index] != 0)
            })
            .count() as u64;
        let changed = self.commit(0..self.selection.len(), |pixel, _| {
            if pixel.selection == 0 {
                return;
            }
            if pixel.never_remove == 0 && pixel.foreground == 0 {
                pixel.user_subtract = 255;
                pixel.user_add = 0;
            }
            pixel.selection = 0;
        });
        self.update(changed, truncated)
    }

    fn apply_selection(
        &mut self,
        candidate: &[u8],
        mode: SelectionMode,
    ) -> BackgroundRemovalUpdate {
        let indices = 0..self.selection.len();
        let changed = self.commit(indices, |pixel, index| {
            let selected = candidate.get(index).copied().unwrap_or(0) != 0;
            pixel.selection = match mode {
                SelectionMode::New => u8::from(selected) * 255,
                SelectionMode::Add => u8::from(pixel.selection != 0 || selected) * 255,
                SelectionMode::Subtract => u8::from(pixel.selection != 0 && !selected) * 255,
                SelectionMode::Intersect => u8::from(pixel.selection != 0 && selected) * 255,
            };
        });
        self.update(changed, 0)
    }

    pub fn apply_stroke(
        &mut self,
        request: &StrokeRequest,
        width: u32,
        height: u32,
    ) -> BackgroundRemovalUpdate {
        self.ensure_len(width as usize * height as usize);
        let indices = selection::stroke_indices(&request.points, request.radius, width, height);
        let mut truncated = 0_u64;
        let target = request.target;
        let mode = request.mode;
        let strength = (request.opacity.clamp(0.0, 1.0) * 255.0).round() as u8;
        let changed = self.commit(indices, |pixel, _| {
            let protected = pixel.never_remove != 0 || pixel.foreground != 0;
            if protected
                && matches!(
                    target,
                    MaskTarget::BackgroundLock | MaskTarget::UserSubtract
                )
                && mode == StrokeMode::Paint
            {
                truncated += 1;
                return;
            }
            let value = if mode == StrokeMode::Paint {
                strength.max(1)
            } else {
                0
            };
            match target {
                MaskTarget::ForegroundLock => pixel.foreground = value,
                MaskTarget::BackgroundLock => pixel.background = value,
                MaskTarget::NeverRemove => pixel.never_remove = value,
                MaskTarget::UnknownBand => {
                    pixel.unknown = value;
                    if value == 0 {
                        pixel.refined_alpha = u16::MAX;
                    }
                }
                MaskTarget::UserAdd => {
                    pixel.user_add = value;
                    if value != 0 {
                        pixel.user_subtract = 0;
                        pixel.selection = 0;
                    }
                }
                MaskTarget::UserSubtract => {
                    pixel.user_subtract = value;
                    if value != 0 {
                        pixel.user_add = 0;
                        pixel.selection = 255;
                    }
                }
            }
        });
        self.update(changed, truncated)
    }

    pub fn background_eraser(
        &mut self,
        pixels: &PixelBuffer,
        request: &BackgroundEraserRequest,
        width: u32,
        height: u32,
    ) -> BackgroundRemovalUpdate {
        self.ensure_len(width as usize * height as usize);
        let Some(seed_point) = request.points.first() else {
            return self.update(0, 0);
        };
        let seed_x = seed_point
            .x
            .floor()
            .clamp(0.0, width.saturating_sub(1) as f32) as usize;
        let seed_y = seed_point
            .y
            .floor()
            .clamp(0.0, height.saturating_sub(1) as f32) as usize;
        let seed_index = seed_y * width as usize + seed_x;
        let labs = labs_for_pixels(pixels);
        let seed = labs[seed_index];
        let continuous_samples: Vec<(f32, f32, Lab)> = if request.sampling_once {
            Vec::new()
        } else {
            request
                .points
                .iter()
                .map(|point| {
                    let x = point.x.floor().clamp(0.0, width.saturating_sub(1) as f32) as usize;
                    let y = point.y.floor().clamp(0.0, height.saturating_sub(1) as f32) as usize;
                    (point.x, point.y, labs[y * width as usize + x])
                })
                .collect()
        };
        let indices = selection::stroke_indices(&request.points, request.radius, width, height);
        let mut truncated = 0_u64;
        let tolerance = request.tolerance.max(0.1);
        let strength = (request.opacity.clamp(0.0, 1.0) * 255.0).round() as u8;
        let changed = self.commit(indices, |pixel, index| {
            if (pixel.never_remove != 0 || pixel.foreground != 0) && request.protect_foreground {
                truncated += 1;
                return;
            }
            let reference = if continuous_samples.is_empty() {
                seed
            } else {
                let x = (index % width as usize) as f32;
                let y = (index / width as usize) as f32;
                continuous_samples
                    .iter()
                    .min_by(|left, right| {
                        ((left.0 - x).powi(2) + (left.1 - y).powi(2))
                            .total_cmp(&((right.0 - x).powi(2) + (right.1 - y).powi(2)))
                    })
                    .map(|sample| sample.2)
                    .unwrap_or(seed)
            };
            let distance = delta_e_2000(reference, labs[index]);
            let edge_penalty = if request.find_edges {
                (reference.l - labs[index].l).abs() * 0.18
            } else {
                0.0
            };
            if distance + edge_penalty <= tolerance {
                pixel.user_subtract = strength.max(1);
                pixel.user_add = 0;
                pixel.selection = 255;
            }
        });
        self.update(changed, truncated)
    }

    pub fn generate_unknown_band(
        &mut self,
        radius: u32,
        width: u32,
        height: u32,
    ) -> BackgroundRemovalUpdate {
        let grown = selection::dilate(&self.selection, width, height, radius.max(1));
        let contracted = selection::erode(&self.selection, width, height, radius.max(1));
        let band: Vec<u8> = grown
            .iter()
            .zip(&contracted)
            .map(|(outer, inner)| if *outer != *inner { 255 } else { 0 })
            .collect();
        let changed = self.commit(0..self.selection.len(), |pixel, index| {
            pixel.unknown = band[index];
            if band[index] == 0 {
                pixel.refined_alpha = u16::MAX;
            }
        });
        self.update(changed, 0)
    }

    pub fn refine_edge(
        &mut self,
        pixels: &PixelBuffer,
        settings: &RefineSettings,
        width: u32,
        height: u32,
    ) -> BackgroundRemovalUpdate {
        self.ensure_len(width as usize * height as usize);
        if self.unknown_band.iter().all(|value| *value == 0) {
            let _ = self.generate_unknown_band(settings.radius, width, height);
        }
        let labs = labs_for_pixels(pixels);
        let foreground_reference = average_lab(&labs, |index| {
            self.never_remove[index] != 0
                || self.foreground_lock[index] != 0
                || self.user_add[index] != 0
        })
        .or_else(|| average_lab(&labs, |index| self.selection[index] == 0))
        .unwrap_or_default();
        let background_reference = average_lab(&labs, |index| {
            self.background_lock[index] != 0 || self.user_subtract[index] != 0
        })
        .or_else(|| average_lab(&labs, |index| self.selection[index] != 0))
        .unwrap_or_default();
        let sensitivity = settings.sensitivity.clamp(1.0, 100.0) / 100.0;
        let contrast = 1.0 + settings.contrast.clamp(-90.0, 100.0) / 100.0;
        let changed = self.commit(0..self.selection.len(), |pixel, index| {
            if pixel.unknown == 0
                || pixel.never_remove != 0
                || pixel.foreground != 0
                || pixel.background != 0
            {
                return;
            }
            let foreground_distance = delta_e_2000(labs[index], foreground_reference).max(0.001);
            let background_distance = delta_e_2000(labs[index], background_reference).max(0.001);
            let subject_probability =
                (background_distance / (foreground_distance + background_distance)).clamp(0.0, 1.0);
            let adjusted = (((subject_probability - 0.5) * contrast + 0.5) * sensitivity
                + subject_probability * (1.0 - sensitivity))
                .clamp(0.0, 1.0);
            pixel.refined_alpha = (adjusted * u16::MAX as f32).round() as u16;
            pixel.selection = if adjusted < 0.5 { 255 } else { 0 };
        });
        self.update(changed, 0)
    }

    pub fn cleanup(
        &mut self,
        settings: &CleanupSettings,
        width: u32,
        height: u32,
    ) -> BackgroundRemovalUpdate {
        let mut candidate = self.selection.clone();
        if settings.remove_islands {
            candidate = selection::remove_small_components(
                &candidate,
                width,
                height,
                settings.minimum_particle_size.max(1),
            );
        }
        if settings.fill_holes {
            candidate = selection::fill_small_holes(
                &candidate,
                width,
                height,
                settings.minimum_particle_size.max(1),
            );
        }
        self.apply_selection(&candidate, SelectionMode::New)
    }

    pub fn apply_ai_alpha(&mut self, alpha: Vec<u16>) -> Result<BackgroundRemovalUpdate, String> {
        if alpha.len() != self.selection.len() {
            return Err(format!(
                "La máscara de IA tiene {} píxeles y el documento {}",
                alpha.len(),
                self.selection.len()
            ));
        }
        let before = self.ai_alpha.clone();
        let after = Arc::new(alpha);
        let changed = after
            .iter()
            .enumerate()
            .filter(|(index, value)| {
                before
                    .as_ref()
                    .map(|mask| mask[*index])
                    .unwrap_or(u16::MAX)
                    != **value
            })
            .count() as u64;
        if changed > 0 {
            self.ai_alpha = Some(after.clone());
            self.history.push(MaskHistoryEntry::Ai { before, after: Some(after) });
            self.future.clear();
            if self.history.len() > 40 {
                self.history.remove(0);
            }
            self.mask_revision = self.mask_revision.saturating_add(1);
        }
        Ok(self.update(changed, 0))
    }

    pub fn undo(&mut self) -> BackgroundRemovalUpdate {
        let Some(entry) = self.history.pop() else {
            return self.update(0, 0);
        };
        let changed = match &entry {
            MaskHistoryEntry::Sparse(changes) => {
                for change in changes {
                    self.set_pixel(change.index, change.before);
                }
                changes.len() as u64
            }
            MaskHistoryEntry::Ai { before, after } => {
                let changed = alpha_difference(before.as_deref(), after.as_deref(), self.selection.len());
                self.ai_alpha = before.clone();
                changed
            }
        };
        self.future.push(entry);
        self.mask_revision = self.mask_revision.saturating_add(1);
        BackgroundRemovalUpdate {
            summary: self.summary(),
            changed_pixels: changed,
            truncated_by_protection: 0,
        }
    }

    pub fn redo(&mut self) -> BackgroundRemovalUpdate {
        let Some(entry) = self.future.pop() else {
            return self.update(0, 0);
        };
        let changed = match &entry {
            MaskHistoryEntry::Sparse(changes) => {
                for change in changes {
                    self.set_pixel(change.index, change.after);
                }
                changes.len() as u64
            }
            MaskHistoryEntry::Ai { before, after } => {
                let changed = alpha_difference(before.as_deref(), after.as_deref(), self.selection.len());
                self.ai_alpha = after.clone();
                changed
            }
        };
        self.history.push(entry);
        self.mask_revision = self.mask_revision.saturating_add(1);
        BackgroundRemovalUpdate {
            summary: self.summary(),
            changed_pixels: changed,
            truncated_by_protection: 0,
        }
    }

    pub fn contours(&self, width: u32, height: u32) -> Vec<BoundarySegment> {
        boundary_segments(&self.selection, width, height, 200_000)
    }

    pub fn overlay_rgba8(
        &self,
        pixels: &PixelBuffer,
        view: BackgroundView,
        mode: OutputAlphaMode,
    ) -> Vec<u8> {
        let mut rgba = pixels_to_rgba8(pixels);
        for index in 0..self.selection.len() {
            let offset = index * 4;
            match view {
                BackgroundView::Selection => set_overlay(
                    &mut rgba,
                    offset,
                    self.selection[index] != 0,
                    [45, 145, 255, 95],
                ),
                BackgroundView::QuickMask => set_overlay(
                    &mut rgba,
                    offset,
                    self.selection[index] != 0,
                    [224, 38, 102, 125],
                ),
                BackgroundView::Protections => {
                    let color = if self.never_remove[index] != 0 {
                        Some([28, 255, 130, 190])
                    } else if self.foreground_lock[index] != 0 {
                        Some([38, 205, 115, 145])
                    } else if self.background_lock[index] != 0 {
                        Some([255, 48, 65, 145])
                    } else if self.user_add[index] != 0 {
                        Some([65, 205, 255, 120])
                    } else if self.user_subtract[index] != 0 {
                        Some([255, 115, 65, 120])
                    } else {
                        None
                    };
                    if let Some(color) = color {
                        rgba[offset..offset + 4].copy_from_slice(&color);
                    } else {
                        rgba[offset + 3] = 0;
                    }
                }
                BackgroundView::UnknownBand => set_overlay(
                    &mut rgba,
                    offset,
                    self.unknown_band[index] != 0,
                    [190, 70, 255, 135],
                ),
                BackgroundView::Mask | BackgroundView::Alpha => {
                    let source_alpha = source_alpha_u16(pixels, index);
                    let alpha = self.final_alpha_u16(index, source_alpha, mode);
                    let value = (alpha >> 8) as u8;
                    rgba[offset..offset + 4].copy_from_slice(&[value, value, value, 255]);
                }
                BackgroundView::Result
                | BackgroundView::ResultWhite
                | BackgroundView::ResultBlack
                | BackgroundView::ResultGray => {
                    let source_alpha = source_alpha_u16(pixels, index);
                    rgba[offset + 3] = (self.final_alpha_u16(index, source_alpha, mode) >> 8) as u8;
                }
            }
        }
        rgba
    }

    pub fn result_pixels(&self, pixels: &PixelBuffer, mode: OutputAlphaMode) -> PixelBuffer {
        let mut result = pixels.clone();
        match &mut result {
            PixelBuffer::Rgba8(values) => {
                for index in 0..self.selection.len() {
                    let source_alpha = values[index * 4 + 3] as u16 * 257;
                    values[index * 4 + 3] =
                        (self.final_alpha_u16(index, source_alpha, mode) >> 8) as u8;
                }
            }
            PixelBuffer::Rgba16(values) => {
                for index in 0..self.selection.len() {
                    let source_alpha = values[index * 4 + 3];
                    values[index * 4 + 3] = self.final_alpha_u16(index, source_alpha, mode);
                }
            }
        }
        result
    }

    pub fn final_alpha_u16(&self, index: usize, source_alpha: u16, mode: OutputAlphaMode) -> u16 {
        let mask_alpha = self.mask_alpha_without_source(index);
        let natural = if self.never_remove[index] != 0 || self.foreground_lock[index] != 0 {
            source_alpha.max(mask_alpha)
        } else if self.user_add[index] != 0 {
            source_alpha.max(mask_alpha)
        } else {
            ((source_alpha as u32 * mask_alpha as u32) / u16::MAX as u32) as u16
        };
        match mode {
            OutputAlphaMode::Natural => natural,
            OutputAlphaMode::SolidDtf => {
                if natural >= u16::MAX / 2 {
                    u16::MAX
                } else {
                    0
                }
            }
        }
    }

    fn mask_alpha_without_source(&self, index: usize) -> u16 {
        if self.never_remove[index] != 0 || self.foreground_lock[index] != 0 {
            u16::MAX
        } else if self.background_lock[index] != 0 {
            0
        } else if self.user_add[index] != 0 {
            self.refined_alpha[index]
        } else if self.user_subtract[index] != 0 {
            0
        } else if self.unknown_band[index] != 0 {
            self.refined_alpha[index]
        } else if self.selection[index] != 0 {
            0
        } else if let Some(ai_alpha) = &self.ai_alpha {
            ai_alpha[index]
        } else {
            u16::MAX
        }
    }

    fn commit<I, F>(&mut self, indices: I, mut update: F) -> u64
    where
        I: IntoIterator<Item = usize>,
        F: FnMut(&mut MaskPixel, usize),
    {
        let mut changes = Vec::new();
        for index in indices {
            if index >= self.selection.len() {
                continue;
            }
            let before = self.pixel(index);
            let mut after = before;
            update(&mut after, index);
            if before != after {
                self.set_pixel(index, after);
                changes.push(MaskChange {
                    index,
                    before,
                    after,
                });
            }
        }
        let changed = changes.len() as u64;
        if !changes.is_empty() {
            self.history.push(MaskHistoryEntry::Sparse(changes));
            self.future.clear();
            if self.history.len() > 40 {
                self.history.remove(0);
            }
            self.mask_revision = self.mask_revision.saturating_add(1);
        }
        changed
    }

    fn update(&self, changed_pixels: u64, truncated_by_protection: u64) -> BackgroundRemovalUpdate {
        BackgroundRemovalUpdate {
            summary: self.summary(),
            changed_pixels,
            truncated_by_protection,
        }
    }

    fn pixel(&self, index: usize) -> MaskPixel {
        MaskPixel {
            selection: self.selection[index],
            foreground: self.foreground_lock[index],
            background: self.background_lock[index],
            never_remove: self.never_remove[index],
            unknown: self.unknown_band[index],
            user_add: self.user_add[index],
            user_subtract: self.user_subtract[index],
            refined_alpha: self.refined_alpha[index],
        }
    }

    fn set_pixel(&mut self, index: usize, pixel: MaskPixel) {
        self.selection[index] = pixel.selection;
        self.foreground_lock[index] = pixel.foreground;
        self.background_lock[index] = pixel.background;
        self.never_remove[index] = pixel.never_remove;
        self.unknown_band[index] = pixel.unknown;
        self.user_add[index] = pixel.user_add;
        self.user_subtract[index] = pixel.user_subtract;
        self.refined_alpha[index] = pixel.refined_alpha;
    }
}

fn alpha_difference(before: Option<&Vec<u16>>, after: Option<&Vec<u16>>, len: usize) -> u64 {
    (0..len)
        .filter(|index| {
            before.map(|mask| mask[*index]).unwrap_or(u16::MAX)
                != after.map(|mask| mask[*index]).unwrap_or(u16::MAX)
        })
        .count() as u64
}

fn average_lab(labs: &[Lab], include: impl Fn(usize) -> bool) -> Option<Lab> {
    let mut total = Lab::default();
    let mut count = 0_f32;
    for (index, lab) in labs.iter().copied().enumerate() {
        if include(index) {
            total.l += lab.l;
            total.a += lab.a;
            total.b += lab.b;
            count += 1.0;
        }
    }
    (count > 0.0).then_some(Lab {
        l: total.l / count,
        a: total.a / count,
        b: total.b / count,
    })
}

fn pixels_to_rgba8(pixels: &PixelBuffer) -> Vec<u8> {
    match pixels {
        PixelBuffer::Rgba8(values) => values.clone(),
        PixelBuffer::Rgba16(values) => values.iter().map(|value| (value >> 8) as u8).collect(),
    }
}

fn source_alpha_u16(pixels: &PixelBuffer, index: usize) -> u16 {
    match pixels {
        PixelBuffer::Rgba8(values) => values[index * 4 + 3] as u16 * 257,
        PixelBuffer::Rgba16(values) => values[index * 4 + 3],
    }
}

fn set_overlay(rgba: &mut [u8], offset: usize, active: bool, color: [u8; 4]) {
    if active {
        rgba[offset..offset + 4].copy_from_slice(&color);
    } else {
        rgba[offset + 3] = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::background_removal::types::{MaskPoint, StrokeRequest};

    #[test]
    fn never_remove_has_absolute_priority_over_background_and_selection() {
        let mut state = BackgroundRemovalState::new(1);
        state.selection[0] = 255;
        state.background_lock[0] = 255;
        state.never_remove[0] = 255;
        assert_eq!(
            state.final_alpha_u16(0, 10_000, OutputAlphaMode::Natural),
            u16::MAX
        );
    }

    #[test]
    fn protected_stroke_truncates_background_paint() {
        let mut state = BackgroundRemovalState::new(9);
        state.never_remove[4] = 255;
        let update = state.apply_stroke(
            &StrokeRequest {
                target: MaskTarget::BackgroundLock,
                mode: StrokeMode::Paint,
                points: vec![MaskPoint { x: 1.5, y: 1.5 }],
                radius: 1,
                opacity: 1.0,
            },
            3,
            3,
        );
        assert!(update.truncated_by_protection >= 1);
        assert_eq!(state.background_lock[4], 0);
    }

    #[test]
    fn undo_and_redo_restore_mask_delta() {
        let mut state = BackgroundRemovalState::new(4);
        state.selection_action(SelectionAction::SelectAll, 1, 2, 2);
        assert_eq!(state.summary().selected_pixels, 4);
        state.undo();
        assert_eq!(state.summary().selected_pixels, 0);
        state.redo();
        assert_eq!(state.summary().selected_pixels, 4);
    }

    #[test]
    fn deleting_selection_accumulates_transparency_and_clears_the_active_border() {
        let mut state = BackgroundRemovalState::new(3);
        state.selection[0] = 255;
        state.selection_action(SelectionAction::Delete, 1, 3, 1);
        assert_eq!(state.summary().selected_pixels, 0);
        assert_eq!(state.summary().user_subtracted_pixels, 1);

        state.selection[2] = 255;
        state.selection_action(SelectionAction::Delete, 1, 3, 1);
        assert_eq!(state.summary().selected_pixels, 0);
        assert_eq!(state.summary().user_subtracted_pixels, 2);
        assert_eq!(
            state.final_alpha_u16(0, u16::MAX, OutputAlphaMode::Natural),
            0
        );
        assert_eq!(
            state.final_alpha_u16(2, u16::MAX, OutputAlphaMode::Natural),
            0
        );
    }

    #[test]
    fn deleting_selection_never_erases_protected_pixels() {
        let mut state = BackgroundRemovalState::new(2);
        state.selection.fill(255);
        state.never_remove[0] = 255;
        let update = state.selection_action(SelectionAction::Delete, 1, 2, 1);
        assert_eq!(update.truncated_by_protection, 1);
        assert_eq!(state.summary().selected_pixels, 0);
        assert_eq!(state.user_subtract, vec![0, 255]);
    }

    #[test]
    fn background_eraser_is_color_aware_and_respects_never_remove() {
        let pixels = PixelBuffer::Rgba8(vec![
            255, 255, 255, 255, 220, 20, 20, 255, 255, 255, 255, 255,
        ]);
        let mut state = BackgroundRemovalState::new(3);
        state.never_remove[2] = 255;
        let update = state.background_eraser(
            &pixels,
            &crate::background_removal::types::BackgroundEraserRequest {
                points: vec![MaskPoint { x: 0.5, y: 0.5 }, MaskPoint { x: 2.5, y: 0.5 }],
                radius: 1,
                tolerance: 4.0,
                opacity: 1.0,
                find_edges: true,
                protect_foreground: true,
                sampling_once: true,
            },
            3,
            1,
        );
        assert_ne!(state.user_subtract[0], 0);
        assert_eq!(state.user_subtract[1], 0);
        assert_eq!(state.user_subtract[2], 0);
        assert!(update.truncated_by_protection >= 1);
    }

    #[test]
    fn ai_alpha_is_non_destructive_and_undoable_without_sparse_pixel_history() {
        let mut state = BackgroundRemovalState::new(3);
        let update = state
            .apply_ai_alpha(vec![0, u16::MAX / 2, u16::MAX])
            .expect("máscara IA");
        assert!(update.summary.ai_mask_active);
        assert_eq!(update.summary.partial_alpha_pixels, 1);
        assert_eq!(
            state.final_alpha_u16(0, u16::MAX, OutputAlphaMode::Natural),
            0
        );
        assert_eq!(
            state.final_alpha_u16(1, u16::MAX, OutputAlphaMode::Natural),
            u16::MAX / 2
        );
        state.undo();
        assert!(!state.summary().ai_mask_active);
        assert_eq!(
            state.final_alpha_u16(0, u16::MAX, OutputAlphaMode::Natural),
            u16::MAX
        );
        state.redo();
        assert!(state.summary().ai_mask_active);
    }
}
