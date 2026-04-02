import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import useEscapeKey from "../hooks/useEscapeKey";
import useForgeStore, { addWorktreeGroup } from "../store/useForgeStore";

function defaultWorktreePath(rootPath, branch) {
  const repoParent = rootPath?.replace(/[\\/][^\\/]+$/, "") || "";
  const repoName = rootPath?.split(/[\\/]/).filter(Boolean).pop() || "repo";
  const safeBranch = branch.replace(/\//g, "-");
  return `${repoParent}/_worktrees/${repoName}-${safeBranch}`;
}

export default function AddWorktreeDialog({ x, y, groupId, rootPath, onClose }) {
  const [branches, setBranches] = useState([]);
  const [existingWorktrees, setExistingWorktrees] = useState([]);
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState(null);
  const [newBranchMode, setNewBranchMode] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    invoke("git_list_branches", { path: rootPath })
      .then(setBranches)
      .catch(() => setBranches([]));
    invoke("git_list_worktrees", { path: rootPath })
      .then(setExistingWorktrees)
      .catch(() => setExistingWorktrees([]));
  }, [rootPath]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  useEscapeKey(onClose);

  useEffect(() => {
    if (newBranchMode) inputRef.current?.focus();
  }, [newBranchMode]);

  // Figure out which worktrees are already open as groups
  const groups = useForgeStore((s) => s.groups);
  const openWorktreePaths = new Set(
    groups.filter((g) => g.rootPath).map((g) => g.rootPath.replace(/\\/g, "/").toLowerCase())
  );
  const isWorktreeOpen = (wt) =>
    openWorktreePaths.has(wt.path.replace(/\\/g, "/").toLowerCase());

  // Worktrees not yet open in the sidebar — clickable to add as group
  const unopenedWorktrees = existingWorktrees.filter((wt) => !isWorktreeOpen(wt));
  // Branches that already have a worktree on disk
  const worktreeBranches = new Set(existingWorktrees.map((wt) => wt.branch));
  // Branches available for creating a new worktree
  const availableBranches = branches.filter((b) => !worktreeBranches.has(b.name));

  const handleOpenExisting = async (wt) => {
    if (creating) return;
    await addWorktreeGroup(groupId, wt.path, wt.branch);
    onClose();
  };

  const handleCreate = async (branch, createBranch = false) => {
    if (creating) return;
    setError(null);
    setCreating(branch);

    try {
      const worktreePath = defaultWorktreePath(rootPath, branch);
      const createdPath = await invoke("git_add_worktree", {
        repoPath: rootPath,
        worktreePath,
        branch,
        createBranch,
      });
      await addWorktreeGroup(groupId, createdPath, branch);
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err.message || "Failed to create worktree");
      setCreating(null);
    }
  };

  return (
    <div ref={menuRef} className="quick-tab-menu" style={{ left: x, top: y }}>
      <div className="new-project-section-label">Add Worktree</div>

      {unopenedWorktrees.length > 0 && (
        <>
          <div className="new-project-section-label">Existing Worktrees</div>
          {unopenedWorktrees.map((wt) => (
            <button
              key={wt.path}
              className="quick-tab-item"
              onClick={() => handleOpenExisting(wt)}
            >
              <span className="quick-tab-item-label">{wt.branch || "detached"}</span>
              <span className="quick-tab-item-hint">Open in sidebar</span>
            </button>
          ))}
          <div className="new-project-divider" />
        </>
      )}

      {availableBranches.length > 0 && (
        <div className="new-project-section-label">New Worktree</div>
      )}

      <div className="new-project-repo-list">
        {availableBranches.length === 0 && (
          <div className="quick-tab-item" style={{ cursor: "default", opacity: 0.5 }}>
            <span className="quick-tab-item-hint">No available branches</span>
          </div>
        )}
        {availableBranches.map((b) => (
          <button
            key={b.name}
            className="quick-tab-item"
            disabled={!!creating}
            onClick={() => handleCreate(b.name)}
          >
            <span className="quick-tab-item-label">
              {creating === b.name ? "Creating..." : b.name}
            </span>
            {b.is_remote && <span className="quick-tab-item-hint">remote</span>}
          </button>
        ))}
      </div>

      <div className="new-project-divider" />

      {newBranchMode ? (
        <div className="new-project-input-row">
          <input
            ref={inputRef}
            className="new-project-path-input"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="New branch name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newBranchName.trim()) {
                handleCreate(newBranchName.trim(), true);
              }
              if (e.key === "Escape") {
                setNewBranchMode(false);
                setNewBranchName("");
              }
            }}
          />
        </div>
      ) : (
        <button
          className="quick-tab-item"
          onClick={() => setNewBranchMode(true)}
        >
          <span className="quick-tab-item-label">New branch...</span>
          <span className="quick-tab-item-hint">Create a new branch and worktree</span>
        </button>
      )}

      {error && (
        <div style={{ padding: "6px 12px", fontSize: "11px", color: "var(--text-muted)" }}>
          {error}
        </div>
      )}
    </div>
  );
}
