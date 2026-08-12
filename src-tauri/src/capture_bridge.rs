use crate::{db, scanner};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Component, Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};

pub const CAPTURE_BRIDGE_PORT: u16 = 48_371;
const MAX_REQUEST_BYTES: usize = 64 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeFolder {
    id: String,
    name: String,
    is_capture_inbox: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RouteCaptureRequest {
    destination_folder_id: String,
    image_filename: String,
    sidecar_filename: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RouteCaptureResponse {
    routed: bool,
    folder_name: String,
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let address = format!("127.0.0.1:{CAPTURE_BRIDGE_PORT}");
        let listener = match TcpListener::bind(&address) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("Koi Capture bridge unavailable on {address}: {error}");
                return;
            }
        };

        for stream in listener.incoming() {
            match stream {
                Ok(stream) => handle_stream(&app, stream),
                Err(error) => eprintln!("Koi Capture bridge connection failed: {error}"),
            }
        }
    });
}

fn handle_stream(app: &AppHandle, mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let request = match read_request(&mut stream) {
        Ok(request) => request,
        Err(error) => {
            write_json(&mut stream, 400, "Bad Request", None, &error_json(&error));
            return;
        }
    };
    let request_origin = request.header("origin");
    let origin = request_origin.filter(|origin| origin.starts_with("chrome-extension://"));
    let is_extension_request = is_extension_request(&request);

    if request.method == "OPTIONS" {
        if let Some(origin) = origin {
            write_json(&mut stream, 204, "No Content", Some(origin), "");
        } else {
            write_json(
                &mut stream,
                403,
                "Forbidden",
                None,
                &error_json("Koi only accepts extension requests."),
            );
        }
        return;
    }

    let result = match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/v1/folders") if is_extension_request => list_folders(app),
        ("GET", "/v1/folders") => Err("Koi only accepts extension requests.".into()),
        ("POST", "/v1/captures/route") if is_extension_request => route_capture(app, &request.body),
        ("POST", "/v1/captures/route") => Err("Koi only accepts extension requests.".into()),
        _ => Err("That Koi Capture endpoint does not exist.".into()),
    };

    match result {
        Ok(body) => write_json(&mut stream, 200, "OK", origin, &body),
        Err(error) => write_json(
            &mut stream,
            if error.contains("does not exist") {
                404
            } else {
                400
            },
            if error.contains("does not exist") {
                "Not Found"
            } else {
                "Bad Request"
            },
            origin,
            &error_json(&error),
        ),
    }
}

fn list_folders(app: &AppHandle) -> Result<String, String> {
    let library = db::get_library(app)?;
    let inbox = capture_inbox_path(app)?;
    let folders = library
        .folders
        .into_iter()
        .filter(|folder| Path::new(&folder.path).is_dir())
        .map(|folder| BridgeFolder {
            is_capture_inbox: Path::new(&folder.path) == inbox,
            id: folder.id,
            name: folder.name,
        })
        .collect::<Vec<_>>();
    serde_json::to_string(&serde_json::json!({
        "app": "Koi",
        "version": 1,
        "folders": folders,
    }))
    .map_err(|error| error.to_string())
}

fn route_capture(app: &AppHandle, body: &[u8]) -> Result<String, String> {
    let request = serde_json::from_slice::<RouteCaptureRequest>(body)
        .map_err(|_| "The capture routing request is invalid.".to_string())?;
    validate_filename(&request.image_filename)?;
    validate_filename(&request.sidecar_filename)?;

    let folder = db::folder_by_id(app, &request.destination_folder_id)?
        .ok_or_else(|| "That destination folder is no longer in Koi.".to_string())?;
    let destination = PathBuf::from(&folder.path);
    if !destination.is_dir() {
        return Err("That destination folder is unavailable. Reconnect it in Koi.".into());
    }

    let inbox = capture_inbox_path(app)?;
    let source_image = inbox.join(&request.image_filename);
    let source_sidecar = inbox.join(&request.sidecar_filename);
    if !source_image.is_file() || !source_sidecar.is_file() {
        return Err("Chrome finished the capture, but Koi could not find both saved files.".into());
    }
    if destination == inbox {
        return serialize_route_response(true, folder.name);
    }

    let destination_image = destination.join(&request.image_filename);
    let destination_sidecar = destination.join(&request.sidecar_filename);
    if destination_image.exists() || destination_sidecar.exists() {
        return Err("A capture with that name already exists in the destination folder.".into());
    }

    move_file(&source_image, &destination_image)?;
    if let Err(error) = move_file(&source_sidecar, &destination_sidecar) {
        let _ = move_file(&destination_image, &source_image);
        return Err(error);
    }

    sync_path(app, &inbox)?;
    sync_path(app, &destination)?;
    let _ = app.emit("library-changed", ());
    serialize_route_response(true, folder.name)
}

fn serialize_route_response(routed: bool, folder_name: String) -> Result<String, String> {
    serde_json::to_string(&RouteCaptureResponse {
        routed,
        folder_name,
    })
    .map_err(|error| error.to_string())
}

fn sync_path(app: &AppHandle, path: &Path) -> Result<(), String> {
    let folder = scanner::folder_from_path(path);
    let folder = db::get_library(app)?
        .folders
        .into_iter()
        .find(|candidate| candidate.path == folder.path)
        .unwrap_or(folder);
    let items = scanner::scan_folder_path(&folder.path, &folder.id)?;
    db::sync_folder_media(app, &folder.id, &items)
}

