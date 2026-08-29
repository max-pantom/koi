use crate::{db, scanner};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::Path,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Emitter};

pub const MCP_PORT: u16 = 48_372;
const MAX_REQUEST_BYTES: usize = 1024 * 1024;
const SUPPORTED_PROTOCOL_VERSIONS: &[&str] = &["2025-03-26", "2025-06-18"];
const LATEST_PROTOCOL_VERSION: &str = "2025-06-18";

static MCP_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub token: String,
    pub sidecar_path: String,
}

/// Bind the loopback listener once at app startup. Every request re-checks
/// the persisted enable flag, so toggling never requires restarting it.
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let address = format!("127.0.0.1:{MCP_PORT}");
        let listener = match TcpListener::bind(&address) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("Koi MCP server unavailable on {address}: {error}");
                return;
            }
        };
        MCP_RUNNING.store(true, Ordering::SeqCst);

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let connection_app = app.clone();
                    std::thread::spawn(move || handle_stream(&connection_app, stream));
                }
                Err(error) => eprintln!("Koi MCP connection failed: {error}"),
            }
        }
    });
}

pub fn status(app: &AppHandle) -> Result<McpStatus, String> {
    let enabled = db::get_setting(app, "mcp.enabled").map(|value| value.as_deref() == Some("1"))?;
    let token = ensure_token(app)?;
    Ok(McpStatus {
        enabled,
        running: MCP_RUNNING.load(Ordering::SeqCst),
        port: MCP_PORT,
        token,
        sidecar_path: sidecar_path(),
    })
}

pub fn set_enabled(app: AppHandle, enabled: bool) -> Result<McpStatus, String> {
    db::set_setting(&app, "mcp.enabled", if enabled { "1" } else { "0" })?;
    ensure_token(&app)?;
    status(&app)
}

pub fn regenerate_token(app: AppHandle) -> Result<McpStatus, String> {
    let token = random_token()?;
    db::set_setting(&app, "mcp.token", &token)?;
    status(&app)
}

fn ensure_token(app: &AppHandle) -> Result<String, String> {
    if let Some(token) = db::get_setting(app, "mcp.token")? {
        if !token.is_empty() {
            return Ok(token);
        }
    }
    let token = random_token()?;
    db::set_setting(app, "mcp.token", &token)?;
    Ok(token)
}

fn random_token() -> Result<String, String> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("Could not securely create an MCP token: {error}"))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

fn sidecar_path() -> String {
    let executable = if cfg!(windows) {
        "koi-mcp.exe"
    } else {
        "koi-mcp"
    };
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.join(executable)))
        .unwrap_or_else(|| executable.into())
        .to_string_lossy()
        .to_string()
}

fn handle_stream(app: &AppHandle, mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let request = match read_request(&mut stream) {
        Ok(request) => request,
        Err(error) => {
            write_http(&mut stream, 400, "Bad Request", &json_body(&error));
            return;
        }
    };

    match request.method.as_str() {
        "POST" => handle_rpc(app, &mut stream, &request),
        "GET" | "DELETE" => write_http(
            &mut stream,
            405,
            "Method Not Allowed",
            &json_body("Koi MCP accepts POST requests only."),
        ),
        _ => write_http(
            &mut stream,
            405,
            "Method Not Allowed",
            &json_body("Unsupported method."),
        ),
    }
}

