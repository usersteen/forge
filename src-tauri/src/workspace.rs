use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_SCAN_DEPTH: usize = 8;
const MAX_ENTRIES_PER_DIR: usize = 200;
const MAX_TOTAL_NODES: usize = 5000;
const MAX_TEXT_PREVIEW_BYTES: u64 = 512 * 1024;
const MAX_IMAGE_PREVIEW_BYTES: u64 = 8 * 1024 * 1024;
const MAX_RECENT_IMAGES: usize = 24;
const IGNORE_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    "target",
    ".next",
    ".turbo",
    ".idea",
    ".vscode",
];

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "mdx", "markdown"];
const TEXT_EXTENSIONS: &[&str] = &[
    "txt", "log", "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "js",
    "jsx", "ts", "tsx", "css", "html", "rs", "py", "sh", "ps1", "c", "h", "cpp", "hpp", "java",
    "go", "rb", "php", "sql",
];
const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

#[derive(Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub file_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

#[derive(Serialize)]
pub struct WorkspaceScanResult {
    pub root_path: String,
    pub nodes: Vec<FileNode>,
    pub truncated: bool,
    pub scanned_at: u64,
}

#[derive(Serialize)]
pub struct WorkspaceFilePayload {
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub title: String,
    pub content: Option<String>,
    pub asset_path: Option<String>,
    pub byte_size: u64,
    pub truncated: bool,
}

#[derive(Serialize, Clone)]
pub struct WorkspaceImageRef {
    pub path: String,
    pub title: String,
    pub byte_size: u64,
    pub modified_at: u64,
}

struct ScanLimits {
    total_nodes: usize,
    truncated: bool,
}

#[tauri::command]
pub fn pick_workspace_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "$shell = New-Object -ComObject Shell.Application; $folder = $shell.BrowseForFolder(0, 'Select Forge workspace folder', 0); if ($folder) { $folder.Self.Path }",
            ])
            .output()
            .map_err(|err| format!("Failed to open folder picker: {err}"))?;

        if !output.status.success() {
            return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
        }

        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if path.is_empty() {
            return Ok(None);
        }

        return Ok(Some(path));
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Folder picker is not implemented on this platform".to_string())
    }
}

#[tauri::command]
pub fn scan_workspace(root_path: String) -> Result<WorkspaceScanResult, String> {
    let canonical_root = canonicalize_root(&root_path)?;
    let mut limits = ScanLimits {
        total_nodes: 0,
        truncated: false,
    };
    let nodes = scan_directory(&canonical_root, &canonical_root, 0, &mut limits)?;

    Ok(WorkspaceScanResult {
        root_path: canonical_root.to_string_lossy().to_string(),
        nodes,
        truncated: limits.truncated,
        scanned_at: now_unix_seconds(),
    })
}

#[tauri::command]
pub fn read_workspace_file(root_path: String, relative_path: String) -> Result<WorkspaceFilePayload, String> {
    let canonical_root = canonicalize_root(&root_path)?;
    let relative = sanitize_relative_path(&relative_path)?;
    let resolved = resolve_file_within_root(&canonical_root, &relative)?;
    let metadata = fs::metadata(&resolved).map_err(|err| format!("Failed to read file metadata: {err}"))?;

    if !metadata.is_file() {
        return Err("The selected path is not a file".to_string());
    }

    let byte_size = metadata.len();
    let file_type = classify_path(&resolved).to_string();
    let title = resolved
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled")
        .to_string();
    let relative_string = normalize_relative_path(&relative);
    let preview_limit = match classify_path(&resolved) {
        "image" => MAX_IMAGE_PREVIEW_BYTES,
        _ => MAX_TEXT_PREVIEW_BYTES,
    };

    if byte_size > preview_limit {
        return Ok(WorkspaceFilePayload {
            path: relative_string,
            file_type,
            title,
            content: None,
            asset_path: None,
            byte_size,
            truncated: true,
        });
    }

    match classify_path(&resolved) {
        "markdown" | "text" => {
            let content = fs::read_to_string(&resolved).map_err(|err| format!("Failed to read file: {err}"))?;
            Ok(WorkspaceFilePayload {
                path: relative_string,
                file_type,
                title,
                content: Some(content),
                asset_path: None,
                byte_size,
                truncated: false,
            })
        }
        "image" => Ok(WorkspaceFilePayload {
            path: relative_string,
            file_type,
            title,
            content: None,
            asset_path: Some(build_image_data_url(&resolved)?),
            byte_size,
            truncated: false,
        }),
        _ => Ok(WorkspaceFilePayload {
            path: relative_string,
            file_type: "unsupported".to_string(),
            title,
            content: None,
            asset_path: None,
            byte_size,
            truncated: false,
        }),
    }
}

