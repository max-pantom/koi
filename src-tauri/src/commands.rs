use crate::{
    db,
    scanner::{self, Folder, LibraryState, MediaItem},
};
use std::{fs, io::Cursor, path::PathBuf};
use tauri::{AppHandle, Emitter, Manager};

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardImport {
    kind: String,
    label: String,
}

#[tauri::command]
pub fn ensure_capture_folder(app: AppHandle) -> Result<Folder, String> {
    let folder_path = app
        .path()
        .download_dir()
        .map_err(|error| format!("Could not find the Downloads folder: {error}"))?
        .join("Koi Captures");
    fs::create_dir_all(&folder_path).map_err(|error| error.to_string())?;
    let folder = scanner::folder_from_path(&folder_path);
    db::save_folder(&app, &folder)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::sync_folder_media(&app, &folder.id, &items)?;
    crate::watcher::watch_folder(app, folder.id.clone(), folder_path);
    Ok(folder)
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
    db::sync_folder_media(&app, &folder.id, &items)?;
    crate::watcher::watch_folder(app, folder.id.clone(), folder_path);
    Ok(folder)
}

#[tauri::command]
pub fn add_folder_path(app: AppHandle, folder_path: String) -> Result<Folder, String> {
    let folder_path = PathBuf::from(folder_path);
    let folder = scanner::folder_from_path(&folder_path);
    db::save_folder(&app, &folder)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::sync_folder_media(&app, &folder.id, &items)?;
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
    db::sync_folder_media(&app, &folder.id, &items)?;
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
pub fn extract_media_colors(
    app: AppHandle,
    media_id: String,
) -> Result<scanner::ColorIndex, String> {
    let item = db::media_by_id(&app, &media_id)?
        .ok_or_else(|| "That image is no longer in Koi.".to_string())?;
    let index = scanner::extract_color_index(&PathBuf::from(item.path))?;
    db::save_media_index(&app, &media_id, &index.dominant_colors, &index.color_names)?;
    Ok(index)
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
    let library = db::get_library(&app)?;
    if !library.items.iter().any(|item| item.missing) {
        return Ok(library);
    }

    // A missing item first gets a recursive lookup through every registered
    // folder. Only a successful complete scan is allowed to prune the index;
    // unreadable or disconnected folders keep their records for reconnecting.
    for folder in &library.folders {
        if let Ok(items) = scanner::scan_folder_path(&folder.path, &folder.id) {
            db::sync_folder_media(&app, &folder.id, &items)?;
        }
    }
    db::get_library(&app)
}

#[tauri::command]
pub fn delete_media(app: AppHandle, media_id: String) -> Result<(), String> {
    let item = db::media_by_id(&app, &media_id)?
        .ok_or_else(|| "That image is no longer in Koi.".to_string())?;
    let media_path = PathBuf::from(&item.path);
    if media_path.is_file() {
        move_to_trash(&media_path)?;
    }
    if let (Some(parent), Some(filename)) = (
        media_path.parent(),
        media_path.file_name().and_then(|name| name.to_str()),
    ) {
        if let Err(error) = scanner::remove_capture_metadata(parent, filename) {
            eprintln!("Koi could not clean capture metadata after delete: {error}");
        }
        for sidecar in [
            media_path.with_extension("koi.json"),
            PathBuf::from(format!("{}.koi.json", media_path.to_string_lossy())),
        ] {
            if sidecar.is_file() {
                let _ = move_to_trash(&sidecar);
            }
        }
    }
    db::delete_media(&app, &media_id)?;
    let _ = app.emit("library-changed", ());
    Ok(())
}

#[tauri::command]
pub fn copy_media_image(app: AppHandle, media_id: String) -> Result<(), String> {
    let item = db::media_by_id(&app, &media_id)?
        .ok_or_else(|| "That image is no longer in Koi.".to_string())?;
    let path = PathBuf::from(item.path);
    if !path.is_file() {
        return Err("The original image is missing.".into());
    }

    let image = image::ImageReader::open(&path)
        .map_err(|error| format!("Could not open the image: {error}"))?
        .with_guessed_format()
        .map_err(|error| format!("Could not read the image format: {error}"))?
        .decode()
        .map_err(|error| format!("Could not decode the image: {error}"))?;
    let mut png = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .map_err(|error| format!("Could not prepare the image for copying: {error}"))?;
    write_png_to_clipboard(&png)
}

#[tauri::command]
pub fn import_clipboard(app: AppHandle) -> Result<ClipboardImport, String> {
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|error| format!("Could not read the clipboard: {error}"))?;
    let folder = ensure_capture_folder(app.clone())?;
    let folder_path = PathBuf::from(&folder.path);
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    let (filename, metadata, kind, label) = if let Ok(image) = clipboard.get_image() {
        let filename = format!("clipboard-{stamp}.png");
        let path = folder_path.join(&filename);
        image::save_buffer_with_format(
            &path,
            image.bytes.as_ref(),
            image.width as u32,
            image.height as u32,
            image::ColorType::Rgba8,
            image::ImageFormat::Png,
        )
        .map_err(|error| format!("Could not save the clipboard image: {error}"))?;
        (
            filename.clone(),
            serde_json::json!({
                "schemaVersion": 2,
                "captureType": "image",
                "sourceTitle": "Clipboard image",
                "imageFilename": filename,
            }),
            "image".to_string(),
            "Clipboard image saved".to_string(),
        )
    } else {
        let value = clipboard
            .get_text()
            .map_err(|_| "Copy an image or website link, then press Paste again.".to_string())?;
        let url = value.trim();
        if !url.starts_with("https://") && !url.starts_with("http://") {
            return Err("Copy an image or website link, then press Paste again.".into());
        }
        let host = url
            .split_once("://")
            .map(|(_, rest)| rest.split('/').next().unwrap_or(rest))
            .unwrap_or(url)
            .trim_start_matches("www.");
        let filename = format!("clipboard-link-{stamp}.png");
        let path = folder_path.join(&filename);
        let placeholder = image::RgbaImage::from_fn(1200, 675, |x, y| {
            let light = 240_u8.saturating_sub(((x + y) % 24) as u8);
            image::Rgba([light, light, light.saturating_sub(3), 255])
        });
        placeholder
            .save_with_format(&path, image::ImageFormat::Png)
            .map_err(|error| format!("Could not save the clipboard link: {error}"))?;
        (
            filename.clone(),
            serde_json::json!({
                "schemaVersion": 2,
                "captureType": "link",
                "sourceUrl": url,
                "sourceFinalUrl": url,
                "sourcePageUrl": url,
                "sourceTitle": host,
                "sourceSiteName": host,
                "imageFilename": filename,
            }),
            "link".to_string(),
            format!("{host} saved"),
        )
    };

    scanner::upsert_capture_metadata(&folder_path, &filename, metadata)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::sync_folder_media(&app, &folder.id, &items)?;
    let _ = app.emit("library-changed", ());
    Ok(ClipboardImport { kind, label })
}

