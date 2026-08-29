use crate::{
    db,
    scanner::{self, Folder, LibraryState, MediaItem},
};
use regex::Regex;
use reqwest::blocking::Client;
use std::{
    fs,
    io::{Cursor, Read},
    path::PathBuf,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use url::Url;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardImport {
    kind: String,
    label: String,
}

struct PagePreview {
    final_url: String,
    canonical_url: Option<String>,
    title: Option<String>,
    site_name: Option<String>,
    description: Option<String>,
    image: Option<image::DynamicImage>,
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
    match scanner::extract_color_index(&PathBuf::from(item.path)) {
        Ok(index) => {
            db::save_media_index(&app, &media_id, &index.dominant_colors, &index.color_names)?;
            Ok(index)
        }
        Err(error) => {
            // Undecodable formats are negatively cached so the background
            // indexer never spins on them again.
            if error.unsupported {
                let _ = db::set_color_state(&app, &media_id, 2);
            }
            Err(error.message)
        }
    }
}

#[tauri::command]
pub fn reset_color_index(app: AppHandle) -> Result<(), String> {
    db::reset_color_index(&app)?;
    let _ = app.emit("library-changed", ());
    Ok(())
}

#[tauri::command]
pub fn mcp_get_status(app: AppHandle) -> Result<crate::mcp::McpStatus, String> {
    crate::mcp::status(&app)
}

#[tauri::command]
pub fn mcp_set_enabled(app: AppHandle, enabled: bool) -> Result<crate::mcp::McpStatus, String> {
    crate::mcp::set_enabled(app, enabled)
}

#[tauri::command]
pub fn mcp_regenerate_token(app: AppHandle) -> Result<crate::mcp::McpStatus, String> {
    crate::mcp::regenerate_token(app)
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
        let parsed_url = Url::parse(url)
            .map_err(|_| "Copy a valid website link, then press Paste again.".to_string())?;
        let host = parsed_url
            .host_str()
            .unwrap_or("Saved page")
            .trim_start_matches("www.");
        let preview = fetch_page_preview(url).ok();
        let has_image = preview
            .as_ref()
            .and_then(|value| value.image.as_ref())
            .is_some();
        let filename = if has_image {
            format!("clipboard-page-{stamp}.png")
        } else {
            format!("clipboard-link-{stamp}.png")
        };
        let path = folder_path.join(&filename);
        if let Some(source) = preview.as_ref().and_then(|value| value.image.as_ref()) {
            source.save_with_format(&path, image::ImageFormat::Png)
        } else {
            let placeholder = image::RgbaImage::from_fn(1200, 675, |x, y| {
                let light = 240_u8.saturating_sub(((x + y) % 24) as u8);
                image::Rgba([light, light, light.saturating_sub(3), 255])
            });
            placeholder.save_with_format(&path, image::ImageFormat::Png)
        }
        .map_err(|error| format!("Could not save the clipboard link: {error}"))?;
        let final_url = preview
            .as_ref()
            .map(|value| value.final_url.as_str())
            .unwrap_or(url);
        let title = preview
            .as_ref()
            .and_then(|value| value.title.as_deref())
            .unwrap_or(host);
        (
            filename.clone(),
            serde_json::json!({
                "schemaVersion": 2,
                "captureType": "link",
                "sourceUrl": url,
                "sourceFinalUrl": final_url,
                "sourcePageUrl": final_url,
                "sourceCanonicalUrl": preview.as_ref().and_then(|value| value.canonical_url.as_deref()),
                "sourceTitle": title,
                "sourcePageTitle": title,
                "sourceSiteName": preview.as_ref().and_then(|value| value.site_name.as_deref()).unwrap_or(host),
                "sourceDescription": preview.as_ref().and_then(|value| value.description.as_deref()),
                "imageFilename": filename,
            }),
            "link".to_string(),
            if has_image {
                format!("{host} preview saved")
            } else {
                format!("{host} saved")
            },
        )
    };

    scanner::upsert_capture_metadata(&folder_path, &filename, metadata)?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::sync_folder_media(&app, &folder.id, &items)?;
    let _ = app.emit("library-changed", ());
    Ok(ClipboardImport { kind, label })
}