fn handle_rpc(app: &AppHandle, stream: &mut TcpStream, request: &HttpRequest) {
    let path = request.path.as_str();
    if path != "/mcp" && !path.starts_with("/mcp?") {
        write_http(
            stream,
            404,
            "Not Found",
            &json_body("Koi MCP is served at /mcp."),
        );
        return;
    }
    if !origin_allowed(request) {
        write_http(
            stream,
            403,
            "Forbidden",
            &json_body("Cross-origin MCP requests are not allowed."),
        );
        return;
    }
    if !authorized(app, request) {
        write_http(
            stream,
            401,
            "Unauthorized",
            &json_body("A valid Koi MCP token is required."),
        );
        return;
    }

    let enabled = db::get_setting(app, "mcp.enabled")
        .map(|value| value.as_deref() == Some("1"))
        .unwrap_or(false);
    if !enabled {
        write_http(
            stream,
            503,
            "Service Unavailable",
            &json_body("Koi MCP is turned off."),
        );
        return;
    }

    let payload: Value = match serde_json::from_slice(&request.body) {
        Ok(payload) => payload,
        Err(_) => {
            write_http(
                stream,
                400,
                "Bad Request",
                &json_body("The request body is not valid JSON."),
            );
            return;
        }
    };

    let id = payload.get("id").cloned();
    let method = payload
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let params = payload.get("params").cloned().unwrap_or_else(|| json!({}));

    // Notifications carry no id and expect no response payload beyond 202.
    let Some(id) = id else {
        write_http(stream, 202, "Accepted", "");
        return;
    };

    let response = match method {
        "initialize" => {
            let requested = params
                .get("protocolVersion")
                .and_then(Value::as_str)
                .unwrap_or(LATEST_PROTOCOL_VERSION);
            let protocol_version = if SUPPORTED_PROTOCOL_VERSIONS.contains(&requested) {
                requested.to_string()
            } else {
                LATEST_PROTOCOL_VERSION.to_string()
            };
            ok_response(
                id,
                json!({
                    "protocolVersion": protocol_version,
                    "capabilities": { "tools": { "listChanged": false } },
                    "serverInfo": {
                        "name": "koi",
                        "title": "Koi Library",
                        "version": env!("CARGO_PKG_VERSION"),
                    },
                }),
            )
        }
        "ping" => ok_response(id, json!({})),
        "tools/list" => ok_response(id, json!({ "tools": tool_definitions() })),
        "tools/call" => {
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            match call_tool(app, name, &arguments) {
                Ok(content) => ok_response(id, json!({ "content": content, "isError": false })),
                Err(error) => ok_response(
                    id,
                    json!({
                        "content": [{ "type": "text", "text": error }],
                        "isError": true,
                    }),
                ),
            }
        }
        other => error_response(id, -32_601, format!("Method not found: {other}")),
    };

    write_http(stream, 200, "OK", &response.to_string());
}

fn ok_response(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn error_response(id: Value, code: i32, message: String) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

fn authorized(app: &AppHandle, request: &HttpRequest) -> bool {
    let expected = match db::get_setting(app, "mcp.token") {
        Ok(Some(token)) if !token.is_empty() => token,
        _ => return false,
    };
    let bearer_ok = request
        .header("authorization")
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .map(|token| constant_time_eq(token.as_bytes(), expected.as_bytes()))
        .unwrap_or(false);
    let header_ok = request
        .header("x-koi-token")
        .map(|token| constant_time_eq(token.trim().as_bytes(), expected.as_bytes()))
        .unwrap_or(false);
    bearer_ok || header_ok
}

fn origin_allowed(request: &HttpRequest) -> bool {
    let Some(origin) = request.header("origin") else {
        return true;
    };
    let origin = origin.trim().trim_end_matches('/').to_ascii_lowercase();
    origin == "http://localhost"
        || origin.starts_with("http://localhost:")
        || origin == "http://127.0.0.1"
        || origin.starts_with("http://127.0.0.1:")
        || origin == "http://[::1]"
        || origin.starts_with("http://[::1]:")
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut difference = 0_u8;
    for (a, b) in left.iter().zip(right.iter()) {
        difference |= a ^ b;
    }
    difference == 0
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

fn tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "name": "search_library",
            "description": "Search the user's Koi moodboard library by free-text query. Matches names, tags, source sites/titles/descriptions, colors, folders, and file types.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Free-text search query." },
                    "folderId": { "type": "string", "description": "Optional folder id to restrict the search." },
                    "limit": { "type": "integer", "description": "Maximum results (default 20, max 100)." }
                },
                "required": ["query"]
            }
        }),
        json!({
            "name": "find_by_color",
            "description": "Find library items whose dominant palette matches a color name (e.g. \"teal\", \"sage\" falls back to green) or hex value.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "color": { "type": "string", "description": "Color name or #rrggbb hex." },
                    "limit": { "type": "integer", "description": "Maximum results (default 20, max 100)." }
                },
                "required": ["color"]
            }
        }),
        json!({
            "name": "get_item",
            "description": "Get full metadata for one library item, including capture provenance (source URLs, site, description).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mediaId": { "type": "string" }
                },
                "required": ["mediaId"]
            }
        }),
        json!({
            "name": "get_item_image",
            "description": "View an item's actual image, downscaled, so you can see visual references. Returns image content.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mediaId": { "type": "string" },
                    "maxWidth": { "type": "integer", "description": "Maximum width in pixels (default 1024)." }
                },
                "required": ["mediaId"]
            }
        }),
        json!({
            "name": "read_article",
            "description": "Read the saved markdown body of an article capture.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mediaId": { "type": "string" }
                },
                "required": ["mediaId"]
            }
        }),
        json!({
            "name": "list_folders",
            "description": "List the folders registered in the Koi library with their ids.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "list_tags",
            "description": "List every tag used across the library with usage counts.",
            "inputSchema": { "type": "object", "properties": {} }
        }),
        json!({
            "name": "add_tags",
            "description": "Replace an item's tags with a new list. Tags are trimmed, lowercased, and deduplicated.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "mediaId": { "type": "string" },
                    "tags": { "type": "array", "items": { "type": "string" } }
                },
                "required": ["mediaId", "tags"]
            }
        }),
    ]
}

