mod config;
mod git;
mod pty;
mod workspace;

use pty::PtyState;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PtyState {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        })
        .invoke_handler(tauri::generate_handler![
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
            pty::save_clipboard_image,
            pty::write_clipboard_text,
            pty::read_clipboard_payload,
            config::load_config,
            config::save_config,
            config::export_diagnostics_report,
            config::list_repos,
            workspace::pick_workspace_folder,
            workspace::scan_workspace,
            workspace::read_workspace_file,
            workspace::write_workspace_file,
            workspace::collect_images,
            workspace::open_in_file_manager,
            git::git_repo_info,
            git::git_list_worktrees,
            git::git_add_worktree,
            git::git_remove_worktree,
            git::git_list_branches,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Set window icon for taskbar display
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                    .expect("failed to load icon");
                let _ = window.set_icon(icon);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