#[tauri::command]
pub fn write_workspace_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<WorkspaceFilePayload, String> {
    let canonical_root = canonicalize_root(&root_path)?;
    let relative = sanitize_relative_path(&relative_path)?;
    let resolved = resolve_file_within_root(&canonical_root, &relative)?;
    let metadata = fs::metadata(&resolved).map_err(|err| format!("Failed to read file metadata: {err}"))?;

    if !metadata.is_file() {
        return Err("The selected path is not a file".to_string());
    }

    if classify_path(&resolved) != "markdown" {
        return Err("Only markdown files can be edited in Forge".to_string());
    }

    fs::write(&resolved, content.as_bytes()).map_err(|err| format!("Failed to save file: {err}"))?;

    let relative_string = normalize_relative_path(&relative);
    let title = resolved
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled")
        .to_string();

    Ok(WorkspaceFilePayload {
        path: relative_string,
        file_type: "markdown".to_string(),
        title,
        content: Some(content.clone()),
        asset_path: None,
        byte_size: content.as_bytes().len() as u64,
        truncated: false,
    })
}

#[tauri::command]
pub fn collect_images(root_path: String) -> Result<Vec<WorkspaceImageRef>, String> {
    let canonical_root = canonicalize_root(&root_path)?;
    let mut images = Vec::new();
    collect_images_recursive(&canonical_root, &canonical_root, 0, &mut images)?;
    images.sort_by(|a, b| b.modified_at.cmp(&a.modified_at).then_with(|| a.path.cmp(&b.path)));
    images.truncate(MAX_RECENT_IMAGES);
    Ok(images)
}

fn canonicalize_root(root_path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(root_path);
    if !root.exists() {
        return Err("Workspace root does not exist".to_string());
    }

    let canonical = fs::canonicalize(&root).map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let metadata = fs::metadata(&canonical).map_err(|err| format!("Failed to inspect workspace root: {err}"))?;
    if !metadata.is_dir() {
        return Err("Workspace root must be a directory".to_string());
    }

    Ok(canonical)
}

fn sanitize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let raw = Path::new(relative_path);
    if raw.is_absolute() {
        return Err("Expected a root-relative path".to_string());
    }

    let mut sanitized = PathBuf::new();
    for component in raw.components() {
        match component {
            Component::CurDir => {}
            Component::Normal(part) => sanitized.push(part),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Path escapes the workspace root".to_string())
            }
        }
    }

    if sanitized.as_os_str().is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    Ok(sanitized)
}

fn resolve_file_within_root(root: &Path, relative: &Path) -> Result<PathBuf, String> {
    let joined = root.join(relative);
    if !joined.exists() {
        return Err("File does not exist".to_string());
    }

    let canonical = fs::canonicalize(&joined).map_err(|err| format!("Failed to resolve file path: {err}"))?;
    if !canonical.starts_with(root) {
        return Err("Resolved path escapes the workspace root".to_string());
    }

    Ok(canonical)
}