#[tauri::command]
pub fn refresh_link_preview(app: AppHandle, media_id: String) -> Result<bool, String> {
    let item = db::media_by_id(&app, &media_id)?
        .ok_or_else(|| "That saved page is no longer in Koi.".to_string())?;
    if item.capture_type.as_deref() != Some("link") || !item.name.starts_with("clipboard-link-") {
        return Ok(false);
    }
    let source_url = item
        .source_page_url
        .as_deref()
        .or(item.source_url.as_deref())
        .ok_or_else(|| "That saved page has no source link.".to_string())?;
    let preview = fetch_page_preview(source_url)?;
    if preview.image.is_none() && preview.title.is_none() && preview.description.is_none() {
        return Ok(false);
    }
    if let Some(image) = &preview.image {
        image
            .save_with_format(&item.path, image::ImageFormat::Png)
            .map_err(|error| format!("Could not update the saved page preview: {error}"))?;
    }
    let folder = db::folder_by_id(&app, &item.folder_id)?
        .ok_or_else(|| "That saved page folder is no longer in Koi.".to_string())?;
    let host = Url::parse(&preview.final_url)
        .ok()
        .and_then(|url| url.host_str().map(String::from));
    let title = preview
        .title
        .as_deref()
        .or(item.source_title.as_deref())
        .or(host.as_deref());
    scanner::upsert_capture_metadata(
        &PathBuf::from(&folder.path),
        &item.name,
        serde_json::json!({
            "schemaVersion": 2,
            "captureType": "link",
            "sourceUrl": source_url,
            "sourceFinalUrl": preview.final_url,
            "sourcePageUrl": preview.canonical_url.as_deref().unwrap_or(source_url),
            "sourceCanonicalUrl": preview.canonical_url,
            "sourceTitle": title,
            "sourcePageTitle": title,
            "sourceSiteName": preview.site_name.or(host),
            "sourceDescription": preview.description,
            "imageFilename": item.name,
        }),
    )?;
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::sync_folder_media(&app, &folder.id, &items)?;
    let _ = app.emit("library-changed", ());
    Ok(true)
}

fn fetch_page_preview(input: &str) -> Result<PagePreview, String> {
    const MAX_HTML_BYTES: u64 = 2 * 1024 * 1024;
    const MAX_IMAGE_BYTES: u64 = 16 * 1024 * 1024;
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(10))
        .user_agent("Koi/0.2 link preview")
        .redirect(reqwest::redirect::Policy::limited(6))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get(input)
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| format!("Could not load the page preview: {error}"))?;
    let final_url = response.url().clone();
    let mut html_bytes = Vec::new();
    response
        .take(MAX_HTML_BYTES)
        .read_to_end(&mut html_bytes)
        .map_err(|error| error.to_string())?;
    let html = String::from_utf8_lossy(&html_bytes);

    let title = meta_value(&html, &["og:title", "twitter:title"]).or_else(|| html_title(&html));
    let site_name = meta_value(&html, &["og:site_name", "application-name"]);
    let description = meta_value(
        &html,
        &["og:description", "twitter:description", "description"],
    );
    let canonical_url =
        link_value(&html, "canonical").and_then(|value| resolve_url(&final_url, &value));
    let image_url = meta_value(&html, &["og:image:secure_url", "og:image", "twitter:image"])
        .and_then(|value| resolve_url(&final_url, &value));
    let image = image_url.and_then(|source| {
        let response = client.get(source).send().ok()?.error_for_status().ok()?;
        if response
            .content_length()
            .is_some_and(|length| length > MAX_IMAGE_BYTES)
        {
            return None;
        }
        let mut bytes = Vec::new();
        response
            .take(MAX_IMAGE_BYTES)
            .read_to_end(&mut bytes)
            .ok()?;
        image::load_from_memory(&bytes).ok()
    });

    Ok(PagePreview {
        final_url: final_url.to_string(),
        canonical_url,
        title,
        site_name,
        description,
        image,
    })
}

