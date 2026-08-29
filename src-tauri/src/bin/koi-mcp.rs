// Koi MCP stdio bridge.
//
// Speaks newline-delimited JSON-RPC on stdin/stdout (the MCP stdio transport)
// and proxies every message to Koi's local MCP HTTP endpoint. Claude Desktop
// launches this binary directly; the access token arrives via KOI_MCP_TOKEN.
//
// Environment:
//   KOI_MCP_TOKEN  required — the token shown in Koi's AI & MCP settings
//   KOI_MCP_URL    optional — defaults to http://127.0.0.1:48372/mcp

use std::io::{self, BufRead, Read, Write};
use std::net::TcpStream;
use std::time::Duration;

const DEFAULT_HOST: &str = "127.0.0.1";
const DEFAULT_PORT: u16 = 48_372;
const DEFAULT_PATH: &str = "/mcp";
const MAX_RESPONSE_BYTES: usize = 32 * 1024 * 1024;

fn main() {
    let (host, port, path) = match endpoint() {
        Ok(endpoint) => endpoint,
        Err(error) => {
            eprintln!("koi-mcp: {error}");
            std::process::exit(2);
        }
    };
    let token = std::env::var("KOI_MCP_TOKEN").unwrap_or_default();
    if token.is_empty() {
        eprintln!("koi-mcp: set KOI_MCP_TOKEN to the token from Koi's AI & MCP settings");
    }

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response = match post_json(&host, port, &path, &token, trimmed.as_bytes()) {
            Ok(Some(body)) => String::from_utf8_lossy(&body).into_owned(),
            Ok(None) => continue,
            Err(error) => match proxy_error(trimmed, &error) {
                Some(response) => response,
                None => continue,
            },
        };
        if writeln!(stdout, "{response}").is_err() || stdout.flush().is_err() {
            break;
        }
    }
}

fn endpoint() -> Result<(String, u16, String), String> {
    let Ok(url) = std::env::var("KOI_MCP_URL") else {
        return Ok((
            DEFAULT_HOST.to_string(),
            DEFAULT_PORT,
            DEFAULT_PATH.to_string(),
        ));
    };
    if url.starts_with("https://") {
        return Err("KOI_MCP_URL only supports local http:// endpoints.".into());
    }
    let rest = url.strip_prefix("http://").unwrap_or(&url);
    let (authority, path) = match rest.find('/') {
        Some(index) => (&rest[..index], rest[index..].to_string()),
        None => (rest, DEFAULT_PATH.to_string()),
    };
    let (host, port) = match authority.rsplit_once(':') {
        Some((host, port)) => (host.to_string(), port.parse().unwrap_or(DEFAULT_PORT)),
        None => (authority.to_string(), DEFAULT_PORT),
    };
    Ok((host, port, path))
}

fn post_json(
    host: &str,
    port: u16,
    path: &str,
    token: &str,
    body: &[u8],
) -> Result<Option<Vec<u8>>, String> {
    let mut request = format!(
        "POST {path} HTTP/1.1\r\nHost: {host}:{port}\r\nContent-Type: application/json\r\nAccept: application/json, text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n",
        body.len()
    );
    if !token.is_empty() {
        request.push_str(&format!("Authorization: Bearer {token}\r\n"));
    }
    request.push_str("\r\n");

    let mut stream = TcpStream::connect((host, port)).map_err(|error| {
        format!("Koi is not reachable ({error}). Open Koi and make sure MCP is enabled.")
    })?;
    stream
        .set_read_timeout(Some(Duration::from_secs(120)))
        .map_err(|error| error.to_string())?;
    stream
        .write_all(request.as_bytes())
        .and_then(|_| stream.write_all(body))
        .map_err(|error| error.to_string())?;

    let mut response = Vec::new();
    stream
        .take(MAX_RESPONSE_BYTES as u64)
        .read_to_end(&mut response)
        .map_err(|error| error.to_string())?;

    let split =
        find_subsequence(&response, b"\r\n\r\n").ok_or("Malformed HTTP response from Koi.")?;
    let head = std::str::from_utf8(&response[..split]).map_err(|_| "Malformed HTTP status.")?;
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .unwrap_or(0);
    let payload = response[split + 4..].to_vec();

    match status {
        200 => Ok(Some(payload)),
        202 => Ok(None),
        code => {
            let detail = String::from_utf8_lossy(&payload);
            Err(format!("Koi MCP returned {code}. {detail}"))
        }
    }
}

fn proxy_error(line: &str, message: &str) -> Option<String> {
    let id = serde_json::from_str::<serde_json::Value>(line)
        .ok()
        .and_then(|value| value.get("id").cloned())?;
    Some(
        serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32000, "message": message }
        })
        .to_string(),
    )
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}
