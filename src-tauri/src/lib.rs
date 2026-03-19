use std::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use base64::Engine;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WebDavConfig {
    pub url: String,
    pub username: String,
    pub password: String,
    pub path: String,
}

struct WebDavState(Mutex<Option<WebDavConfig>>);

#[tauri::command]
async fn set_webdav_config(config: WebDavConfig, state: State<'_, WebDavState>) -> Result<(), String> {
    let mut webdav_state = state.0.lock().unwrap();
    *webdav_state = Some(config);
    Ok(())
}

#[tauri::command]
async fn backup_to_webdav(data: String, state: State<'_, WebDavState>) -> Result<String, String> {
    let config_opt = {
        let webdav_state = state.0.lock().unwrap();
        (*webdav_state).clone()
    };
    
    match config_opt {
        Some(config) => {
            let client = reqwest::Client::new();
            let full_url = format!("{}{}", config.url.trim_end_matches('/'), config.path);
            
            let auth = format!("{}:{}", config.username, config.password);
            let auth_header = format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(&auth));
            
            let response = client
                .put(&full_url)
                .header("Authorization", auth_header)
                .header("Content-Type", "application/json")
                .body(data)
                .send()
                .await
                .map_err(|e| format!("Failed to send request: {}", e))?;
            
            if response.status().is_success() {
                Ok("Backup successful".to_string())
            } else {
                Err(format!("Backup failed with status: {}", response.status()))
            }
        }
        None => Err("WebDAV not configured".to_string()),
    }
}

#[tauri::command]
async fn restore_from_webdav(state: State<'_, WebDavState>) -> Result<String, String> {
    let config_opt = {
        let webdav_state = state.0.lock().unwrap();
        (*webdav_state).clone()
    };
    
    match config_opt {
        Some(config) => {
            let client = reqwest::Client::new();
            let full_url = format!("{}{}", config.url.trim_end_matches('/'), config.path);
            
            let auth = format!("{}:{}", config.username, config.password);
            let auth_header = format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(&auth));
            
            let response = client
                .get(&full_url)
                .header("Authorization", auth_header)
                .send()
                .await
                .map_err(|e| format!("Failed to send request: {}", e))?;
            
            if response.status().is_success() {
                let data = response
                    .text()
                    .await
                    .map_err(|e| format!("Failed to read response: {}", e))?;
                Ok(data)
            } else {
                Err(format!("Restore failed with status: {}", response.status()))
            }
        }
        None => Err("WebDAV not configured".to_string()),
    }
}

#[tauri::command]
fn send_notification(title: String, body: String) -> Result<(), String> {
    // TODO: Fix notification API usage
    // Temporarily disabled to fix compilation
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(WebDavState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            set_webdav_config,
            backup_to_webdav,
            restore_from_webdav,
            send_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
