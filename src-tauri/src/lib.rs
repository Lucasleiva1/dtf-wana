mod alpha_engine;
mod application;
mod background_removal;
mod commands;
mod edge_polish_engine;
mod image_engine;
mod residue_engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(application::state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::dispatcher::dispatch_command,
            commands::document::upload_document_bytes,
            commands::document::get_document_preview,
            commands::document::close_document,
            commands::document::read_dropped_image,
            commands::document::scan_image_folder,
            commands::document::read_batch_thumbnail,
            commands::residue::edit_residue_mask,
            commands::residue::get_residue_mask_tile,
            commands::residue::get_residue_mask_bytes,
            commands::residue::get_residue_mask_summary,
            commands::background_removal::background_get_state,
            commands::background_removal::background_magic_wand,
            commands::background_removal::background_select_from_borders,
            commands::background_removal::background_selection_action,
            commands::background_removal::background_apply_stroke,
            commands::background_removal::background_eraser_stroke,
            commands::background_removal::background_generate_unknown_band,
            commands::background_removal::background_refine_edge,
            commands::background_removal::background_cleanup,
            commands::background_removal::background_undo,
            commands::background_removal::background_redo,
            commands::background_removal::background_get_overlay,
            commands::background_removal::background_get_contours,
            commands::background_removal::start_background_export_job,
            commands::background_removal::background_model_status,
            commands::jobs::start_alpha_analysis_job,
            commands::jobs::start_alpha_preview_job,
            commands::jobs::start_alpha_treatment_job,
            commands::jobs::start_export_job,
            commands::jobs::start_residue_cleanup_job,
            commands::jobs::start_apply_residue_job,
            commands::jobs::start_edge_polish_preview_job,
            commands::jobs::start_edge_polish_apply_job,
            commands::jobs::get_job_status,
            commands::jobs::cancel_job,
            commands::jobs::get_job_binary
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar DTF Pro Studio");
}
