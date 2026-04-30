use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

static BOUND_PORT: OnceLock<u16> = OnceLock::new();

pub fn current_port() -> Option<u16> {
    BOUND_PORT.get().copied()
}
use tauri::{AppHandle, Emitter};
use tower_http::cors::{Any, CorsLayer};

const PORT_START: u16 = 47823;
const PORT_RANGE: u16 = 10;

fn forge_data_dir() -> PathBuf {
    let home = if cfg!(target_os = "windows") {
        std::env::var("USERPROFILE")
    } else {
        std::env::var("HOME")
    }
    .unwrap_or_else(|_| ".".to_string());
    let config_dir =
        std::env::var("FORGE_CONFIG_DIR_NAME").unwrap_or_else(|_| ".forge".to_string());
    PathBuf::from(home).join(config_dir)
}

fn comments_dir() -> PathBuf {
    forge_data_dir().join("comments")
}

#[derive(Deserialize, Debug, Clone)]
struct SourceLocation {
    file: Option<String>,
    line: Option<u32>,
    column: Option<u32>,
}

#[derive(Deserialize, Debug)]
struct CommentRequest {
    #[serde(rename = "tabId")]
    tab_id: String,
    comment: String,
    selector: Option<String>,
    source: Option<SourceLocation>,
    html: Option<String>,
    text: Option<String>,
    origin: Option<String>,
    provider: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct CommentReceivedEvent {
    tab_id: String,
    provider: String,
    origin: String,
    comment: String,
    short_label: String,
    launch_command: String,
    prompt_path: String,
    initial_prompt: String,
}

#[derive(Serialize)]
struct PortFile {
    port: u16,
}

struct ServerState {
    app: AppHandle,
    expected_host_prefix: String,
}

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_server(app).await {
            log::warn!("comment server failed: {e}");
        }
    });
}

