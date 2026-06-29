use serde::{Deserialize, Serialize};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};

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
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryState {
    pub folders: Vec<Folder>,
    pub items: Vec<MediaItem>,
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "apng", "avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "svg", "tif", "tiff",
    "webp",
];

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
    scan_dir(&root, &root, folder_id, &mut items)?;
    items.sort_by(|a, b| b.modified_at.cmp(&a.modified_at).then_with(|| a.name.cmp(&b.name)));
    Ok(items)
}

fn scan_dir(root: &Path, dir: &Path, folder_id: &str, items: &mut Vec<MediaItem>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|error| format!("Could not read folder: {error}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            scan_dir(root, &path, folder_id, items)?;
            continue;
        }

        if !path.is_file() || !is_media_file(&path) {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or_default()
            .to_lowercase();
        let absolute = path.to_string_lossy().to_string();
        let (dominant_colors, color_names) = color_index(&path);

        items.push(MediaItem {
            id: stable_id(&absolute),
            folder_id: folder_id.to_string(),
            path: absolute,
            name,
            extension: extension.clone(),
            kind: if extension == "gif" { "gif" } else { "image" }.to_string(),
            width: None,
            height: None,
            created_at: metadata.created().ok().and_then(to_secs),
            modified_at: metadata.modified().ok().and_then(to_secs),
            tags: Vec::new(),
            dominant_colors,
            color_names,
        });
    }

    Ok(())
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
    time.duration_since(UNIX_EPOCH).ok().map(|duration| duration.as_secs())
}

fn color_index(path: &Path) -> (Vec<String>, Vec<String>) {
    let Ok(reader) = image::ImageReader::open(path) else {
        return (Vec::new(), Vec::new());
    };
    let Ok(image) = reader.decode() else {
        return (Vec::new(), Vec::new());
    };
    let image = image.thumbnail(48, 48).to_rgb8();
    let mut buckets: std::collections::HashMap<(u8, u8, u8), usize> = std::collections::HashMap::new();

    for pixel in image.pixels().step_by(4) {
        let [r, g, b] = pixel.0;
        let key = ((r / 32) * 32, (g / 32) * 32, (b / 32) * 32);
        *buckets.entry(key).or_insert(0) += 1;
    }

    let mut buckets = buckets.into_iter().collect::<Vec<_>>();
    buckets.sort_by(|a, b| b.1.cmp(&a.1));
    let dominant = buckets.into_iter().take(5).map(|(rgb, _)| rgb).collect::<Vec<_>>();
    let dominant_colors = dominant
        .iter()
        .map(|(r, g, b)| format!("#{r:02x}{g:02x}{b:02x}"))
        .collect::<Vec<_>>();
    let mut color_names = dominant.iter().map(|rgb| nearest_color_name(*rgb)).collect::<Vec<_>>();
    color_names.dedup();

    (dominant_colors, color_names)
}

fn nearest_color_name(rgb: (u8, u8, u8)) -> String {
    const COLORS: &[(&str, (i32, i32, i32))] = &[
        ("black", (18, 18, 18)),
        ("white", (242, 242, 238)),
        ("gray", (128, 128, 128)),
        ("red", (216, 48, 42)),
        ("orange", (235, 127, 38)),
        ("yellow", (232, 205, 48)),
        ("green", (48, 155, 74)),
        ("blue", (50, 100, 210)),
        ("purple", (125, 75, 180)),
        ("pink", (226, 94, 154)),
        ("brown", (126, 82, 48)),
    ];

    let rgb = (rgb.0 as i32, rgb.1 as i32, rgb.2 as i32);
    COLORS
        .iter()
        .min_by_key(|(_, color)| {
            (rgb.0 - color.0).pow(2) + (rgb.1 - color.1).pow(2) + (rgb.2 - color.2).pow(2)
        })
        .map(|(name, _)| name.to_string())
        .unwrap_or_else(|| "gray".to_string())
}
