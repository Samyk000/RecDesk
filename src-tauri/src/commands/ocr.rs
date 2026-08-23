use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrModelInfo {
    pub id: String,
    pub name: String,
    pub size_mb: u64,
    pub description: String,
    pub filename: String,
    pub download_url: String,
    pub is_downloaded: bool,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrDownloadProgressPayload {
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub is_complete: bool,
}

fn get_ocr_cancellation_registry() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_ocr_models_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let models_dir = app_dir.join("models").join("ocr");
    std::fs::create_dir_all(&models_dir)
        .map_err(|e| format!("Failed to create ocr models directory: {}", e))?;
    Ok(models_dir)
}

fn get_default_ocr_model_info() -> OcrModelInfo {
    OcrModelInfo {
        id: "pp-ocrv6".into(),
        name: "PaddleOCR PP-OCRv6 English / Multilingual".into(),
        size_mb: 18,
        description: "Ultra-fast, high-precision document OCR engine optimized for resume & document layout extraction.".into(),
        filename: "ppocrv6_rec.onnx".into(),
        download_url: "https://huggingface.co/PaddlePaddle/PP-OCRv4-onnx/resolve/main/ch_PP-OCRv4_rec_infer.onnx".into(),
        is_downloaded: false,
        file_path: None,
    }
}

#[tauri::command]
pub async fn get_ocr_model_status(app: AppHandle) -> Result<OcrModelInfo, String> {
    let dir = get_ocr_models_dir(&app)?;
    let mut model = get_default_ocr_model_info();
    let target = dir.join(&model.filename);
    if target.exists() && target.metadata().map(|m| m.len() > 1024 * 1024).unwrap_or(false) {
        model.is_downloaded = true;
        model.file_path = Some(target.to_string_lossy().to_string());
    }
    Ok(model)
}

#[tauri::command]
pub async fn download_ocr_model(app: AppHandle, model_id: String) -> Result<String, String> {
    let dir = get_ocr_models_dir(&app)?;
    let model = get_default_ocr_model_info();
    if model.id != model_id {
        return Err(format!("Unknown OCR model ID: {}", model_id));
    }

    let dest_path = dir.join(&model.filename);
    let temp_path = dir.join(format!("{}.tmp", model.filename));

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut reg = get_ocr_cancellation_registry()
            .lock()
            .map_err(|e| e.to_string())?;
        reg.insert(model_id.clone(), Arc::clone(&cancel_flag));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(&model.download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to model host: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned HTTP {}", response.status()));
    }

    let total_bytes = response.content_length().unwrap_or(model.size_mb * 1024 * 1024);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;

    let mut last_percentage: f64 = -1.0;

    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::Relaxed) {
            drop(file);
            let _ = tokio::fs::remove_file(&temp_path).await;
            let mut reg = get_ocr_cancellation_registry().lock().unwrap();
            reg.remove(&model_id);
            return Err("Download cancelled by user".into());
        }

        let chunk = chunk_result.map_err(|e| format!("Network error while downloading: {}", e))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;
        let percentage = if total_bytes > 0 {
            ((downloaded as f64 / total_bytes as f64) * 100.0).min(100.0)
        } else {
            0.0
        };

        if (percentage - last_percentage).abs() >= 1.0 || downloaded == total_bytes {
            last_percentage = percentage;
            let _ = app.emit(
                "ocr-download-progress",
                OcrDownloadProgressPayload {
                    model_id: model_id.clone(),
                    downloaded_bytes: downloaded,
                    total_bytes,
                    percentage,
                    is_complete: false,
                },
            );
        }
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);

    if dest_path.exists() {
        let _ = tokio::fs::remove_file(&dest_path).await;
    }
    tokio::fs::rename(&temp_path, &dest_path)
        .await
        .map_err(|e| format!("Failed to finalize model file: {}", e))?;

    let _ = app.emit(
        "ocr-download-progress",
        OcrDownloadProgressPayload {
            model_id: model_id.clone(),
            downloaded_bytes: total_bytes,
            total_bytes,
            percentage: 100.0,
            is_complete: true,
        },
    );

    let mut reg = get_ocr_cancellation_registry().lock().unwrap();
    reg.remove(&model_id);

    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cancel_ocr_download(model_id: String) -> Result<(), String> {
    let mut reg = get_ocr_cancellation_registry().lock().unwrap();
    if let Some(flag) = reg.remove(&model_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_ocr_model(app: AppHandle, model_id: String) -> Result<(), String> {
    let dir = get_ocr_models_dir(&app)?;
    let model = get_default_ocr_model_info();
    if model.id == model_id {
        let dest = dir.join(&model.filename);
        if dest.exists() {
            std::fs::remove_file(dest).map_err(|e| format!("Failed to delete OCR model: {}", e))?;
        }
    }
    Ok(())
}
