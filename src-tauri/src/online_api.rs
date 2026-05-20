use reqwest::multipart;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TranscriptionResult {
    pub srt: String,
    pub txt: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiTranscriptionConfig {
    pub provider_name: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub language: String,
    pub prompt: String,
    pub temperature: String,
    pub timeout_seconds: String,
}

#[tauri::command]
pub async fn whisper_api_transcribe(
    config: ApiTranscriptionConfig,
    file_path: String,
) -> Result<TranscriptionResult, String> {
    if config.base_url.trim().is_empty() {
        return Err("在线模型接口地址不能为空".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("在线模型名称不能为空".to_string());
    }

    let timeout_seconds = config.timeout_seconds.parse::<u64>().unwrap_or(120).max(10);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|e| e.to_string())?;

    let file_content = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("无法读取音频文件: {e}"))?;

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();

    let part = multipart::Part::bytes(file_content)
        .file_name(filename)
        .mime_str("audio/mpeg")
        .map_err(|e| e.to_string())?;

    let mut form = multipart::Form::new()
        .part("file", part)
        .text("model", config.model.trim().to_string())
        .text("response_format", "srt".to_string());

    if !config.language.trim().is_empty() {
        form = form.text("language", config.language.trim().to_string());
    }
    if !config.prompt.trim().is_empty() {
        form = form.text("prompt", config.prompt);
    }
    if !config.temperature.trim().is_empty() {
        form = form.text("temperature", config.temperature);
    }

    let mut request = client.post(config.base_url.trim()).multipart(form);
    if !config.api_key.trim().is_empty() {
        request = request.bearer_auth(config.api_key.trim());
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("{} API 请求失败: {e}", config.provider_name))?;

    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!(
            "{} API 返回 HTTP {}: {}",
            config.provider_name, status, body
        ));
    }

    let txt_text = srt_to_paragraph_txt(&body);
    Ok(TranscriptionResult {
        srt: body,
        txt: txt_text,
    })
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
