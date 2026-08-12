use crate::{
    db,
    scanner::{self, Folder, LibraryState, MediaItem},
};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

pub fn ensure_capture_folder(app: &AppHandle) -> Result<(), String> {
    let folder_path = app
        .path()
        .download_dir()
        .map_err(|error| format!("Could not find the Downloads folder: {error}"))?
        .join("Koi Captures");
    fs::create_dir_all(&folder_path).map_err(|error| error.to_string())?;
    let folder = scanner::folder_from_path(&folder_path);
    db::save_folder(app, &folder)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::save_media(app, &items)
}

#[tauri::command]
pub fn add_folder(app: AppHandle) -> Result<Folder, String> {
    let folder_path = rfd::FileDialog::new()
        .set_title("Add folder to Koi")
        .pick_folder()
        .ok_or_else(|| "No folder selected.".to_string())?;
    let folder = scanner::folder_from_path(&folder_path);
    db::save_folder(&app, &folder)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::save_media(&app, &items)?;
    crate::watcher::watch_folder(app, folder.id.clone(), folder_path);
    Ok(folder)
}

#[tauri::command]
pub fn add_folder_path(app: AppHandle, folder_path: String) -> Result<Folder, String> {
    let folder_path = PathBuf::from(folder_path);
    let folder = scanner::folder_from_path(&folder_path);
    db::save_folder(&app, &folder)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::save_media(&app, &items)?;
    crate::watcher::watch_folder(app, folder.id.clone(), folder_path);
    Ok(folder)
}

#[tauri::command]
pub fn scan_folder(
    app: AppHandle,
    folder_path: String,
    folder_id: Option<String>,
) -> Result<Vec<MediaItem>, String> {
    let mut folder = scanner::folder_from_path(&PathBuf::from(&folder_path));
    if let Some(folder_id) = folder_id {
        folder.id = folder_id;
    }
    db::save_folder(&app, &folder)?;
    let items = scanner::scan_folder_path(&folder_path, &folder.id)?;
    db::save_media(&app, &items)?;
    crate::watcher::watch_folder(app, folder.id, PathBuf::from(folder_path));
    Ok(items)
}

#[tauri::command]
pub fn get_media_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err("Media file is missing.".into());
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_tags(app: AppHandle, media_id: String, tags: Vec<String>) -> Result<(), String> {
    let cleaned = tags
        .into_iter()
        .map(|tag| tag.trim().trim_start_matches('#').to_lowercase())
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>();
    db::save_tags(&app, &media_id, &cleaned)
}

#[tauri::command]
pub fn save_media_index(
    app: AppHandle,
    media_id: String,
    dominant_colors: Vec<String>,
    color_names: Vec<String>,
) -> Result<(), String> {
    db::save_media_index(&app, &media_id, &dominant_colors, &color_names)
}

#[tauri::command]
pub fn reconnect_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    let folder_path = rfd::FileDialog::new()
        .set_title("Locate moved folder")
        .pick_folder()
        .ok_or_else(|| "No folder selected.".to_string())?;
    db::reconnect_folder(&app, &folder_id, &folder_path)?;
    crate::watcher::watch_folder(app, folder_id, folder_path);
    Ok(())
}

#[tauri::command]
pub fn get_library(app: AppHandle) -> Result<LibraryState, String> {
    db::get_library(&app)
}
