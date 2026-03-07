use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

pub type Sessions = Arc<Mutex<HashMap<String, PtySession>>>;

pub struct PtyState {
    pub sessions: Sessions,
}

#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    state: State<'_, PtyState>,
    tab_id: String,
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

    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.arg("-NoLogo");
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

    let session = PtySession {
        writer,
        master: pair.master,
        child,
    };

    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .insert(tab_id.clone(), session);

    let event_name = format!("pty-output-{}", tab_id);
    let sessions = Arc::clone(&state.sessions);
    let cleanup_tab_id = tab_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit(&event_name, data);
                }
                Err(_) => break,
            }
        }
        if let Ok(mut sessions) = sessions.lock() {
            sessions.remove(&cleanup_tab_id);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(state: State<'_, PtyState>, tab_id: String, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&tab_id)
        .ok_or_else(|| format!("no session for tab {}", tab_id))?;
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
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&tab_id)
        .ok_or_else(|| format!("no session for tab {}", tab_id))?;
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
pub fn kill_pty(state: State<'_, PtyState>, tab_id: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    if let Some(mut session) = sessions.remove(&tab_id) {
        let _ = session.child.kill();
    }
    Ok(())
}
