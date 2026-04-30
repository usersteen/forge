use crate::comment_server;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::webview::WebviewBuilder;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl};

pub struct PreviewState {
    pub tabs: Arc<Mutex<HashMap<String, String>>>, // tab_id -> webview label
}

impl PreviewState {
    pub fn new() -> Self {
        Self {
            tabs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

const PICKER_JS: &str = include_str!("../resources/picker.js");
const PICKER_CSS: &str = include_str!("../resources/picker-heph.css");

fn label_for(tab_id: &str) -> String {
    format!("preview-{tab_id}")
}

fn build_init_script(tab_id: &str, port: u16, picker_css: Option<String>) -> String {
    let css = picker_css.unwrap_or_else(|| PICKER_CSS.to_string());
    let css_json = serde_json::to_string(&css).unwrap_or_else(|_| "\"\"".into());
    let tab_json = serde_json::to_string(tab_id).unwrap_or_else(|_| "\"\"".into());
    format!(
        "window.__forgePickerConfig = {{ commentServerPort: {port}, css: {css_json}, tabId: {tab_json} }};\n{js}",
        js = PICKER_JS,
    )
}

#[tauri::command]
pub async fn open_preview_webview(
    app: AppHandle,
    state: tauri::State<'_, PreviewState>,
    tab_id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    picker_css: Option<String>,
) -> Result<(), String> {
    let label = label_for(&tab_id);

    if let Some(existing) = app.get_webview(&label) {
        let _ = existing.set_position(LogicalPosition::new(x, y));
        let _ = existing.set_size(LogicalSize::new(width.max(1.0), height.max(1.0)));
        return Ok(());
    }

    let parsed_url: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    let port = comment_server::current_port().unwrap_or(47823);
    let init = build_init_script(&tab_id, port, picker_css);

    let window = app
        .get_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    // Workaround for Tauri/WebView2 child webviews on Windows: passing the
    // URL to WebviewBuilder::new doesn't always trigger navigation. Create
    // the child empty (about:blank) and call navigate() explicitly.
    let blank_url: url::Url = "about:blank".parse().unwrap();
    let builder = WebviewBuilder::new(label.clone(), WebviewUrl::External(blank_url))
        .initialization_script(&init);

    let webview = window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width.max(1.0), height.max(1.0)),
        )
        .map_err(|e| e.to_string())?;

    log::info!("preview webview created label={label} url={parsed_url}");
    webview
        .navigate(parsed_url)
        .map_err(|e: tauri::Error| e.to_string())?;

    state
        .tabs
        .lock()
        .map_err(|e| e.to_string())?
        .insert(tab_id, label);
    Ok(())
}

#[tauri::command]
pub fn set_preview_bounds(
    app: AppHandle,
    tab_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = label_for(&tab_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "preview webview not found".to_string())?;
    webview
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    webview
        .set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_preview_visible(
    app: AppHandle,
    tab_id: String,
    visible: bool,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = label_for(&tab_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "preview webview not found".to_string())?;
    if visible {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(width.max(1.0), height.max(1.0)))
            .map_err(|e| e.to_string())?;
    } else {
        // Move offscreen with size 1x1; Tauri child webviews don't support hide().
        webview
            .set_size(LogicalSize::new(1.0, 1.0))
            .map_err(|e| e.to_string())?;
        webview
            .set_position(LogicalPosition::new(-10000.0, -10000.0))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn close_preview_webview(
    app: AppHandle,
    state: tauri::State<'_, PreviewState>,
    tab_id: String,
) -> Result<(), String> {
    let label = label_for(&tab_id);
    if let Some(webview) = app.get_webview(&label) {
        let _ = webview.close();
    }
    if let Ok(mut tabs) = state.tabs.lock() {
        tabs.remove(&tab_id);
    }
    Ok(())
}

#[tauri::command]
pub fn preview_navigate(app: AppHandle, tab_id: String, url: String) -> Result<(), String> {
    let label = label_for(&tab_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "preview webview not found".to_string())?;
    let parsed: url::Url = url.parse().map_err(|e: url::ParseError| e.to_string())?;
    webview.navigate(parsed).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn preview_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = label_for(&tab_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "preview webview not found".to_string())?;
    webview
        .eval("window.location.reload()")
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn preview_history(app: AppHandle, tab_id: String, dir: i32) -> Result<(), String> {
    let label = label_for(&tab_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "preview webview not found".to_string())?;
    let script = if dir < 0 {
        "window.history.back()"
    } else {
        "window.history.forward()"
    };
    webview.eval(script).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn preview_set_comment_mode(
    app: AppHandle,
    tab_id: String,
    on: bool,
    picker_css: Option<String>,
) -> Result<(), String> {
    let label = label_for(&tab_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| "preview webview not found".to_string())?;
    let css_json = serde_json::to_string(&picker_css.unwrap_or_default())
        .unwrap_or_else(|_| "\"\"".into());
    let script = format!(
        r#"(function() {{
          var css = {css};
          if (css) {{
            var style = document.getElementById("__forge-picker-theme-style");
            if (!style) {{
              style = document.createElement("style");
              style.id = "__forge-picker-theme-style";
              document.documentElement.appendChild(style);
            }}
            style.textContent = css;
          }}
          if (window.__forgePicker) window.__forgePicker.setMode({on});
        }})();"#,
        css = css_json,
        on = json!(on)
    );
    webview.eval(&script).map_err(|e| e.to_string())?;
    Ok(())
}
