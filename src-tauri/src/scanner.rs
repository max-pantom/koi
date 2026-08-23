use serde::{Deserialize, Serialize};
use std::{
    collections::{hash_map::DefaultHasher, BTreeMap, HashMap},
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorIndex {
    pub dominant_colors: Vec<String>,
    pub color_names: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub path: String,
    pub added_at: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaItem {
    pub id: String,
    pub folder_id: String,
    pub path: String,
    pub name: String,
    pub extension: String,
    pub kind: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub created_at: Option<u64>,
    pub modified_at: Option<u64>,
    pub tags: Vec<String>,
    pub dominant_colors: Vec<String>,
    pub color_names: Vec<String>,
    pub missing: bool,
    pub capture_type: Option<String>,
    pub source_url: Option<String>,
    pub source_final_url: Option<String>,
    pub source_page_url: Option<String>,
    pub source_canonical_url: Option<String>,
    pub source_link_url: Option<String>,
    pub source_title: Option<String>,
    pub source_page_title: Option<String>,
    pub source_site_name: Option<String>,
    pub source_description: Option<String>,
    pub source_byline: Option<String>,
    pub source_content_markdown: Option<String>,
    pub captured_at: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryState {
    pub folders: Vec<Folder>,
    pub items: Vec<MediaItem>,
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "apng", "avif", "aviff", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "tif",
    "tiff", "webp", "m4v", "mov", "mp4", "ogv", "webm",
];
pub const CAPTURE_MANIFEST_FILENAME: &str = "koi-manifest.json";

pub fn folder_from_path(path: &Path) -> Folder {
    Folder {
        id: stable_id(&path.to_string_lossy()),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: path.to_string_lossy().to_string(),
        added_at: now(),
    }
}

pub fn scan_folder_path(folder_path: &str, folder_id: &str) -> Result<Vec<MediaItem>, String> {
    let root = PathBuf::from(folder_path);
    if !root.is_dir() {
        return Err("Choose a folder Koi can read.".into());
    }

    let mut items = Vec::new();
    scan_dir(&root, folder_id, &mut items)?;
    items.sort_by(|a, b| {
        b.modified_at
            .cmp(&a.modified_at)
            .then_with(|| a.name.cmp(&b.name))
    });
    Ok(items)
}

fn scan_dir(dir: &Path, folder_id: &str, items: &mut Vec<MediaItem>) -> Result<(), String> {
    migrate_legacy_sidecars(dir)?;
    let capture_manifest = read_capture_manifest(dir);
    let entries = fs::read_dir(dir).map_err(|error| format!("Could not read folder: {error}"))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("Could not read folder entry: {error}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;

        if name.starts_with('.') || file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            scan_dir(&path, folder_id, items)?;
            continue;
        }

        if !file_type.is_file() || !is_media_file(&path) {
            continue;
        }

        let file_metadata = entry
            .metadata()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;
        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or_default()
            .to_lowercase();
        let absolute = path.to_string_lossy().to_string();
        let image_metadata = media_metadata(&path);
        let capture_metadata = capture_metadata(&path, &capture_manifest);

        items.push(MediaItem {
            id: stable_id(&absolute),
            folder_id: folder_id.to_string(),
            path: absolute,
            name,
            extension: extension.clone(),
            kind: if extension == "gif" {
                "gif"
            } else if matches!(extension.as_str(), "m4v" | "mov" | "mp4" | "ogv" | "webm") {
                "video"
            } else {
                "image"
            }
            .to_string(),
            width: image_metadata.width,
            height: image_metadata.height,
            created_at: file_metadata.created().ok().and_then(to_secs),
            modified_at: file_metadata.modified().ok().and_then(to_secs),
            tags: Vec::new(),
            dominant_colors: image_metadata.dominant_colors,
            color_names: image_metadata.color_names,
            missing: false,
            capture_type: capture_metadata.capture_type,
            source_url: capture_metadata.source_url,
            source_final_url: capture_metadata.source_final_url,
            source_page_url: capture_metadata.source_page_url,
            source_canonical_url: capture_metadata.source_canonical_url,
            source_link_url: capture_metadata.source_link_url,
            source_title: capture_metadata.source_title,
            source_page_title: capture_metadata.source_page_title,
            source_site_name: capture_metadata.source_site_name,
            source_description: capture_metadata.source_description,
            source_byline: capture_metadata.source_byline,
            source_content_markdown: capture_metadata.source_content_markdown,
            captured_at: capture_metadata.captured_at,
        });
    }

    Ok(())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureMetadata {
    capture_type: Option<String>,
    source_url: Option<String>,
    source_final_url: Option<String>,
    source_page_url: Option<String>,
    source_canonical_url: Option<String>,
    source_link_url: Option<String>,
    source_title: Option<String>,
    source_page_title: Option<String>,
    source_site_name: Option<String>,
    source_description: Option<String>,
    source_byline: Option<String>,
    source_content_markdown: Option<String>,
    captured_at: Option<String>,
}

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaptureManifest {
    schema_version: u8,
    captures: BTreeMap<String, serde_json::Value>,
}

fn capture_metadata(
    media_path: &Path,
    manifest: &BTreeMap<String, serde_json::Value>,
) -> CaptureMetadata {
    if let Some(metadata) = media_path
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| manifest.get(name))
        .and_then(|value| serde_json::from_value::<CaptureMetadata>(value.clone()).ok())
    {
        return metadata;
    }

    let primary = media_path.with_extension("koi.json");
    let appended = PathBuf::from(format!("{}.koi.json", media_path.to_string_lossy()));

    [primary, appended]
        .into_iter()
        .find_map(|path| {
            fs::read_to_string(path)
                .ok()
                .and_then(|content| serde_json::from_str::<CaptureMetadata>(&content).ok())
        })
        .unwrap_or_default()
}

fn read_capture_manifest(dir: &Path) -> BTreeMap<String, serde_json::Value> {
    fs::read_to_string(dir.join(CAPTURE_MANIFEST_FILENAME))
        .ok()
        .and_then(|content| serde_json::from_str::<CaptureManifest>(&content).ok())
        .map(|manifest| manifest.captures)
        .unwrap_or_default()
}

pub fn upsert_capture_metadata(
    dir: &Path,
    image_filename: &str,
    metadata: serde_json::Value,
) -> Result<(), String> {
    let mut captures = read_capture_manifest(dir);
    captures.insert(image_filename.to_string(), metadata);
    write_capture_manifest(dir, captures)
}

pub fn remove_capture_metadata(dir: &Path, image_filename: &str) -> Result<(), String> {
    let mut captures = read_capture_manifest(dir);
    if captures.remove(image_filename).is_none() {
        return Ok(());
    }
    if captures.is_empty() {
        let manifest_path = dir.join(CAPTURE_MANIFEST_FILENAME);
        if manifest_path.is_file() {
            fs::remove_file(manifest_path).map_err(|error| error.to_string())?;
        }
        return Ok(());
    }
    write_capture_manifest(dir, captures)
}

fn write_capture_manifest(
    dir: &Path,
    captures: BTreeMap<String, serde_json::Value>,
) -> Result<(), String> {
    let manifest = CaptureManifest {
        schema_version: 1,
        captures,
    };
    let content = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    let manifest_path = dir.join(CAPTURE_MANIFEST_FILENAME);
    let temporary_path = dir.join(".koi-manifest.tmp");
    fs::write(&temporary_path, format!("{content}\n")).map_err(|error| error.to_string())?;
    fs::rename(&temporary_path, &manifest_path).map_err(|error| {
        let _ = fs::remove_file(&temporary_path);
        error.to_string()
    })
}

fn migrate_legacy_sidecars(dir: &Path) -> Result<(), String> {
    let sidecars = fs::read_dir(dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.ends_with(".koi.json"))
        })
        .collect::<Vec<_>>();
    if sidecars.is_empty() {
        return Ok(());
    }

    let mut captures = read_capture_manifest(dir);
    let mut migrated = Vec::new();
    for sidecar in sidecars {
        let Ok(content) = fs::read_to_string(&sidecar) else {
            continue;
        };
        let Ok(metadata) = serde_json::from_str::<serde_json::Value>(&content) else {
            continue;
        };
        let Some(image_filename) = legacy_image_filename(dir, &sidecar, &metadata) else {
            continue;
        };
        captures.insert(image_filename, metadata);
        migrated.push(sidecar);
    }
    if migrated.is_empty() {
        return Ok(());
    }

    write_capture_manifest(dir, captures)?;
    for sidecar in migrated {
        fs::remove_file(sidecar).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn legacy_image_filename(
    dir: &Path,
    sidecar: &Path,
    metadata: &serde_json::Value,
) -> Option<String> {
    if let Some(filename) = metadata
        .get("imageFilename")
        .and_then(serde_json::Value::as_str)
    {
        let candidate = dir.join(filename);
        if candidate.is_file() && is_media_file(&candidate) {
            return Some(filename.to_string());
        }
    }

    let sidecar_name = sidecar.file_name()?.to_str()?;
    let base = sidecar_name.strip_suffix(".koi.json")?;
    let appended = dir.join(base);
    if appended.is_file() && is_media_file(&appended) {
        return Some(base.to_string());
    }
    MEDIA_EXTENSIONS.iter().find_map(|extension| {
        let filename = format!("{base}.{extension}");
        dir.join(&filename).is_file().then_some(filename)
    })
}

fn is_media_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| MEDIA_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn stable_id(value: &str) -> String {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn to_secs(time: std::time::SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_secs())
}

struct MediaMetadata {
    width: Option<u32>,
    height: Option<u32>,
    dominant_colors: Vec<String>,
    color_names: Vec<String>,
}

fn media_metadata(path: &Path) -> MediaMetadata {
    let Ok(reader) = image::ImageReader::open(path) else {
        return empty_metadata();
    };
    let Ok((width, height)) = reader.into_dimensions() else {
        return empty_metadata();
    };

    MediaMetadata {
        width: Some(width),
        height: Some(height),
        // The desktop UI computes colors only for thumbnails that actually
        // enter the virtualized viewport, then persists them in SQLite. Folder
        // scans stay header-only instead of decoding every full-resolution file.
        dominant_colors: Vec::new(),
        color_names: Vec::new(),
    }
}

pub fn extract_color_index(path: &Path) -> Result<ColorIndex, String> {
    let image = image::ImageReader::open(path)
        .map_err(|error| format!("Could not open the image: {error}"))?
        .with_guessed_format()
        .map_err(|error| format!("Could not read the image format: {error}"))?
        .decode()
        .map_err(|error| format!("Could not decode the image: {error}"))?
        .resize(48, 48, image::imageops::FilterType::Triangle)
        .to_rgba8();
    let mut buckets = HashMap::<(u8, u8, u8), ([u64; 3], u64)>::new();
    for pixel in image.pixels().step_by(4) {
        if pixel[3] < 160 {
            continue;
        }
        let key = (quantize(pixel[0]), quantize(pixel[1]), quantize(pixel[2]));
        let bucket = buckets.entry(key).or_insert(([0, 0, 0], 0));
        bucket.0[0] += u64::from(pixel[0]);
        bucket.0[1] += u64::from(pixel[1]);
        bucket.0[2] += u64::from(pixel[2]);
        bucket.1 += 1;
    }
    let mut buckets = buckets.into_values().collect::<Vec<_>>();
    buckets.sort_by(|left, right| right.1.cmp(&left.1));
    let colors = buckets
        .into_iter()
        .take(5)
        .map(|(sum, count)| {
            [
                (sum[0] / count) as u8,
                (sum[1] / count) as u8,
                (sum[2] / count) as u8,
            ]
        })
        .collect::<Vec<_>>();
    if colors.is_empty() {
        return Err("This image has no visible colors to sample.".into());
    }
    let dominant_colors = colors
        .iter()
        .map(|rgb| format!("#{:02x}{:02x}{:02x}", rgb[0], rgb[1], rgb[2]))
        .collect();
    let mut color_names = Vec::new();
    for rgb in colors {
        let name = nearest_color_name(rgb).to_string();
        if !color_names.contains(&name) {
            color_names.push(name);
        }
    }
    Ok(ColorIndex {
        dominant_colors,
        color_names,
    })
}

fn quantize(value: u8) -> u8 {
    ((u16::from(value) + 16) / 32 * 32).min(255) as u8
}

fn nearest_color_name(rgb: [u8; 3]) -> &'static str {
    const COLORS: &[(&str, [i32; 3])] = &[
        ("black", [18, 18, 18]),
        ("white", [242, 242, 238]),
        ("gray", [128, 128, 128]),
        ("red", [216, 48, 42]),
        ("orange", [235, 127, 38]),
        ("yellow", [232, 205, 48]),
        ("green", [48, 155, 74]),
        ("blue", [50, 100, 210]),
        ("purple", [125, 75, 180]),
        ("pink", [226, 94, 154]),
        ("brown", [126, 82, 48]),
    ];
    COLORS
        .iter()
        .min_by_key(|(_, candidate)| {
            (i32::from(rgb[0]) - candidate[0]).pow(2)
                + (i32::from(rgb[1]) - candidate[1]).pow(2)
                + (i32::from(rgb[2]) - candidate[2]).pow(2)
        })
        .map(|(name, _)| *name)
        .unwrap_or("gray")
}

fn empty_metadata() -> MediaMetadata {
    MediaMetadata {
        width: None,
        height: None,
        dominant_colors: Vec::new(),
        color_names: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        capture_metadata, extract_color_index, migrate_legacy_sidecars, read_capture_manifest,
        CAPTURE_MANIFEST_FILENAME,
    };
    use std::{fs, time::SystemTime};

    #[test]
    fn reads_koi_capture_sidecar_for_media_stem() {
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("koi-scanner-{unique}"));
        fs::create_dir_all(&directory).expect("temporary directory should be created");
        let media_path = directory.join("reference.jpg");
        let sidecar_path = directory.join("reference.koi.json");
        fs::write(&media_path, []).expect("placeholder media should be written");
        fs::write(
            sidecar_path,
            r#"{
              "captureType": "link",
              "sourceUrl": "https://example.com/card.jpg",
              "sourceFinalUrl": "https://cdn.example.com/card.webp",
              "sourcePageUrl": "https://example.com/article",
              "sourceCanonicalUrl": "https://example.com/articles/example",
              "sourceLinkUrl": "https://example.com/products/card",
              "sourceTitle": "Example article",
              "sourcePageTitle": "Example page",
              "sourceSiteName": "Example",
              "sourceDescription": "A captured example page.",
              "capturedAt": "2026-08-12T08:00:00.000Z"
            }"#,
        )
        .expect("sidecar should be written");

        migrate_legacy_sidecars(&directory).expect("sidecar should migrate");
        let manifest = read_capture_manifest(&directory);
        let metadata = capture_metadata(&media_path, &manifest);
        assert_eq!(metadata.capture_type.as_deref(), Some("link"));
        assert_eq!(
            metadata.source_page_url.as_deref(),
            Some("https://example.com/article")
        );
        assert_eq!(metadata.source_title.as_deref(), Some("Example article"));
        assert_eq!(
            metadata.source_link_url.as_deref(),
            Some("https://example.com/products/card")
        );
        assert_eq!(
            metadata.source_final_url.as_deref(),
            Some("https://cdn.example.com/card.webp")
        );
        assert_eq!(
            metadata.source_description.as_deref(),
            Some("A captured example page.")
        );
        assert!(directory.join(CAPTURE_MANIFEST_FILENAME).is_file());
        assert!(!directory.join("reference.koi.json").exists());

        fs::remove_dir_all(directory).expect("temporary directory should be removed");
    }

    #[test]
    fn extracts_a_palette_from_a_local_image() {
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("koi-colors-{unique}.png"));
        let image = image::RgbaImage::from_pixel(12, 12, image::Rgba([32, 96, 208, 255]));
        image.save(&path).expect("test image should save");
        let index = extract_color_index(&path).expect("palette should be extracted");
        assert_eq!(index.dominant_colors.len(), 1);
        assert_eq!(index.color_names, vec!["blue"]);
        let _ = fs::remove_file(path);
    }
}
