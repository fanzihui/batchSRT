pub mod local_model;
pub mod online_api;
pub mod online_mock;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn transcribe_audio(file_path: String) -> Result<String, String> {
    // 这是一个基本的IPC命令示例，用于处理音频转文本的请求
    // 实际实现将在这里调用转录服务
    Ok(format!(
        "Successfully received audio file for processing: {}",
        file_path
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            transcribe_audio,
            online_mock::upload_audio_online,
            online_mock::poll_task_mock,
            online_mock::check_site_health,
            local_model::download_dependency,
            local_model::validate_local_executable,
            local_model::read_audio_source,
            local_model::run_local_model,
            online_api::whisper_api_transcribe
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