async fn run_server(app: AppHandle) -> Result<(), String> {
    let (listener, port) = bind_port()
        .await
        .ok_or_else(|| "no free port".to_string())?;
    persist_port(port);
    let _ = BOUND_PORT.set(port);
    log::info!("comment server listening on 127.0.0.1:{port}");

    let state = Arc::new(ServerState {
        app,
        expected_host_prefix: format!("127.0.0.1:{port}"),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let router = Router::new()
        .route("/comments", post(handle_comment))
        .with_state(state)
        .layer(cors);

    axum::serve(listener, router)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn bind_port() -> Option<(tokio::net::TcpListener, u16)> {
    for offset in 0..PORT_RANGE {
        let port = PORT_START + offset;
        let addr: SocketAddr = ([127, 0, 0, 1], port).into();
        if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
            return Some((listener, port));
        }
    }
    None
}

fn persist_port(port: u16) {
    let dir = forge_data_dir();
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let payload = PortFile { port };
    if let Ok(json) = serde_json::to_string_pretty(&payload) {
        let _ = fs::write(dir.join("comment-server.json"), json);
    }
}

async fn handle_comment(
    State(state): State<Arc<ServerState>>,
    headers: HeaderMap,
    Json(body): Json<CommentRequest>,
) -> Result<StatusCode, StatusCode> {
    let host_ok = headers
        .get("host")
        .and_then(|v| v.to_str().ok())
        .map(|h| h == state.expected_host_prefix)
        .unwrap_or(false);
    if !host_ok {
        return Err(StatusCode::FORBIDDEN);
    }

    let comment = body.comment.trim();
    if comment.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let provider = match body.provider.as_deref() {
        Some("codex") => "codex",
        _ => "claude",
    }
    .to_string();

    let origin = body.origin.unwrap_or_default();
    let prompt = build_prompt(
        &origin,
        comment,
        body.selector.as_deref(),
        body.source.as_ref(),
        body.html.as_deref(),
        body.text.as_deref(),
    );

    let (prompt_path, launch_command) = match write_prompt_and_command(&provider, &prompt) {
        Ok(pair) => pair,
        Err(e) => {
            log::warn!("failed to write comment prompt: {e}");
            return Err(StatusCode::INTERNAL_SERVER_ERROR);
        }
    };

    let event = CommentReceivedEvent {
        tab_id: body.tab_id,
        provider,
        origin,
        short_label: short_label(comment),
        comment: comment.to_string(),
        launch_command,
        prompt_path,
        initial_prompt: prompt,
    };

    state
        .app
        .emit("comment:received", &event)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::ACCEPTED)
}

fn short_label(comment: &str) -> String {
    let trimmed: String = comment
        .split_whitespace()
        .take(5)
        .collect::<Vec<_>>()
        .join(" ");
    let limited: String = trimmed.chars().take(40).collect();
    if limited.is_empty() {
        "Comment".to_string()
    } else {
        limited
    }
}

fn build_prompt(
    origin: &str,
    comment: &str,
    selector: Option<&str>,
    source: Option<&SourceLocation>,
    html: Option<&str>,
    text: Option<&str>,
) -> String {
    let mut out = String::new();
    out.push_str("Design review comment");
    if !origin.is_empty() {
        out.push_str(&format!(" from {origin}"));
    }
    out.push_str(":\n\n");
    for line in comment.lines() {
        out.push_str("> ");
        out.push_str(line);
        out.push('\n');
    }
    out.push_str("\nTarget element:\n");
    if let Some(sel) = selector {
        if !sel.is_empty() {
            out.push_str(&format!("- Selector: {sel}\n"));
        }
    }
    if let Some(src) = source {
        if let Some(file) = &src.file {
            let mut loc = file.clone();
            if let Some(line) = src.line {
                loc.push(':');
                loc.push_str(&line.to_string());
                if let Some(col) = src.column {
                    loc.push(':');
                    loc.push_str(&col.to_string());
                }
            }
            out.push_str(&format!("- Source:   {loc}\n"));
        }
    }
    if let Some(h) = html {
        let snippet: String = h.chars().take(400).collect();
        out.push_str(&format!("- HTML:     {snippet}\n"));
    }
    if let Some(t) = text {
        let snippet: String = t.trim().chars().take(400).collect();
        if !snippet.is_empty() {
            out.push_str(&format!("- Text:     {snippet}\n"));
        }
    }
    if source.and_then(|src| src.file.as_ref()).is_none() {
        out.push_str("- Source:   React source metadata was not available. Use the selector, HTML, and text above to identify the element; do not ask for clarification unless those fallbacks are ambiguous.\n");
    }
    out.push_str("\nOpen the source file, propose a fix, and apply it.\n");
    out
}

fn write_prompt_and_command(provider: &str, prompt: &str) -> Result<(String, String), String> {
    let dir = comments_dir();
    write_prompt_and_command_in_dir(provider, prompt, dir)
}

fn write_prompt_and_command_in_dir(
    provider: &str,
    prompt: &str,
    dir: PathBuf,
) -> Result<(String, String), String> {
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4();
    let path = dir.join(format!("{id}.txt"));
    fs::write(&path, prompt).map_err(|e| e.to_string())?;
    let path_str = path.to_string_lossy().to_string();

    let launch_command = if cfg!(target_os = "windows") {
        format!("{provider}.cmd")
    } else {
        provider.to_string()
    };

    Ok((path_str, launch_command))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prompt_preserves_quotes_newlines_and_fallback_context() {
        let prompt = build_prompt(
            "http://localhost:3001",
            "change to \"select a glyph to inspect\"\nthen tighten spacing",
            Some("main > button:nth-of-type(2)"),
            None,
            Some("<button>Select one to inspect.</button>"),
            Some("Select one to inspect."),
        );

        assert!(prompt.contains("> change to \"select a glyph to inspect\""));
        assert!(prompt.contains("> then tighten spacing"));
        assert!(prompt.contains("- Selector: main > button:nth-of-type(2)"));
        assert!(prompt.contains("- HTML:     <button>Select one to inspect.</button>"));
        assert!(prompt.contains("- Text:     Select one to inspect."));
        assert!(prompt.contains("React source metadata was not available"));
    }

    #[test]
    fn launch_command_does_not_embed_prompt_or_shell_subcommands() {
        let prompt = "Design review comment:\n\n> apply change to \"select a glyph to inspect\"\n";
        let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("forge-comment-server-tests")
            .join(uuid::Uuid::new_v4().to_string());
        let (_path, command) =
            write_prompt_and_command_in_dir("codex", prompt, dir).expect("prompt write succeeds");

        assert!(!command.contains("Get-Content"));
        assert!(!command.contains("apply change to"));
        assert!(!command.contains('"'));
        if cfg!(target_os = "windows") {
            assert_eq!(command, "codex.cmd");
        } else {
            assert_eq!(command, "codex");
        }
    }
}