fn call_tool(app: &AppHandle, name: &str, args: &Value) -> Result<Vec<Value>, String> {
    let text = |payload: String| Ok(vec![json!({ "type": "text", "text": payload })]);
    match name {
        "search_library" => {
            let query = string_arg(args, "query").ok_or("A query is required.")?;
            let limit = limit_arg(args)?;
            text(search_library_tool(
                app,
                query,
                string_arg(args, "folderId"),
                limit,
            )?)
        }
        "find_by_color" => {
            let color = string_arg(args, "color").ok_or("A color name or hex is required.")?;
            let limit = limit_arg(args)?;
            text(find_by_color_tool(app, color, limit)?)
        }
        "get_item" => {
            let media_id = string_arg(args, "mediaId").ok_or("A mediaId is required.")?;
            text(get_item_tool(app, media_id)?)
        }
        "get_item_image" => {
            let media_id = string_arg(args, "mediaId").ok_or("A mediaId is required.")?;
            let max_width = args
                .get("maxWidth")
                .and_then(Value::as_u64)
                .unwrap_or(1024)
                .clamp(64, 2048) as u32;
            get_item_image_tool(app, media_id, max_width)
        }
        "read_article" => {
            let media_id = string_arg(args, "mediaId").ok_or("A mediaId is required.")?;
            text(read_article_tool(app, media_id)?)
        }
        "list_folders" => text(list_folders_tool(app)?),
        "list_tags" => text(list_tags_tool(app)?),
        "add_tags" => {
            let media_id = string_arg(args, "mediaId").ok_or("A mediaId is required.")?;
            let tags = args
                .get("tags")
                .and_then(Value::as_array)
                .map(|values| {
                    values
                        .iter()
                        .filter_map(Value::as_str)
                        .map(String::from)
                        .collect::<Vec<_>>()
                })
                .ok_or("A tags array is required.")?;
            text(add_tags_tool(app, media_id, tags)?)
        }
        other => Err(format!("Unknown tool: {other}")),
    }
}