fn scan_directory(root: &Path, current_dir: &Path, depth: usize, limits: &mut ScanLimits) -> Result<Vec<FileNode>, String> {
    if depth > MAX_SCAN_DEPTH {
        limits.truncated = true;
        return Ok(Vec::new());
    }

    let mut entries = fs::read_dir(current_dir)
        .map_err(|err| format!("Failed to scan workspace: {err}"))?
        .filter_map(|entry| entry.ok())
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| {
        let a_name = a.file_name().to_string_lossy().to_lowercase();
        let b_name = b.file_name().to_string_lossy().to_lowercase();
        a_name.cmp(&b_name)
    });

    if entries.len() > MAX_ENTRIES_PER_DIR {
        entries.truncate(MAX_ENTRIES_PER_DIR);
        limits.truncated = true;
    }

    let mut nodes = Vec::new();

    for entry in entries {
        if limits.total_nodes >= MAX_TOTAL_NODES {
            limits.truncated = true;
            break;
        }

        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let file_type = metadata.file_type();
        let target_metadata = match fs::metadata(&path) {
            Ok(target_metadata) => target_metadata,
            Err(_) => continue,
        };

        if target_metadata.is_dir() {
            if should_ignore_directory(&name) || file_type.is_symlink() {
                continue;
            }

            let canonical_dir = match fs::canonicalize(&path) {
                Ok(canonical_dir) if canonical_dir.starts_with(root) => canonical_dir,
                _ => {
                    limits.truncated = true;
                    continue;
                }
            };

            limits.total_nodes += 1;
            let children = scan_directory(root, &canonical_dir, depth + 1, limits)?;
            nodes.push(FileNode {
                name,
                path: normalize_relative_path(path.strip_prefix(root).map_err(|_| "Failed to normalize directory".to_string())?),
                kind: "directory".to_string(),
                file_type: "directory".to_string(),
                children: Some(children),
            });
            continue;
        }

        if !target_metadata.is_file() {
            continue;
        }

        let canonical_file = match fs::canonicalize(&path) {
            Ok(canonical_file) if canonical_file.starts_with(root) => canonical_file,
            _ => {
                limits.truncated = true;
                continue;
            }
        };

        limits.total_nodes += 1;
        nodes.push(FileNode {
            name,
            path: normalize_relative_path(
                canonical_file
                    .strip_prefix(root)
                    .map_err(|_| "Failed to normalize file".to_string())?,
            ),
            kind: "file".to_string(),
            file_type: classify_path(&canonical_file).to_string(),
            children: None,
        });
    }

    Ok(nodes)
}

fn collect_images_recursive(
    root: &Path,
    current_dir: &Path,
    depth: usize,
    images: &mut Vec<WorkspaceImageRef>,
) -> Result<(), String> {
    if depth > MAX_SCAN_DEPTH {
        return Ok(());
    }

    let mut entries = fs::read_dir(current_dir)
        .map_err(|err| format!("Failed to collect images: {err}"))?
        .filter_map(|entry| entry.ok())
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| {
        let a_name = a.file_name().to_string_lossy().to_lowercase();
        let b_name = b.file_name().to_string_lossy().to_lowercase();
        a_name.cmp(&b_name)
    });

    if entries.len() > MAX_ENTRIES_PER_DIR {
        entries.truncate(MAX_ENTRIES_PER_DIR);
    }

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let file_type = metadata.file_type();
        let target_metadata = match fs::metadata(&path) {
            Ok(target_metadata) => target_metadata,
            Err(_) => continue,
        };

        if target_metadata.is_dir() {
            if should_ignore_directory(&name) || file_type.is_symlink() {
                continue;
            }

            let canonical_dir = match fs::canonicalize(&path) {
                Ok(canonical_dir) if canonical_dir.starts_with(root) => canonical_dir,
                _ => continue,
            };
            collect_images_recursive(root, &canonical_dir, depth + 1, images)?;
            continue;
        }

        if !target_metadata.is_file() {
            continue;
        }

        let canonical_file = match fs::canonicalize(&path) {
            Ok(canonical_file) if canonical_file.starts_with(root) => canonical_file,
            _ => continue,
        };

        if classify_path(&canonical_file) != "image" {
            continue;
        }

        let file_metadata = match fs::metadata(&canonical_file) {
            Ok(file_metadata) if file_metadata.is_file() => file_metadata,
            _ => continue,
        };

        let modified_at = file_metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);

        let relative = match canonical_file.strip_prefix(root) {
            Ok(relative) => normalize_relative_path(relative),
            Err(_) => continue,
        };

        images.push(WorkspaceImageRef {
            path: relative,
            title: canonical_file
                .file_name()
                .and_then(|file_name| file_name.to_str())
                .unwrap_or("Image")
                .to_string(),
            byte_size: file_metadata.len(),
            modified_at,
        });
    }

    Ok(())
}

fn should_ignore_directory(name: &str) -> bool {
    IGNORE_DIRS.iter().any(|ignored| ignored.eq_ignore_ascii_case(name))
}

fn classify_path(path: &Path) -> &'static str {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();

    if MARKDOWN_EXTENSIONS.contains(&extension.as_str()) {
        "markdown"
    } else if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        "image"
    } else if TEXT_EXTENSIONS.contains(&extension.as_str()) {
        "text"
    } else {
        "other"
    }
}

fn build_image_data_url(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|err| format!("Failed to read image: {err}"))?;
    let mime_type = mime_type_for_path(path);
    let encoded = BASE64_STANDARD.encode(bytes);
    Ok(format!("data:{mime_type};base64,{encoded}"))
}

fn mime_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}
