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
    #[serde(default)]
    pub colors_state: u8,
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
            colors_state: 0,
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

pub fn extract_color_index(path: &Path) -> Result<ColorIndex, ExtractError> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if matches!(
        extension.as_str(),
        "svg" | "heic" | "heif" | "avif" | "aviff"
    ) {
        return Err(ExtractError::unsupported(
            "This format is rendered by the webview only, so Koi cannot sample its colors.",
        ));
    }

    let image = image::ImageReader::open(path)
        .map_err(|error| ExtractError::failed(format!("Could not open the image: {error}")))?
        .with_guessed_format()
        .map_err(|error| ExtractError::failed(format!("Could not read the image format: {error}")))?
        .decode()
        // Decode failures never recover on retry, so they are treated as
        // unsupported and negatively cached instead of re-attempted forever.
        .map_err(|error| ExtractError::unsupported(format!("Could not decode the image: {error}")))?
        .resize(
            SAMPLE_SIZE,
            SAMPLE_SIZE,
            image::imageops::FilterType::Triangle,
        )
        .to_rgba8();

    let mut chromatic = HashMap::<(usize, usize, usize), ColorCluster>::new();
    let mut grays = HashMap::<usize, GrayCluster>::new();

    for pixel in image.pixels() {
        let [red, green, blue, alpha] = pixel.0;
        if alpha < OPAQUE_ALPHA_MIN {
            continue;
        }
        let (red, green, blue) = (
            f64::from(red) / 255.0,
            f64::from(green) / 255.0,
            f64::from(blue) / 255.0,
        );
        let max = red.max(green).max(blue);
        let min = red.min(green).min(blue);
        let delta = max - min;
        let value = max;
        let saturation = if max <= 0.0 { 0.0 } else { delta / max };

        if saturation < ACHROMATIC_SATURATION
            || !(DARK_VALUE_MAX..=LIGHT_VALUE_MIN).contains(&value)
        {
            let bin = (value * 6.0).round().clamp(0.0, 5.0) as usize;
            let cluster = grays.entry(bin).or_default();
            cluster.count += 1;
            cluster.sum_value += value;
            cluster.sum_r += red;
            cluster.sum_g += green;
            cluster.sum_b += blue;
            continue;
        }

        let hue = rgb_hue(red, green, blue, max, delta);
        let hue_bin = ((hue / 360.0 * HUE_BINS as f64).round() as usize) % HUE_BINS;
        let sat_bin = if saturation < 0.30 {
            0
        } else if saturation < 0.65 {
            1
        } else {
            2
        };
        let val_bin = ((value * VAL_BINS as f64).floor() as usize).clamp(0, VAL_BINS - 1);
        let cluster = chromatic.entry((hue_bin, sat_bin, val_bin)).or_default();
        cluster.count += 1;
        let weight = CHROMA_WEIGHT_FLOOR + saturation;
        let radians = hue.to_radians();
        cluster.sum_sin += radians.sin() * weight;
        cluster.sum_cos += radians.cos() * weight;
        cluster.sum_sat += saturation * weight;
        cluster.sum_value += value * weight;
        cluster.sum_weight += weight;
        cluster.sum_r += red * weight;
        cluster.sum_g += green * weight;
        cluster.sum_b += blue * weight;
    }

    if chromatic.is_empty() && grays.is_empty() {
        return Err(ExtractError::unsupported(
            "This image has no opaque pixels to sample.",
        ));
    }

    let mut clusters = chromatic.into_values().collect::<Vec<_>>();
    clusters.sort_by(|left, right| {
        cluster_score(right)
            .partial_cmp(&cluster_score(left))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut picked: Vec<ColorCluster> = Vec::new();
    for cluster in clusters {
        if picked.len() >= MAX_SWATCHES {
            break;
        }
        let hue = cluster.mean_hue();
        if picked
            .iter()
            .all(|other| hue_distance(hue, other.mean_hue()) >= MIN_HUE_SEPARATION)
        {
            picked.push(cluster);
        }
    }

    // Quiet or monochrome images rarely yield three distinct hue clusters;
    // round the palette out with the strongest neutral tones.
    let mut neutrals = grays.into_values().collect::<Vec<_>>();
    neutrals.sort_by(|left, right| right.count.cmp(&left.count));
    let neutrals = neutrals.into_iter().take(MAX_SWATCHES - picked.len());

    let mut swatches: Vec<([u8; 3], Option<f64>, f64, f64)> = picked
        .iter()
        .map(|cluster| {
            (
                cluster.representative(),
                Some(cluster.mean_hue()),
                cluster.mean_sat(),
                cluster.mean_value(),
            )
        })
        .collect();
    for neutral in neutrals {
        swatches.push((
            [
                (neutral.sum_r / neutral.count as f64 * 255.0)
                    .round()
                    .clamp(0.0, 255.0) as u8,
                (neutral.sum_g / neutral.count as f64 * 255.0)
                    .round()
                    .clamp(0.0, 255.0) as u8,
                (neutral.sum_b / neutral.count as f64 * 255.0)
                    .round()
                    .clamp(0.0, 255.0) as u8,
            ],
            None,
            0.0,
            neutral.mean_value(),
        ));
    }

    let mut dominant_colors = Vec::new();
    for (rgb, _, _, _) in &swatches {
        let hex = format!(
            "#{rgb0:02x}{rgb1:02x}{rgb2:02x}",
            rgb0 = rgb[0],
            rgb1 = rgb[1],
            rgb2 = rgb[2]
        );
        if !dominant_colors.contains(&hex) {
            dominant_colors.push(hex);
        }
    }

    let mut color_names: Vec<String> = Vec::new();
    for (_, hue, saturation, value) in &swatches {
        let name = color_name(*hue, *saturation, *value);
        if !color_names.contains(&name.to_string()) {
            color_names.push(name.to_string());
        }
    }

    Ok(ColorIndex {
        dominant_colors,
        color_names,
    })
}

#[derive(Debug)]
pub struct ExtractError {
    pub unsupported: bool,
    pub message: String,
}

impl ExtractError {
    fn unsupported(message: impl Into<String>) -> Self {
        Self {
            unsupported: true,
            message: message.into(),
        }
    }

    fn failed(message: impl Into<String>) -> Self {
        Self {
            unsupported: false,
            message: message.into(),
        }
    }
}

const SAMPLE_SIZE: u32 = 64;
const MAX_SWATCHES: usize = 5;
const HUE_BINS: usize = 18;
const VAL_BINS: usize = 4;
const OPAQUE_ALPHA_MIN: u8 = 160;
const ACHROMATIC_SATURATION: f64 = 0.14;
const DARK_VALUE_MAX: f64 = 0.07;
const LIGHT_VALUE_MIN: f64 = 0.97;
const CHROMA_WEIGHT_FLOOR: f64 = 0.2;
const MIN_HUE_SEPARATION: f64 = 24.0;

#[derive(Default)]
struct ColorCluster {
    count: u64,
    sum_sin: f64,
    sum_cos: f64,
    sum_sat: f64,
    sum_value: f64,
    sum_weight: f64,
    sum_r: f64,
    sum_g: f64,
    sum_b: f64,
}

impl ColorCluster {
    fn mean_hue(&self) -> f64 {
        if self.sum_sin == 0.0 && self.sum_cos == 0.0 {
            return 0.0;
        }
        let hue = self.sum_sin.atan2(self.sum_cos).to_degrees();
        if hue < 0.0 {
            hue + 360.0
        } else {
            hue
        }
    }

    fn mean_sat(&self) -> f64 {
        if self.sum_weight <= 0.0 {
            0.0
        } else {
            self.sum_sat / self.sum_weight
        }
    }

    fn mean_value(&self) -> f64 {
        if self.sum_weight <= 0.0 {
            0.0
        } else {
            self.sum_value / self.sum_weight
        }
    }

    fn representative(&self) -> [u8; 3] {
        if self.sum_weight <= 0.0 {
            return [128, 128, 128];
        }
        [
            (self.sum_r / self.sum_weight * 255.0)
                .round()
                .clamp(0.0, 255.0) as u8,
            (self.sum_g / self.sum_weight * 255.0)
                .round()
                .clamp(0.0, 255.0) as u8,
            (self.sum_b / self.sum_weight * 255.0)
                .round()
                .clamp(0.0, 255.0) as u8,
        ]
    }
}

fn cluster_score(cluster: &ColorCluster) -> f64 {
    cluster.count as f64 * (0.22 + cluster.mean_sat())
}

#[derive(Default)]
struct GrayCluster {
    count: u64,
    sum_value: f64,
    sum_r: f64,
    sum_g: f64,
    sum_b: f64,
}

impl GrayCluster {
    fn mean_value(&self) -> f64 {
        if self.count == 0 {
            0.0
        } else {
            self.sum_value / self.count as f64
        }
    }
}

fn rgb_hue(red: f64, green: f64, blue: f64, max: f64, delta: f64) -> f64 {
    if delta <= 0.0 {
        return 0.0;
    }
    let sector = if (max - red).abs() < f64::EPSILON {
        (green - blue) / delta
    } else if (max - green).abs() < f64::EPSILON {
        (blue - red) / delta + 2.0
    } else {
        (red - green) / delta + 4.0
    };
    let hue = sector * 60.0;
    if hue < 0.0 {
        hue + 360.0
    } else {
        hue % 360.0
    }
}

fn hue_distance(left: f64, right: f64) -> f64 {
    let difference = (left - right).abs() % 360.0;
    if difference > 180.0 {
        360.0 - difference
    } else {
        difference
    }
}

fn color_name(hue: Option<f64>, saturation: f64, value: f64) -> &'static str {
    let Some(hue) = hue else {
        return neutral_name(value);
    };
    if value < 0.11 {
        return "black";
    }
    if !(14.0..347.0).contains(&hue) {
        "red"
    } else if hue < 41.0 {
        if value <= 0.62 && saturation >= 0.20 {
            "brown"
        } else {
            "orange"
        }
    } else if hue < 69.0 {
        "yellow"
    } else if hue < 159.0 {
        "green"
    } else if hue < 197.0 {
        // Teal band: muted cyan-greens read as green, saturated ones as blue.
        if saturation < 0.30 && value > 0.55 {
            "green"
        } else {
            "blue"
        }
    } else if hue < 257.0 {
        "blue"
    } else if hue < 297.0 || saturation > 0.45 && value < 0.55 {
        "purple"
    } else {
        "pink"
    }
}