fn search_library_tool(
    app: &AppHandle,
    query: &str,
    folder_id: Option<&str>,
    limit: usize,
) -> Result<String, String> {
    let library = db::get_library(app)?;
    let folder_names: HashMap<&str, &str> = library
        .folders
        .iter()
        .map(|folder| (folder.id.as_str(), folder.name.as_str()))
        .collect();
    let tokens: Vec<String> = tokenize(query);

    let mut scored: Vec<(f64, &scanner::MediaItem)> = library
        .items
        .iter()
        .filter(|item| folder_id.is_none_or(|id| item.folder_id == id))
        .filter_map(|item| {
            score_item(
                item,
                &tokens,
                folder_names
                    .get(item.folder_id.as_str())
                    .copied()
                    .unwrap_or(""),
            )
            .map(|score| (score, item))
        })
        .collect();
    scored.sort_by(|left, right| {
        right
            .0
            .partial_cmp(&left.0)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let items: Vec<Value> = scored
        .into_iter()
        .take(limit)
        .map(|(_, item)| item_summary(item, folder_names.get(item.folder_id.as_str()).copied()))
        .collect();
    serde_json::to_string(&json!({ "count": items.len(), "items": items }))
        .map_err(|error| error.to_string())
}

fn find_by_color_tool(app: &AppHandle, color: &str, limit: usize) -> Result<String, String> {
    let library = db::get_library(app)?;
    let trimmed = color.trim().to_lowercase();
    let folder_names: HashMap<&str, &str> = library
        .folders
        .iter()
        .map(|folder| (folder.id.as_str(), folder.name.as_str()))
        .collect();

    let target_rgb = parse_hex_color(trimmed.trim_start_matches('#'));
    let name_to_match = if trimmed.starts_with('#') {
        None
    } else {
        Some(target_rgb.map_or_else(|| trimmed.clone(), nearest_color_name))
    };

    let mut matches: Vec<(f64, &scanner::MediaItem)> = library
        .items
        .iter()
        .filter_map(|item| {
            let mut best: Option<f64> = None;
            if let Some(name) = &name_to_match {
                if item.color_names.iter().any(|candidate| candidate == name) {
                    best = Some(1.0);
                }
            }
            if let Some(rgb) = target_rgb {
                for hex in &item.dominant_colors {
                    let Some(candidate) = parse_hex_color(hex.trim_start_matches('#')) else {
                        continue;
                    };
                    let distance = ((candidate[0] - rgb[0]).powi(2)
                        + (candidate[1] - rgb[1]).powi(2)
                        + (candidate[2] - rgb[2]).powi(2))
                    .sqrt();
                    if distance <= 64.0 {
                        let score = 1.0 - distance / 64.0;
                        if best.is_none() || score > best.unwrap_or(0.0) {
                            best = Some(score);
                        }
                    }
                }
            }
            best.map(|score| (score, item))
        })
        .collect();
    matches.sort_by(|left, right| {
        right
            .0
            .partial_cmp(&left.0)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let items: Vec<Value> = matches
        .into_iter()
        .take(limit)
        .map(|(_, item)| item_summary(item, folder_names.get(item.folder_id.as_str()).copied()))
        .collect();
    serde_json::to_string(&json!({ "color": trimmed, "count": items.len(), "items": items }))
        .map_err(|error| error.to_string())
}

/// Nearest of the eleven canonical Koi color names for a hex lookup.
fn nearest_color_name(rgb: [f64; 3]) -> String {
    const ANCHORS: &[(&str, [f64; 3])] = &[
        ("black", [18.0, 18.0, 18.0]),
        ("white", [242.0, 242.0, 238.0]),
        ("gray", [128.0, 128.0, 128.0]),
        ("red", [216.0, 48.0, 42.0]),
        ("orange", [235.0, 127.0, 38.0]),
        ("yellow", [232.0, 205.0, 48.0]),
        ("green", [48.0, 155.0, 74.0]),
        ("blue", [50.0, 100.0, 210.0]),
        ("purple", [125.0, 75.0, 180.0]),
        ("pink", [226.0, 94.0, 154.0]),
        ("brown", [126.0, 82.0, 48.0]),
    ];
    ANCHORS
        .iter()
        .min_by(|(_, left), (_, right)| {
            distance_squared(rgb, *left)
                .partial_cmp(&distance_squared(rgb, *right))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(name, _)| (*name).to_string())
        .unwrap_or_else(|| "gray".to_string())
}

fn distance_squared(left: [f64; 3], right: [f64; 3]) -> f64 {
    (left[0] - right[0]).powi(2) + (left[1] - right[1]).powi(2) + (left[2] - right[2]).powi(2)
}

fn get_item_tool(app: &AppHandle, media_id: &str) -> Result<String, String> {
    let item = db::media_by_id(app, media_id)?
        .ok_or_else(|| "That item is no longer in Koi.".to_string())?;
    let payload = json!({
        "item": item_summary(&item, None),
        "sourceDescription": item.source_description,
        "sourceByline": item.source_byline,
        "sourceCanonicalUrl": item.source_canonical_url,
        "sourceLinkUrl": item.source_link_url,
        "dimensions": { "width": item.width, "height": item.height },
    });
    serde_json::to_string(&payload).map_err(|error| error.to_string())
}

fn get_item_image_tool(
    app: &AppHandle,
    media_id: &str,
    max_width: u32,
) -> Result<Vec<Value>, String> {
    let item = db::media_by_id(app, media_id)?
        .ok_or_else(|| "That item is no longer in Koi.".to_string())?;
    if item.kind == "video" {
        return Err("Videos cannot be rendered as images.".into());
    }
    let path = Path::new(&item.path);
    if !path.is_file() {
        return Err("The original image file is missing.".into());
    }

    let image = image::ImageReader::open(path)
        .and_then(|reader| reader.with_guessed_format())
        .map_err(|error| format!("Could not open the image: {error}"))?
        .decode()
        .map_err(|_| "This image format cannot be decoded for viewing.".to_string())?;
    let aspect = f64::from(image.height()) / f64::from(image.width()).max(1.0);
    let width = max_width.min(image.width());
    let height = ((width as f64 * aspect).round() as u32).max(1);
    let rendered = image.resize_exact(width.max(1), height, image::imageops::FilterType::Triangle);

    let mut jpeg = Vec::new();
    rendered
        .write_to(
            &mut std::io::Cursor::new(&mut jpeg),
            image::ImageFormat::Jpeg,
        )
        .map_err(|error| format!("Could not prepare the image: {error}"))?;

    Ok(vec![
        json!({
            "type": "image",
            "data": base64_encode(&jpeg),
            "mimeType": "image/jpeg",
        }),
        json!({ "type": "text", "text": format!("{} ({}×{})", item.name, width, height) }),
    ])
}

fn read_article_tool(app: &AppHandle, media_id: &str) -> Result<String, String> {
    let item = db::media_by_id(app, media_id)?
        .ok_or_else(|| "That item is no longer in Koi.".to_string())?;
    let markdown = item
        .source_content_markdown
        .filter(|markdown| !markdown.is_empty())
        .ok_or_else(|| "This item has no saved article body.".to_string())?;
    serde_json::to_string(&json!({
        "title": item.source_title.clone().or(item.source_page_title),
        "siteName": item.source_site_name,
        "url": item.source_page_url.clone().or(item.source_url),
        "markdown": markdown,
    }))
    .map_err(|error| error.to_string())
}

fn list_folders_tool(app: &AppHandle) -> Result<String, String> {
    let library = db::get_library(app)?;
    let folders: Vec<Value> = library
        .folders
        .iter()
        .map(|folder| json!({ "id": folder.id, "name": folder.name }))
        .collect();
    serde_json::to_string(&json!({ "folders": folders })).map_err(|error| error.to_string())
}

fn list_tags_tool(app: &AppHandle) -> Result<String, String> {
    let library = db::get_library(app)?;
    let mut counts: HashMap<String, usize> = HashMap::new();
    for item in &library.items {
        for tag in &item.tags {
            *counts.entry(tag.clone()).or_default() += 1;
        }
    }
    let mut tags: Vec<Value> = counts
        .into_iter()
        .map(|(tag, count)| json!({ "tag": tag, "count": count }))
        .collect();
    tags.sort_by(|left, right| {
        right["count"]
            .as_u64()
            .cmp(&left["count"].as_u64())
            .then_with(|| left["tag"].as_str().cmp(&right["tag"].as_str()))
    });
    serde_json::to_string(&json!({ "tags": tags })).map_err(|error| error.to_string())
}

fn add_tags_tool(app: &AppHandle, media_id: &str, tags: Vec<String>) -> Result<String, String> {
    let mut cleaned = tags
        .iter()
        .map(|tag| tag.trim().trim_start_matches('#').to_lowercase())
        .filter(|tag| !tag.is_empty());
    let mut unique: Vec<String> = Vec::new();
    for tag in cleaned.by_ref() {
        if !unique.contains(&tag) {
            unique.push(tag);
        }
    }
    db::save_tags(app, media_id, &unique)?;
    let _ = app.emit("library-changed", ());
    serde_json::to_string(&json!({ "mediaId": media_id, "tags": unique }))
        .map_err(|error| error.to_string())
}

// ---------------------------------------------------------------------------
// Scoring (mirrors src/lib/search.ts weights)
// ---------------------------------------------------------------------------

const MARKDOWN_INDEX_LIMIT: usize = 20_000;

fn item_summary(item: &scanner::MediaItem, folder_name: Option<&str>) -> Value {
    json!({
        "id": item.id,
        "name": item.name,
        "kind": item.kind,
        "folder": folder_name,
        "tags": item.tags,
        "colorNames": item.color_names,
        "dominantColors": item.dominant_colors,
        "width": item.width,
        "height": item.height,
        "capturedAt": item.captured_at,
        "captureType": item.capture_type,
        "sourceTitle": item.source_title,
        "sourcePageUrl": item.source_page_url.clone().or_else(|| item.source_url.clone()),
    })
}

fn score_item(item: &scanner::MediaItem, tokens: &[String], folder_name: &str) -> Option<f64> {
    if tokens.is_empty() {
        return None;
    }
    let fields: [(&str, String, f64); 6] = [
        ("name", normalize_text(&item.name), 10.0),
        ("tag", normalize_text(&item.tags.join(" ")), 9.0),
        (
            "site",
            normalize_text(
                &[
                    item.source_title.clone(),
                    item.source_page_title.clone(),
                    item.source_site_name.clone(),
                    truncate(item.source_description.as_deref()),
                    truncate(item.source_content_markdown.as_deref()),
                ]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" "),
            ),
            7.0,
        ),
        (
            "color",
            normalize_text(&[item.color_names.join(" "), item.dominant_colors.join(" ")].join(" ")),
            7.0,
        ),
        ("folder", normalize_text(folder_name), 6.0),
        (
            "type",
            normalize_text(
                &[
                    Some(item.kind.clone()),
                    item.capture_type.clone(),
                    Some(item.extension.clone()),
                ]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" "),
            ),
            5.0,
        ),
    ];

    let mut total = 0.0;
    let mut matched = 0_usize;
    for token in tokens {
        let mut best = 0.0;
        for (_, value, weight) in &fields {
            if value.is_empty() {
                continue;
            }
            let compact = value.replace(' ', "");
            let score = if value.split(' ').any(|word| word == token) {
                10.0
            } else if compact == *token {
                11.0
            } else if value
                .split(' ')
                .any(|word| word.starts_with(token.as_str()))
            {
                7.0
            } else if value.contains(token.as_str()) {
                5.0
            } else {
                0.0
            };
            if score * weight > best {
                best = score * weight;
            }
        }
        if best > 0.0 {
            matched += 1;
            total += best;
        }
    }

    if matched == 0 {
        return None;
    }
    Some(total + (matched as f64 / tokens.len() as f64) * 40.0)
}

fn tokenize(query: &str) -> Vec<String> {
    normalize_text(query)
        .split(' ')
        .filter(|token| !token.is_empty() && *token != "-")
        .map(String::from)
        .collect()
}

fn normalize_text(value: &str) -> String {
    let lowered = value.to_lowercase();
    let mut normalized = String::with_capacity(lowered.len());
    let mut last_space = true;
    for character in lowered.chars() {
        if character.is_alphanumeric() {
            normalized.push(character);
            last_space = false;
        } else if !last_space {
            normalized.push(' ');
            last_space = true;
        }
    }
    while normalized.ends_with(' ') {
        normalized.pop();
    }
    normalized
}

fn truncate(value: Option<&str>) -> Option<String> {
    value.map(|value| value.chars().take(MARKDOWN_INDEX_LIMIT).collect())
}

fn string_arg<'a>(args: &'a Value, key: &str) -> Option<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
}

fn limit_arg(args: &Value) -> Result<usize, String> {
    let limit = args.get("limit").and_then(Value::as_u64).unwrap_or(20);
    if limit > 100 {
        return Err("The maximum limit is 100.".into());
    }
    Ok(limit.max(1) as usize)
}

fn parse_hex_color(value: &str) -> Option<[f64; 3]> {
    let hex = value.trim_start_matches('#');
    let expanded = match hex.len() {
        3 => hex.chars().flat_map(|c| [c, c]).collect::<String>(),
        6 => hex.to_string(),
        _ => return None,
    };
    if !expanded.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let channel =
        |range: std::ops::Range<usize>| u8::from_str_radix(&expanded[range], 16).map(f64::from);
    Some([
        channel(0..2).ok()?,
        channel(2..4).ok()?,
        channel(4..6).ok()?,
    ])
}

fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let bytes = [
            chunk.first().copied().unwrap_or(0),
            chunk.get(1).copied().unwrap_or(0),
            chunk.get(2).copied().unwrap_or(0),
        ];
        let triple = (u32::from(bytes[0]) << 16) | (u32::from(bytes[1]) << 8) | u32::from(bytes[2]);
        encoded.push(ALPHABET[(triple >> 18) as usize & 63] as char);
        encoded.push(ALPHABET[(triple >> 12) as usize & 63] as char);
        encoded.push(if chunk.len() > 1 {
            ALPHABET[(triple >> 6) as usize & 63] as char
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            ALPHABET[triple as usize & 63] as char
        } else {
            '='
        });
    }
    encoded
}

