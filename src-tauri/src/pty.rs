use arboard::Clipboard;
use base64::Engine;
use image::{ColorType, ImageFormat};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    session_id: String,
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

pub type Sessions = Arc<Mutex<HashMap<String, PtySession>>>;

pub struct PtyState {
    pub sessions: Sessions,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyOutputEvent {
    session_id: String,
    data: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyExitEvent {
    session_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PtyErrorEvent {
    session_id: String,
    error: String,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ClipboardPayload {
    Text { text: String },
    Image {
        #[serde(rename = "filePath")]
        file_path: String,
        mime: String,
    },
}

fn clipboard_dir() -> std::path::PathBuf {
    std::env::temp_dir().join("forge-clipboard")
}

fn save_clipboard_file(bytes: &[u8], ext: &str) -> Result<String, String> {
    let tmp_dir = clipboard_dir();
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    let filename = format!("paste-{}.{}", uuid::Uuid::new_v4(), ext);
    let path = tmp_dir.join(&filename);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

fn save_clipboard_rgba_image(bytes: &[u8], width: usize, height: usize) -> Result<String, String> {
    let tmp_dir = clipboard_dir();
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    let filename = format!("paste-{}.png", uuid::Uuid::new_v4());
    let path = tmp_dir.join(&filename);
    image::save_buffer_with_format(
        &path,
        bytes,
        width as u32,
        height as u32,
        ColorType::Rgba8,
        ImageFormat::Png,
    )
    .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    state: State<'_, PtyState>,
    tab_id: String,
    session_id: String,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = CommandBuilder::new("powershell.exe");
        c.arg("-NoLogo");
        c
    } else {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut c = CommandBuilder::new(shell);
        c.arg("-l");
        c
    };
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    let session = PtySession {
        session_id: session_id.clone(),
        writer,
        master: pair.master,
        child,
    };

    let replaced_session = state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(tab_id.clone(), session);
    if let Some(mut old_session) = replaced_session {
        let _ = old_session.child.kill();
    }

    let event_name = format!("pty-output-{}", tab_id);
    let exit_event_name = format!("pty-exit-{}", tab_id);
    let error_event_name = format!("pty-error-{}", tab_id);
    let sessions = Arc::clone(&state.sessions);
    let cleanup_tab_id = tab_id.clone();
    let cleanup_session_id = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut carry = Vec::new();
        loop {
            let offset = carry.len();
            if offset >= buf.len() {
                let data = String::from_utf8_lossy(&carry).to_string();
                let _ = app.emit(
                    &event_name,
                    PtyOutputEvent {
                        session_id: session_id.clone(),
                        data,
                    },
                );
                carry.clear();
                continue;
            }
            if offset > 0 {
                buf[..offset].copy_from_slice(&carry);
                carry.clear();
            }
            match reader.read(&mut buf[offset..]) {
                Ok(0) => {
                    if offset > 0 {
                        let data = String::from_utf8_lossy(&buf[..offset]).to_string();
                        let _ = app.emit(
                            &event_name,
                            PtyOutputEvent {
                                session_id: session_id.clone(),
                                data,
                            },
                        );
                    }
                    let _ = app.emit(
                        &exit_event_name,
                        PtyExitEvent {
                            session_id: session_id.clone(),
                        },
                    );
                    break;
                }
                Ok(n) => {
                    let total = offset + n;
                    match std::str::from_utf8(&buf[..total]) {
                        Ok(valid) => {
                            let _ = app.emit(
                                &event_name,
                                PtyOutputEvent {
                                    session_id: session_id.clone(),
                                    data: valid.to_string(),
                                },
                            );
                        }
                        Err(e) => {
                            let valid_up_to = e.valid_up_to();
                            if valid_up_to > 0 {
                                let valid = unsafe { std::str::from_utf8_unchecked(&buf[..valid_up_to]) };
                                let _ = app.emit(
                                    &event_name,
                                    PtyOutputEvent {
                                        session_id: session_id.clone(),
                                        data: valid.to_string(),
                                    },
                                );
                            }
                            carry.extend_from_slice(&buf[valid_up_to..total]);
                        }
                    }
                }
                Err(err) => {
                    let _ = app.emit(
                        &error_event_name,
                        PtyErrorEvent {
                            session_id: session_id.clone(),
                            error: err.to_string(),
                        },
                    );
                    break;
                }
            }
        }
        if let Ok(mut sessions) = sessions.lock() {
            let should_remove = sessions
                .get(&cleanup_tab_id)
                .map(|session| session.session_id == cleanup_session_id)
                .unwrap_or(false);
            if should_remove {
                sessions.remove(&cleanup_tab_id);
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(
    state: State<'_, PtyState>,
    tab_id: String,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&tab_id)
        .ok_or_else(|| format!("no session for tab {}", tab_id))?;
    if session.session_id != session_id {
        return Err(format!("stale session for tab {}", tab_id));
    }
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, PtyState>,
    tab_id: String,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&tab_id)
        .ok_or_else(|| format!("no session for tab {}", tab_id))?;
    if session.session_id != session_id {
        return Err(format!("stale session for tab {}", tab_id));
    }
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn kill_pty(state: State<'_, PtyState>, tab_id: String, session_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&tab_id) {
        if session.session_id == session_id {
            let _ = session.child.kill();
        } else {
            sessions.insert(tab_id, session);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn save_clipboard_image(data_base64: String, mime: String) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("bad base64: {}", e))?;

    let ext = match mime.as_str() {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/bmp" => "bmp",
        _ => "png",
    };

    save_clipboard_file(&bytes, ext)
}

#[tauri::command]
pub fn write_clipboard_text(text: String) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_clipboard_payload() -> Result<Option<ClipboardPayload>, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;

    match clipboard.get_image() {
        Ok(image) => {
            let file_path = save_clipboard_rgba_image(&image.bytes, image.width, image.height)?;
            return Ok(Some(ClipboardPayload::Image {
                file_path,
                mime: "image/png".to_string(),
            }));
        }
        Err(arboard::Error::ContentNotAvailable) => {}
        Err(error) => return Err(error.to_string()),
    }

    match clipboard.get_text() {
        Ok(text) if !text.is_empty() => Ok(Some(ClipboardPayload::Text { text })),
        Ok(_) => Ok(None),
        Err(arboard::Error::ContentNotAvailable) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}
