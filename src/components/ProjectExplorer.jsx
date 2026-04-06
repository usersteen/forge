import { useCallback, useEffect, useMemo, useState } from "react";
import useForgeStore from "../store/useForgeStore";
import ParticleLayer from "./ParticleLayer";
import { normalizeRootPath } from "../utils/workspace";

const STAR_POINTS = "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";

function StarIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points={STAR_POINTS} />
    </svg>
  );
}


function TreeNode({ node, depth, expandedPaths, setExpandedPaths, selectedPath, onOpenFile }) {
  const isDirectory = node.kind === "directory";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const flipExpanded = () => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
      }
      return next;
    });
  };

  const toggleExpanded = (event) => {
    event.stopPropagation();
    flipExpanded();
  };

  return (
    <div className="repo-browser-node-block">
      <div
        className={`repo-browser-node ${isSelected ? "repo-browser-node-selected" : ""} ${isDirectory ? "repo-browser-node-directory" : ""}`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => {
          if (isDirectory) {
            flipExpanded();
            return;
          }
          onOpenFile(node);
        }}
      >
        {isDirectory ? (
          <button
            type="button"
            className="repo-browser-toggle"
            onClick={toggleExpanded}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isExpanded ? "\u25be" : "\u25b8"}
          </button>
        ) : (
          <span className="repo-browser-file-spacer" />
        )}
        <span className="repo-browser-node-name">{node.name}</span>
      </div>
      {isDirectory && isExpanded && node.children?.length > 0 ? (
        <div className="repo-browser-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              setExpandedPaths={setExpandedPaths}
              selectedPath={selectedPath}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectExplorer({ open, onClose, onRefresh, tourElevated }) {
  const activeGroupId = useForgeStore((state) => state.activeGroupId);
  const groups = useForgeStore((state) => state.groups);
  const workspaceByGroup = useForgeStore((state) => state.workspaceByGroup);
  const favoriteRepoPaths = useForgeStore((state) => state.favoriteRepoPaths);
  const openDocument = useForgeStore((state) => state.openDocument);
  const setGroupRootPath = useForgeStore((state) => state.setGroupRootPath);
  const setSelectedPath = useForgeStore((state) => state.setSelectedPath);
  const toggleFavoriteRepoPath = useForgeStore((state) => state.toggleFavoriteRepoPath);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const workspace = workspaceByGroup[activeGroupId];
  const [workspacePathInput, setWorkspacePathInput] = useState("");
  const [expandedPaths, setExpandedPaths] = useState(() => new Set());
  const [editingPath, setEditingPath] = useState(true);

  useEffect(() => {
    setWorkspacePathInput(activeGroup?.rootPath ?? "");
    setEditingPath(!(activeGroup?.rootPath ?? ""));
  }, [activeGroup?.id, activeGroup?.rootPath]);

  useEffect(() => {
    setExpandedPaths(new Set());
  }, [activeGroupId, activeGroup?.rootPath]);

  const commitWorkspacePath = useCallback(
    (nextPath = workspacePathInput) => {
      if (!activeGroup) return;
      const trimmedPath = nextPath.trim();
      if (!trimmedPath) return;
      setGroupRootPath(activeGroup.id, trimmedPath);
      setWorkspacePathInput(trimmedPath);
      setEditingPath(false);
    },
    [activeGroup, setGroupRootPath, workspacePathInput]
  );

  const handleClear = useCallback(() => {
    if (!activeGroup) return;
    setGroupRootPath(activeGroup.id, null);
    setWorkspacePathInput("");
    setExpandedPaths(new Set());
    setEditingPath(true);
  }, [activeGroup, setGroupRootPath]);

  const favoriteTargetPath = useMemo(() => {
    if (editingPath) {
      return normalizeRootPath(workspacePathInput) ?? "";
    }
    return normalizeRootPath(activeGroup?.rootPath) ?? "";
  }, [activeGroup?.rootPath, editingPath, workspacePathInput]);

  const isFavoriteTarget = favoriteRepoPaths.includes(favoriteTargetPath);

  if (!open || !activeGroup) {
    return null;
  }

  const handleOpenFile = (node) => {
    setSelectedPath(activeGroup.id, node.path);
    if (!["markdown", "text", "image"].includes(node.file_type)) {
      return;
    }
    openDocument(activeGroup.id, node.path, node.file_type);
    onClose?.();
  };

  return (
    <div
      className={`repo-browser-popover${tourElevated ? " tour-elevated-menu" : ""}`}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="repo-browser-header">
        <ParticleLayer location="repoBrowser" />
        <div className="repo-browser-title">Repository</div>
        <div className="repo-browser-header-actions">
          {activeGroup.rootPath ? (
            <>
              <button type="button" className="repo-browser-action" onClick={onRefresh}>
                Refresh
              </button>
              <button
                type="button"
                className="repo-browser-action"
                onClick={() => setEditingPath((current) => !current)}
              >
                {editingPath ? "Done" : "Change Path"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {editingPath ? (
        <div className="repo-browser-bind-row">
          <input
            className="repo-browser-input"
            value={workspacePathInput}
            onChange={(event) => setWorkspacePathInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitWorkspacePath();
              }
            }}
            placeholder="Paste repository path"
            spellCheck={false}
          />
          <button type="button" className="repo-browser-action" onClick={() => commitWorkspacePath()}>
            Set
          </button>
          <button
            type="button"
            className={`repo-browser-star ${isFavoriteTarget ? "repo-browser-star-active" : ""}`}
            onClick={() => toggleFavoriteRepoPath(favoriteTargetPath)}
            disabled={!favoriteTargetPath}
            aria-label={isFavoriteTarget ? "Unstar repo" : "Star repo"}
          >
            <StarIcon filled={isFavoriteTarget} />
          </button>
        </div>
      ) : activeGroup.rootPath ? (
        <div className="repo-browser-path-row">
          <div className="repo-browser-path-label">Root path</div>
          <div className="repo-browser-path" title={activeGroup.rootPath}>
            {activeGroup.rootPath}
          </div>
          <div className="repo-browser-path-actions">
            <button
              type="button"
              className={`repo-browser-star ${favoriteRepoPaths.includes(activeGroup.rootPath) ? "repo-browser-star-active" : ""}`}
              onClick={() => toggleFavoriteRepoPath(activeGroup.rootPath)}
              aria-label={favoriteRepoPaths.includes(activeGroup.rootPath) ? "Unstar repo" : "Star repo"}
            >
              <StarIcon filled={favoriteRepoPaths.includes(activeGroup.rootPath)} />
            </button>
            <button type="button" className="repo-browser-clear" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="repo-browser-note">
          Paste a repository path to browse files and open markdown, text, or image documents.
        </div>
      )}

      {!activeGroup.rootPath ? null : workspace?.status === "loading" ? (
        <div className="repo-browser-empty">Loading repository tree...</div>
      ) : workspace?.status === "error" ? (
        <div className="repo-browser-empty">
          <p>{workspace.error || "Workspace scan failed."}</p>
          <button type="button" className="repo-browser-action" onClick={onRefresh}>
            Retry
          </button>
        </div>
      ) : workspace?.status === "empty-folder" ? (
        <div className="repo-browser-empty">No files were found after applying workspace ignores.</div>
      ) : (
        <div className="repo-browser-tree">
          {workspace?.tree?.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              expandedPaths={expandedPaths}
              setExpandedPaths={setExpandedPaths}
              selectedPath={activeGroup.selectedPath}
              onOpenFile={handleOpenFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
