use serde::Serialize;
use std::path::Path;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct GitRepoInfo {
    pub branch: String,
    pub common_dir: String,
    pub is_worktree: bool,
}

#[derive(Serialize)]
pub struct WorktreeEntry {
    pub path: String,
    pub branch: String,
    pub is_bare: bool,
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_remote: bool,
}

fn run_git(path: &str, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    command.current_dir(path).args(args);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);

    let output = command
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub fn git_repo_info(path: String) -> Result<GitRepoInfo, String> {
    let branch = run_git(&path, &["rev-parse", "--abbrev-ref", "HEAD"])?;

    let common_dir_raw = run_git(&path, &["rev-parse", "--git-common-dir"])?;

    // Resolve to absolute path
    let common_dir = if Path::new(&common_dir_raw).is_absolute() {
        common_dir_raw
    } else {
        Path::new(&path)
            .join(&common_dir_raw)
            .canonicalize()
            .map_err(|e| format!("Failed to resolve common dir: {}", e))?
            .to_string_lossy()
            .to_string()
    };

    // Normalize: forward slashes, lowercase on Windows
    let common_dir = normalize_path(&common_dir);

    // It's a worktree if common_dir doesn't point to <path>/.git
    let main_git_dir = normalize_path(
        &Path::new(&path)
            .join(".git")
            .canonicalize()
            .unwrap_or_else(|_| Path::new(&path).join(".git"))
            .to_string_lossy(),
    );
    let is_worktree = common_dir != main_git_dir;

    Ok(GitRepoInfo {
        branch,
        common_dir,
        is_worktree,
    })
}

#[tauri::command]
pub fn git_list_worktrees(path: String) -> Result<Vec<WorktreeEntry>, String> {
    let output = run_git(&path, &["worktree", "list", "--porcelain"])?;

    let mut entries = Vec::new();
    let mut current_path = String::new();
    let mut current_branch = String::new();
    let mut current_bare = false;

    for line in output.lines() {
        if let Some(wt_path) = line.strip_prefix("worktree ") {
            // Save previous entry if exists
            if !current_path.is_empty() {
                entries.push(WorktreeEntry {
                    path: normalize_path(&current_path),
                    branch: current_branch.clone(),
                    is_bare: current_bare,
                });
            }
            current_path = wt_path.to_string();
            current_branch = String::new();
            current_bare = false;
        } else if let Some(branch_ref) = line.strip_prefix("branch ") {
            // Strip refs/heads/ prefix
            current_branch = branch_ref
                .strip_prefix("refs/heads/")
                .unwrap_or(branch_ref)
                .to_string();
        } else if line == "bare" {
            current_bare = true;
        } else if line == "detached" {
            current_branch = "detached".to_string();
        }
    }

    // Don't forget the last entry
    if !current_path.is_empty() {
        entries.push(WorktreeEntry {
            path: normalize_path(&current_path),
            branch: current_branch,
            is_bare: current_bare,
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn git_add_worktree(
    repo_path: String,
    worktree_path: String,
    branch: String,
    create_branch: bool,
) -> Result<String, String> {
    if create_branch {
        run_git(
            &repo_path,
            &["worktree", "add", "-b", &branch, &worktree_path],
        )?;
    } else {
        run_git(
            &repo_path,
            &["worktree", "add", &worktree_path, &branch],
        )?;
    }

    // Return the absolute path of the created worktree
    let abs_path = Path::new(&worktree_path)
        .canonicalize()
        .unwrap_or_else(|_| {
            if Path::new(&worktree_path).is_absolute() {
                Path::new(&worktree_path).to_path_buf()
            } else {
                Path::new(&repo_path).join(&worktree_path)
            }
        });

    Ok(normalize_path(&abs_path.to_string_lossy()))
}

#[tauri::command]
pub fn git_remove_worktree(repo_path: String, worktree_path: String) -> Result<(), String> {
    run_git(&repo_path, &["worktree", "remove", &worktree_path])?;
    Ok(())
}

#[tauri::command]
pub fn git_list_branches(path: String) -> Result<Vec<BranchInfo>, String> {
    let output = run_git(
        &path,
        &["branch", "-a", "--format=%(refname:short)"],
    )?;

    let mut branches = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for line in output.lines() {
        let name = line.trim().to_string();
        if name.is_empty() || name.contains("HEAD") {
            continue;
        }

        let is_remote = name.starts_with("origin/");
        let display_name = if is_remote {
            name.strip_prefix("origin/").unwrap_or(&name).to_string()
        } else {
            name.clone()
        };

        // Deduplicate: if local and remote both exist, keep local
        if is_remote && seen.contains(&display_name) {
            continue;
        }
        seen.insert(display_name.clone());

        branches.push(BranchInfo {
            name: display_name,
            is_remote,
        });
    }

    Ok(branches)
}

fn normalize_path(path: &str) -> String {
    let mut normalized = path.replace('\\', "/");
    // Strip Windows extended-length path prefix (\\?\ or //?/)
    if normalized.starts_with("//?/") {
        normalized = normalized[4..].to_string();
    }
    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}
