#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::api::dialog::blocking::FileDialogBuilder;
use std::{fs::File, io::Write, time};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
async fn export(elements: &str) -> Result<String, String> {
    let file_dialog = FileDialogBuilder::new()
        .add_filter("JSON", &["json"])
        .set_file_name((time::SystemTime::now().duration_since(time::UNIX_EPOCH).unwrap().as_secs().to_string() + ".json").as_str());

    let path = file_dialog.save_file().ok_or("导出被取消")?;
    let mut file = File::create(path.clone()).unwrap();
    file.write_all(elements.as_bytes()).unwrap();

    Ok(path.to_str().unwrap().to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![export])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
