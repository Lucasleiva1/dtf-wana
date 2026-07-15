use tauri::State;

use crate::application::{command_bus::{ApplicationCommandBus, CommandRequest, CommandResult}, state::AppState};

#[tauri::command]
pub async fn dispatch_command(request: CommandRequest, state: State<'_, AppState>) -> Result<CommandResult, String> {
    let state = state.inner().clone();
    match tauri::async_runtime::spawn_blocking(move || ApplicationCommandBus.execute(&state, request)).await {
        Ok(result) => Ok(result),
        Err(error) => Ok(CommandResult::failure("internal".into(), "TASK_FAILED", &format!("Falló la tarea: {error}"), true)),
    }
}