// ---------------------------------------------------------------------------
// Minimal HTTP plumbing
// ---------------------------------------------------------------------------

struct HttpRequest {
    method: String,
    path: String,
    headers: Vec<(String, String)>,
    body: Vec<u8>,
}

impl HttpRequest {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }
}

fn read_request(stream: &mut TcpStream) -> Result<HttpRequest, String> {
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 4096];
    let header_end;
    loop {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("The request ended early.".into());
        }
        bytes.extend_from_slice(&buffer[..read]);
        if bytes.len() > MAX_REQUEST_BYTES {
            return Err("The request is too large.".into());
        }
        if let Some(index) = find_subsequence(&bytes, b"\r\n\r\n") {
            header_end = index + 4;
            break;
        }
    }

    let head = std::str::from_utf8(&bytes[..header_end - 4])
        .map_err(|_| "Invalid request headers.".to_string())?;
    let mut lines = head.split("\r\n");
    let mut request_line = lines.next().unwrap_or_default().split_whitespace();
    let method = request_line.next().unwrap_or_default().to_uppercase();
    let path = request_line.next().unwrap_or_default().to_string();
    let headers = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .collect::<Vec<_>>();
    let content_length = headers
        .iter()
        .find(|(key, _)| key.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, value)| value.parse::<usize>().ok())
        .unwrap_or_default();
    if header_end + content_length > MAX_REQUEST_BYTES {
        return Err("The request body is too large.".into());
    }
    while bytes.len() < header_end + content_length {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("The request ended early.".into());
        }
        bytes.extend_from_slice(&buffer[..read]);
    }

    Ok(HttpRequest {
        method,
        path,
        headers,
        body: bytes[header_end..header_end + content_length].to_vec(),
    })
}

