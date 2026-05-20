use futures::StreamExt;
use serde::{Deserialize, Serialize};
use base64::{engine::general_purpose, Engine as _};
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize)]
struct DownloadProgress {
    filename: String,
    downloaded: u64,
    total: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TranscriptionResult {
    pub srt: String,
    pub txt: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AudioSource {
    pub mime: String,
    pub data: String,
}

#[tauri::command]
pub async fn download_dependency(
    app: AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("下载失败，HTTP {}", response.status()));
    }

    let total = response.content_length();
    let mut downloaded = 0;
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    let file_path = app_dir.join(&filename);
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        let _ = app.emit(
            "download_progress",
            DownloadProgress {
                filename: filename.clone(),
                downloaded,
                total,
            },
        );
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn validate_local_executable(executable_path: String) -> Result<(), String> {
    validate_windows_executable(&executable_path)
}

#[tauri::command]
pub async fn read_audio_source(file_path: String) -> Result<AudioSource, String> {
    validate_file_exists(&file_path, "音频文件")?;
    let bytes = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("读取音频文件失败: {e}"))?;
    let mime = audio_mime_from_path(&file_path);

    Ok(AudioSource {
        mime: mime.to_string(),
        data: general_purpose::STANDARD.encode(bytes),
    })
}

#[tauri::command]
pub async fn run_local_model(
    executable_path: String,
    model_path: String,
    audio_path: String,
) -> Result<TranscriptionResult, String> {
    validate_windows_executable(&executable_path)?;
    validate_file_exists(&model_path, "模型文件")?;
    validate_file_exists(&audio_path, "音频文件")?;

    let output = Command::new(&executable_path)
        .arg("-m")
        .arg(&model_path)
        .arg("-f")
        .arg(&audio_path)
        .arg("-osrt")
        .arg("-otxt")
        .output()
        .map_err(|e| {
            if e.raw_os_error() == Some(216) {
                "该程序不能在当前 Windows 上运行。请重新选择 whisper.cpp 的 Windows x64 可执行文件，例如 whisper-cli.exe 或 main.exe。".to_string()
            } else {
                format!("启动本地模型失败: {e}")
            }
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let message = if stderr.is_empty() { stdout } else { stderr };
        return Err(format!("本地模型执行失败: {message}"));
    }

    let srt_path = format!("{}.srt", audio_path);
    let txt_path = format!("{}.txt", audio_path);
    let srt_content = std::fs::read_to_string(&srt_path)
        .unwrap_or_else(|_| String::from_utf8_lossy(&output.stdout).to_string());
    let txt_content =
        std::fs::read_to_string(&txt_path).unwrap_or_else(|_| srt_to_paragraph_txt(&srt_content));

    let _ = std::fs::remove_file(&srt_path);
    let _ = std::fs::remove_file(&txt_path);

    Ok(TranscriptionResult {
        srt: srt_content,
        txt: txt_content,
    })
}

fn validate_file_exists(path: &str, label: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err(format!("{label}路径不能为空"));
    }
    if !Path::new(path).is_file() {
        return Err(format!("{label}不存在: {path}"));
    }
    Ok(())
}

fn validate_windows_executable(path: &str) -> Result<(), String> {
    validate_file_exists(path, "本地模型程序")?;

    if cfg!(target_os = "windows") {
        let extension = Path::new(path)
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if !extension.eq_ignore_ascii_case("exe") {
            return Err("本地模型程序必须是 .exe 文件。".to_string());
        }

        let mut file = File::open(path).map_err(|e| format!("无法打开本地模型程序: {e}"))?;
        let mut magic = [0_u8; 2];
        file.read_exact(&mut magic)
            .map_err(|e| format!("无法读取本地模型程序: {e}"))?;

        if magic != [b'M', b'Z'] {
            return Err(
                "本地模型程序不是有效的 Windows 可执行文件。旧版本可能把下载失败的文本保存成了 whisper.exe，已不再使用该文件。请重新选择真正的 whisper.cpp exe 文件。"
                    .to_string(),
            );
        }
    }

    Ok(())
}

fn audio_mime_from_path(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "mp4" => "video/mp4",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "ogg" => "audio/ogg",
        "webm" => "audio/webm",
        _ => "application/octet-stream",
    }
}

fn srt_to_paragraph_txt(srt: &str) -> String {
    let mut txt = String::new();
    let mut current_paragraph = String::new();
    let mut sentence_count = 0;

    for line in srt.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.parse::<i32>().is_ok() || trimmed.contains("-->") {
            continue;
        }

        if !current_paragraph.is_empty() {
            current_paragraph.push(' ');
        }
        current_paragraph.push_str(trimmed);
        sentence_count += 1;

        if sentence_count >= 5
            || trimmed.ends_with('.')
            || trimmed.ends_with('。')
            || trimmed.ends_with('!')
            || trimmed.ends_with('！')
            || trimmed.ends_with('?')
            || trimmed.ends_with('？')
        {
            txt.push_str(&current_paragraph);
            txt.push_str("\n\n");
            current_paragraph.clear();
            sentence_count = 0;
        }
    }

    if !current_paragraph.is_empty() {
        txt.push_str(&current_paragraph);
        txt.push('\n');
    }

    txt.trim().to_string()
}
