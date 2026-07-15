mod alpha_engine;
mod application;
mod commands;
mod image_engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(application::state::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::dispatcher::dispatch_command,
            commands::document::upload_document_bytes,
            commands::document::get_document_preview
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar DTF Pro Studio");
}