fn write_http(stream: &mut TcpStream, status: u16, reason: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

fn json_body(message: &str) -> String {
    serde_json::json!({ "error": message }).to_string()
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

#[cfg(test)]
mod tests {
    use super::{
        base64_encode, constant_time_eq, find_subsequence, normalize_text, ok_response,
        origin_allowed, parse_hex_color, score_item, tokenize, truncate, HttpRequest,
    };
    use crate::scanner::MediaItem;

    fn media_item(name: &str) -> MediaItem {
        serde_json::from_str::<serde_json::Value>(&format!(
            r#"{{
                "id": "1", "folderId": "f", "path": "/{name}", "name": "{name}",
                "extension": "jpg", "kind": "image", "tags": [], "dominantColors": [],
                "colorNames": [], "missing": false
            }}"#
        ))
        .map(|value| serde_json::from_value(value).expect("media item should deserialize"))
        .expect("media item should build")
    }

    #[test]
    fn scores_partial_matches_and_rewards_coverage() {
        let mut full = media_item("landing.jpg");
        full.tags = vec!["editorial".into()];
        full.source_site_name = Some("Are.na".into());
        let mut partial = media_item("landing-2.jpg");
        partial.tags = vec!["editorial".into()];
        partial.source_site_name = Some("Dribbble".into());

        let tokens = tokenize("editorial arena");
        let full_score = score_item(&full, &tokens, "").expect("full match should score");
        let partial_score =
            score_item(&partial, &tokens, "").expect("partial match should still score");
        assert!(full_score > partial_score);
    }

    #[test]
    fn rejects_items_matching_nothing() {
        let item = media_item("mountain.jpg");
        assert!(score_item(&item, &tokenize("ocean"), "").is_none());
    }

    #[test]
    fn normalizes_punctuation_into_word_boundaries() {
        assert_eq!(normalize_text("Are.na — Editorial!"), "are na editorial");
    }

    #[test]
    fn parses_three_and_six_digit_hex_colors() {
        assert_eq!(parse_hex_color("#204080"), Some([32.0, 64.0, 128.0]));
        assert_eq!(parse_hex_color("f00"), Some([255.0, 0.0, 0.0]));
        assert_eq!(parse_hex_color("nope"), None);
    }

    #[test]
    fn encodes_base64_without_padding_surprises() {
        assert_eq!(base64_encode(b"koi"), "a29p");
        assert_eq!(base64_encode(b"ko"), "a28=");
        assert_eq!(base64_encode(b"k"), "aw==");
    }

    #[test]
    fn compares_tokens_in_constant_time_shape() {
        assert!(constant_time_eq(b"abc", b"abc"));
        assert!(!constant_time_eq(b"abc", b"abd"));
        assert!(!constant_time_eq(b"abc", b"abcd"));
    }

    #[test]
    fn wraps_results_in_a_jsonrpc_envelope() {
        let response = ok_response(serde_json::json!(7), serde_json::json!({ "echo": true }));
        assert_eq!(response["id"], 7);
        assert_eq!(response["result"]["echo"], true);
    }

    #[test]
    fn finds_http_header_boundary() {
        assert_eq!(
            find_subsequence(b"POST /mcp HTTP/1.1\r\n\r\n{}", b"\r\n\r\n"),
            Some(18)
        );
    }

    #[test]
    fn only_allows_local_browser_origins() {
        let request = |origin: &str| HttpRequest {
            method: "POST".into(),
            path: "/mcp".into(),
            headers: vec![("Origin".into(), origin.into())],
            body: Vec::new(),
        };
        assert!(origin_allowed(&request("http://127.0.0.1:1420")));
        assert!(origin_allowed(&request("http://localhost:3000")));
        assert!(!origin_allowed(&request("https://example.com")));
    }

    #[test]
    fn truncates_unicode_without_splitting_a_character() {
        let long = "水".repeat(20_005);
        assert_eq!(truncate(Some(&long)).unwrap().chars().count(), 20_000);
    }
}
