mod alpha_engine;
mod application;
mod commands;
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
            commands::residue::edit_residue_mask,
            commands::residue::get_residue_mask_tile,
            commands::residue::get_residue_mask_bytes,
            commands::residue::get_residue_mask_summary,
            commands::jobs::start_alpha_analysis_job,
            commands::jobs::start_alpha_preview_job,
            commands::jobs::start_alpha_treatment_job,
            commands::jobs::start_export_job,
            commands::jobs::start_residue_cleanup_job,
            commands::jobs::start_apply_residue_job,
            commands::jobs::get_job_status,
            commands::jobs::cancel_job,
            commands::jobs::get_job_binary
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar DTF Pro Studio");
}
