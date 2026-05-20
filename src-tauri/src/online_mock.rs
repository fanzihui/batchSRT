use reqwest::multipart;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::Path;
use tokio::fs::File;
use tokio_util::codec::{BytesCodec, FramedRead};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TranscriptionResult {
    pub srt: String,
    pub txt: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct KeyValueField {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OnlineSiteConfig {
    pub name: String,
    pub endpoint_url: String,
    pub file_field: String,
    pub response_text_path: String,
    pub token_field: Option<String>,
    pub token: Option<String>,
    #[serde(default)]
    pub fetch_token_url: Option<String>,
    #[serde(default)]
    pub fetch_token_regex: Option<String>,
    #[serde(default)]
    pub extra_fields: Vec<KeyValueField>,
}

#[tauri::command]
pub async fn upload_audio_online(
    site: OnlineSiteConfig,
    file_paths: Vec<String>,
) -> Result<TranscriptionResult, String> {
    if file_paths.is_empty() {
        return Err("No file paths provided".to_string());
    }

    if site.endpoint_url.trim().is_empty() {
        return Err("在线网站上传地址不能为空".to_string());
    }

    let file_path = &file_paths[0];
    let file = File::open(file_path)
        .await
        .map_err(|e| format!("无法读取音频文件: {e}"))?;
    let filename = Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("audio.mp3")
        .to_string();

    let stream = FramedRead::new(file, BytesCodec::new());
    let part = multipart::Part::stream(reqwest::Body::wrap_stream(stream))
        .file_name(filename)
        .mime_str("audio/mpeg")
        .map_err(|e| e.to_string())?;

    let mut form = multipart::Form::new().part(site.file_field.trim().to_string(), part);

    let client = reqwest::Client::new();

    // 尝试动态获取 token
    let mut actual_token = site.token.clone();
    if let (Some(fetch_url), Some(regex_str)) = (&site.fetch_token_url, &site.fetch_token_regex) {
        if !fetch_url.trim().is_empty() && !regex_str.trim().is_empty() {
            if let Ok(html) = client
                .get(fetch_url.trim())
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .send()
                .await
                .and_then(|r| r.error_for_status())
            {
                if let Ok(text) = html.text().await {
                    if let Ok(re) = regex::Regex::new(regex_str) {
                        if let Some(caps) = re.captures(&text) {
                            if let Some(m) = caps.get(1) {
                                actual_token = Some(m.as_str().to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    if let (Some(token_field), Some(token)) = (&site.token_field, &actual_token) {
        if !token_field.trim().is_empty() && !token.trim().is_empty() {
            form = form.text(token_field.trim().to_string(), token.clone());
        }
    }

    for field in site
        .extra_fields
        .iter()
        .filter(|field| !field.key.trim().is_empty())
    {
        form = form.text(field.key.trim().to_string(), field.value.clone());
    }

    let response = client
        .post(site.endpoint_url.trim())
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Origin", "https://www.text-to-speech.cn")
        .header("Referer", "https://www.text-to-speech.cn/stt.html")
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("{} 上传失败: {e}", site.name))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("读取 {} 响应失败: {e}", site.name))?;

    if !status.is_success() {
        return Err(format!("{} 返回 HTTP {}: {}", site.name, status, body));
    }

    let srt_text = match serde_json::from_str::<Value>(&body) {
        Ok(json) => {
            if let Some(code) = json.get("code").and_then(Value::as_i64) {
                if code != 200 {
                    let message = json
                        .get("msg")
                        .and_then(Value::as_str)
                        .unwrap_or("在线网站返回失败状态");
                    return Err(message.to_string());
                }
            }

            extract_json_path(&json, &site.response_text_path)
                .and_then(Value::as_str)
                .map(ToString::to_string)
                .ok_or_else(|| {
                    format!(
                        "{} 响应中没有找到字幕字段 '{}'",
                        site.name, site.response_text_path
                    )
                })?
        }
        Err(_) => body,
    };

    let txt_text = srt_to_paragraph_txt(&srt_text);
    Ok(TranscriptionResult {
        srt: srt_text,
        txt: txt_text,
    })
}

fn extract_json_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for part in path.split('.').filter(|part| !part.trim().is_empty()) {
        current = current.get(part.trim())?;
    }
    Some(current)
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

#[tauri::command]
pub async fn poll_task_mock(_task_id: String) -> Result<String, String> {
    Ok("".to_string())
}

#[tauri::command]
pub async fn check_site_health(site: OnlineSiteConfig) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
        
    let url = if let Some(fetch_url) = &site.fetch_token_url {
        if !fetch_url.trim().is_empty() {
            fetch_url.trim()
        } else {
            site.endpoint_url.trim()
        }
    } else {
        site.endpoint_url.trim()
    };

    if url.is_empty() {
        return Err("网站 URL 为空".to_string());
    }

    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("无法连接到该网站: {e}"))?;

    // 只要服务器有响应（不管是 200 OK 还是 405 Method Not Allowed 等），说明服务器存活
    if response.status().is_success() || response.status().is_client_error() {
        Ok(true)
    } else {
        Err(format!("网站服务异常，状态码: {}", response.status()))
    }
}