fn capture_inbox_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .download_dir()
        .map(|path| path.join("Koi Captures"))
        .map_err(|error| format!("Could not find the Downloads folder: {error}"))
}

fn validate_filename(filename: &str) -> Result<(), String> {
    let mut components = Path::new(filename).components();
    let is_single_file = matches!(components.next(), Some(Component::Normal(_)))
        && components.next().is_none()
        && !filename.starts_with('.');
    if !is_single_file {
        return Err("The capture filename is invalid.".into());
    }
    Ok(())
}

fn move_file(source: &Path, destination: &Path) -> Result<(), String> {
    match fs::rename(source, destination) {
        Ok(()) => Ok(()),
        Err(_) => {
            fs::copy(source, destination).map_err(|error| error.to_string())?;
            fs::remove_file(source).map_err(|error| error.to_string())
        }
    }
}

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

fn is_extension_request(request: &HttpRequest) -> bool {
    let has_valid_origin = request
        .header("origin")
        .map(|origin| origin.starts_with("chrome-extension://"))
        .unwrap_or(true);
    has_valid_origin && request.header("x-koi-client") == Some("chrome-extension")
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
            return Err("The Koi Capture request ended early.".into());
        }
        bytes.extend_from_slice(&buffer[..read]);
        if bytes.len() > MAX_REQUEST_BYTES {
            return Err("The Koi Capture request is too large.".into());
        }
        if let Some(index) = find_subsequence(&bytes, b"\r\n\r\n") {
            header_end = index + 4;
            break;
        }
    }

    let head = std::str::from_utf8(&bytes[..header_end - 4])
        .map_err(|_| "The Koi Capture request headers are invalid.".to_string())?;
    let mut lines = head.split("\r\n");
    let mut request_line = lines
        .next()
        .ok_or_else(|| "The Koi Capture request is empty.".to_string())?
        .split_whitespace();
    let method = request_line.next().unwrap_or_default().to_string();
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
        return Err("The Koi Capture request is too large.".into());
    }
    while bytes.len() < header_end + content_length {
        let read = stream
            .read(&mut buffer)
            .map_err(|error| error.to_string())?;
        if read == 0 {
            return Err("The Koi Capture request ended early.".into());
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

fn write_json(stream: &mut TcpStream, status: u16, reason: &str, origin: Option<&str>, body: &str) {
    let cors = origin
        .map(|origin| {
            format!(
                "Access-Control-Allow-Origin: {origin}\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, X-Koi-Client\r\nVary: Origin\r\n"
            )
        })
        .unwrap_or_default();
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\n{cors}Connection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

fn error_json(message: &str) -> String {
    serde_json::json!({ "error": message }).to_string()
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

#[cfg(test)]
mod tests {
    use super::{find_subsequence, is_extension_request, validate_filename, HttpRequest};

    fn request(headers: &[(&str, &str)]) -> HttpRequest {
        HttpRequest {
            method: "GET".into(),
            path: "/v1/folders".into(),
            headers: headers
                .iter()
                .map(|(key, value)| ((*key).into(), (*value).into()))
                .collect(),
            body: Vec::new(),
        }
    }

    #[test]
    fn accepts_extension_client_with_extension_or_omitted_origin() {
        assert!(is_extension_request(&request(&[
            ("Origin", "chrome-extension://example"),
            ("X-Koi-Client", "chrome-extension"),
        ])));
        assert!(is_extension_request(&request(&[(
            "X-Koi-Client",
            "chrome-extension"
        ),])));
        assert!(!is_extension_request(&request(&[
            ("Origin", "https://example.com"),
            ("X-Koi-Client", "chrome-extension"),
        ])));
        assert!(!is_extension_request(&request(&[])));
    }

    #[test]
    fn accepts_only_a_single_capture_filename() {
        assert!(validate_filename("capture.jpg").is_ok());
        assert!(validate_filename("capture.koi.json").is_ok());
        assert!(validate_filename("../capture.jpg").is_err());
        assert!(validate_filename("folder/capture.jpg").is_err());
        assert!(validate_filename(".hidden.jpg").is_err());
    }

    #[test]
    fn locates_http_header_boundary() {
        assert_eq!(
            find_subsequence(b"GET / HTTP/1.1\r\n\r\nbody", b"\r\n\r\n"),
            Some(14)
        );
    }

    #[test]
    fn moves_a_capture_file_without_leaving_the_inbox_copy() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("koi-route-{unique}"));
        let inbox = directory.join("inbox");
        let destination = directory.join("destination");
        std::fs::create_dir_all(&inbox).expect("inbox should be created");
        std::fs::create_dir_all(&destination).expect("destination should be created");
        let source = inbox.join("capture.jpg");
        let target = destination.join("capture.jpg");
        std::fs::write(&source, b"koi").expect("capture should be written");

        super::move_file(&source, &target).expect("capture should be moved");

        assert!(!source.exists());
        assert_eq!(
            std::fs::read(&target).expect("capture should remain readable"),
            b"koi"
        );
        std::fs::remove_dir_all(directory).expect("temporary route should be removed");
    }
}