fn meta_value(html: &str, names: &[&str]) -> Option<String> {
    let tag_pattern = Regex::new(r"(?is)<meta\s+[^>]*>").ok()?;
    let attribute_pattern =
        Regex::new(r#"(?i)([a-z][a-z0-9:_-]*)\s*=\s*[\"']([^\"']*)[\"']"#).ok()?;
    for tag in tag_pattern.find_iter(html) {
        let attributes = attribute_pattern
            .captures_iter(tag.as_str())
            .filter_map(|capture| {
                Some((
                    capture.get(1)?.as_str().to_ascii_lowercase(),
                    capture.get(2)?.as_str().to_string(),
                ))
            })
            .collect::<std::collections::HashMap<_, _>>();
        let Some(key) = attributes
            .get("property")
            .or_else(|| attributes.get("name"))
        else {
            continue;
        };
        if names.iter().any(|name| key.eq_ignore_ascii_case(name)) {
            return attributes
                .get("content")
                .map(|value| decode_html_text(value));
        }
    }
    None
}

fn html_title(html: &str) -> Option<String> {
    let pattern = Regex::new(r"(?is)<title[^>]*>(.*?)</title>").ok()?;
    pattern
        .captures(html)
        .and_then(|capture| capture.get(1))
        .map(|value| decode_html_text(value.as_str()))
}

fn link_value(html: &str, relation: &str) -> Option<String> {
    let tag_pattern = Regex::new(r"(?is)<link\s+[^>]*>").ok()?;
    let attribute_pattern =
        Regex::new(r#"(?i)([a-z][a-z0-9:_-]*)\s*=\s*[\"']([^\"']*)[\"']"#).ok()?;
    for tag in tag_pattern.find_iter(html) {
        let attributes = attribute_pattern
            .captures_iter(tag.as_str())
            .filter_map(|capture| {
                Some((
                    capture.get(1)?.as_str().to_ascii_lowercase(),
                    capture.get(2)?.as_str().to_string(),
                ))
            })
            .collect::<std::collections::HashMap<_, _>>();
        if attributes.get("rel").is_some_and(|value| {
            value
                .split_whitespace()
                .any(|part| part.eq_ignore_ascii_case(relation))
        }) {
            return attributes.get("href").cloned();
        }
    }
    None
}

fn resolve_url(base: &Url, value: &str) -> Option<String> {
    base.join(value.trim()).ok().map(|url| url.to_string())
}

fn decode_html_text(value: &str) -> String {
    value
        .trim()
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
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

#[cfg(test)]
mod tests {
    use super::{html_title, link_value, meta_value, resolve_url};
    use url::Url;

    #[test]
    fn reads_open_graph_metadata_after_unrelated_meta_tags() {
        let html = r#"
          <meta charset="utf-8">
          <meta name="description" content="A quiet pond &amp; reeds">
          <meta property="og:title" content="Pond studies">
          <meta property="og:image" content="/images/pond.jpg">
          <title>Fallback title</title>
        "#;
        assert_eq!(meta_value(html, &["og:title"]), Some("Pond studies".into()));
        assert_eq!(
            meta_value(html, &["description"]),
            Some("A quiet pond & reeds".into())
        );
        assert_eq!(html_title(html), Some("Fallback title".into()));
    }

    #[test]
    fn resolves_relative_preview_and_canonical_urls() {
        let html = r#"<link rel="alternate canonical" href="/work/pond">"#;
        let base = Url::parse("https://example.com/gallery/page").unwrap();
        assert_eq!(link_value(html, "canonical"), Some("/work/pond".into()));
        assert_eq!(
            resolve_url(&base, "/images/pond.jpg"),
            Some("https://example.com/images/pond.jpg".into())
        );
    }
}