fn neutral_name(value: f64) -> &'static str {
    if value < 0.16 {
        "black"
    } else if value > 0.93 {
        "white"
    } else {
        "gray"
    }
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

    #[test]
    fn keeps_a_vivid_accent_above_a_large_muted_background() {
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("koi-accent-{unique}.png"));
        let mut image = image::RgbaImage::from_pixel(64, 64, image::Rgba([238, 240, 242, 255]));
        for y in 20..44 {
            for x in 20..44 {
                image.put_pixel(x, y, image::Rgba([230, 60, 40, 255]));
            }
        }
        image.save(&path).expect("test image should save");
        let index = extract_color_index(&path).expect("palette should be extracted");
        assert_eq!(index.color_names.first(), Some(&"red".to_string()));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn names_monochrome_images_from_the_neutral_scale() {
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("koi-gray-{unique}.png"));
        let mut image = image::RgbaImage::new(48, 48);
        for y in 0..48_u32 {
            for x in 0..48_u32 {
                let value: u8 = (((x + y) * 255) / 94).clamp(0, 255) as u8;
                image.put_pixel(x, y, image::Rgba([value, value, value, 255]));
            }
        }
        image.save(&path).expect("test image should save");
        let index = extract_color_index(&path).expect("palette should be extracted");
        assert!(index
            .color_names
            .iter()
            .all(|name| matches!(name.as_str(), "black" | "white" | "gray")));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn reports_transparent_images_as_unsupported_instead_of_retrying_forever() {
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("koi-alpha-{unique}.png"));
        let image = image::RgbaImage::from_pixel(12, 12, image::Rgba([10, 200, 90, 8]));
        image.save(&path).expect("test image should save");
        let error = extract_color_index(&path).expect_err("transparent images cannot be sampled");
        assert!(error.unsupported);
        let _ = fs::remove_file(path);
    }
}
