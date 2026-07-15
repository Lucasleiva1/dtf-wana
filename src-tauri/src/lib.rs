mod application;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::dispatcher::dispatch_command])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar DTF Pro Studio");
}