#[cfg(target_os = "macos")]
fn write_png_to_clipboard(png: &[u8]) -> Result<(), String> {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypePNG};
    use objc2_foundation::NSData;

    let data = unsafe { NSData::dataWithBytes_length(png.as_ptr().cast(), png.len()) };
    let pasteboard = NSPasteboard::generalPasteboard();
    pasteboard.clearContents();
    let png_type = unsafe { NSPasteboardTypePNG };
    pasteboard
        .setData_forType(Some(&data), png_type)
        .then_some(())
        .ok_or_else(|| "macOS did not accept the image on the clipboard.".to_string())
}

#[cfg(not(target_os = "macos"))]
fn write_png_to_clipboard(_png: &[u8]) -> Result<(), String> {
    Err("Copying images is currently available on macOS.".into())
}

#[cfg(target_os = "macos")]
fn move_to_trash(path: &std::path::Path) -> Result<(), String> {
    use objc2_foundation::{NSFileManager, NSString, NSURL};
    let path = NSString::from_str(&path.to_string_lossy());
    let url = NSURL::fileURLWithPath(&path);
    NSFileManager::defaultManager()
        .trashItemAtURL_resultingItemURL_error(&url, None)
        .map_err(|error| format!("Could not move the file to Trash: {error}"))
}

#[cfg(not(target_os = "macos"))]
fn move_to_trash(_path: &std::path::Path) -> Result<(), String> {
    Err("Moving files to Trash is currently available on macOS.".into())
}
