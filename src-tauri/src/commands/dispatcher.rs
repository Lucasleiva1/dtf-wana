use crate::application::command_bus::{ApplicationCommandBus, CommandRequest, CommandResult};

#[tauri::command]
pub fn dispatch_command(request: CommandRequest) -> CommandResult {
    ApplicationCommandBus.execute(request)
}
