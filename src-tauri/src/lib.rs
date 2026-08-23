mod commands;
mod database;
mod error;
mod models;
mod rows;

#[cfg(test)]
mod tests;

use std::sync::Mutex;

use database::init_db;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = init_db(&dir.join("workspace.db"))?;
            app.manage(AppState {
                db: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // clients
            commands::client::get_clients,
            commands::client::get_client,
            commands::client::create_client,
            commands::client::update_client,
            commands::client::delete_client,
            commands::client::move_client,
            // jobs
            commands::job::get_jobs,
            commands::job::get_job,
            commands::job::create_job,
            commands::job::update_job,
            commands::job::delete_job,
            commands::job::move_job,
            // candidates
            commands::candidate::get_candidates,
            commands::candidate::get_candidate,
            commands::candidate::create_candidate,
            commands::candidate::update_candidate,
            commands::candidate::delete_candidate,
            commands::candidate::delete_candidates,
            commands::candidate::bulk_update_candidates,
            commands::candidate::get_candidates_with_job,
            // dashboard / search
            commands::dashboard::get_dashboard_stats,
            commands::search::global_search,
            // data
            commands::data::export_data,
            commands::data::import_data,
            // files
            commands::files::attach_resume,
            commands::files::remove_resume,
            commands::files::rename_resume,
            commands::files::read_resume_bytes,
            commands::files::write_resume_bytes,
            // ai resume auto-fill & model manager
            commands::ai::get_ai_models_status,
            commands::ai::download_ai_model,
            commands::ai::cancel_ai_download,
            commands::ai::delete_ai_model,
            commands::ai::parse_resume_text,
            // ocr engine model manager
            commands::ocr::get_ocr_model_status,
            commands::ocr::download_ocr_model,
            commands::ocr::cancel_ocr_download,
            commands::ocr::delete_ocr_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
