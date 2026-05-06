import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import useServerSuggestion from "../hooks/useServerSuggestion";
import { launchPreviewForFile } from "../previewLauncher";
import useForgeStore from "../store/useForgeStore";
import ParticleLayer from "./ParticleLayer";
import { normalizeRootPath } from "../utils/workspace";

const IS_MACOS = navigator.platform.startsWith("Mac");
const TREE_EXIT_MS = 140;

const STAR_POINTS =
  "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";

function StarIcon({ filled }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points={STAR_POINTS} />
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`repo-browser-chevron${expanded ? " repo-browser-chevron-open" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M4 2.5L7.5 6L4 9.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="repo-browser-icon"
    >
      {open ? (
        <path d="M1.5 12.5V4a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1v.5M1.5 12.5h11.5a1 1 0 0 0 1-1L12 7H2L.5 11.5a1 1 0 0 0 1 1z" />
      ) : (
        <path d="M1.5 4a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4z" />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="repo-browser-icon"
    >
      <path d="M9.5 1.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5z" />
      <polyline points="9.5 1.5 9.5 4.5 12.5 4.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="repo-browser-icon"
    >
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <circle cx="5.5" cy="5.5" r="1" />
      <path d="M14 10.5l-3-3-7 7" />
    </svg>
  );
}

function MarkdownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="repo-browser-icon"
    >
      <path d="M9.5 1.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5z" />
      <polyline points="9.5 1.5 9.5 4.5 12.5 4.5" />
      <path d="M5.5 8.5v3l1.25-1.25L8 11.5v-3" strokeWidth="1.3" />
    </svg>
  );
}

function fileIcon(fileType) {
  switch (fileType) {
    case "markdown":
      return <MarkdownIcon />;
    case "image":
      return <ImageIcon />;
    default:
      return <FileIcon />;
  }
}

function isHtmlPath(path) {
  return /\.html?$/i.test(String(path || ""));
}

function TreeNode({
  node,
  depth,
  expandedPaths,
  setExpandedPaths,
  selectedPath,
  onOpenFile,
}) {
  const isDirectory = node.kind === "directory";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const hasChildren = isDirectory && node.children?.length > 0;
  const [childrenVisible, setChildrenVisible] = useState(isExpanded);
  const [childrenMotionState, setChildrenMotionState] = useState(
    isExpanded ? "open" : "closing"
  );
  const enterFrameRef = useRef(null);
  const exitTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!hasChildren) return;
    if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    if (isExpanded) {
      setChildrenVisible(true);
      setChildrenMotionState("entering");
      enterFrameRef.current = requestAnimationFrame(() => {
        setChildrenMotionState("open");
      });
      return;
    }

    if (childrenVisible) {
      setChildrenMotionState("closing");
      exitTimerRef.current = setTimeout(() => {
        setChildrenVisible(false);
      }, TREE_EXIT_MS);
    }
  }, [childrenVisible, hasChildren, isExpanded]);

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

  const isViewable =
    !isDirectory && (isHtmlPath(node.path) || ["markdown", "text", "image"].includes(node.file_type));

  return (
    <div className="repo-browser-node-block">
      <div
        className={`repo-browser-node${isSelected ? " repo-browser-node-selected" : ""}${
          isDirectory ? " repo-browser-node-directory" : ""
        }${!isDirectory && !isViewable ? " repo-browser-node-inert" : ""}`}
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
            className={`repo-browser-toggle${isExpanded ? " repo-browser-toggle-open" : ""}`}
            onClick={toggleExpanded}
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        ) : (
          <span className="repo-browser-file-spacer" />
        )}
        {isDirectory ? <FolderIcon open={isExpanded} /> : fileIcon(node.file_type)}
        <span className="repo-browser-node-name">{node.name}</span>
      </div>
      {hasChildren && childrenVisible ? (
        <div
          className={`repo-browser-children-shell repo-browser-children-shell-${childrenMotionState}`}
        >
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
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectExplorer({
  open,
  onClose,
  onRefresh,
  tourElevated,
  motionState = "open",
}) {
  const activeGroupId = useForgeStore((state) => state.activeGroupId);
  const groups = useForgeStore((state) => state.groups);
  const workspaceByGroup = useForgeStore((state) => state.workspaceByGroup);
  const favoriteRepoPaths = useForgeStore((state) => state.favoriteRepoPaths);
  const openDocument = useForgeStore((state) => state.openDocument);
  const setGroupRootPath = useForgeStore((state) => state.setGroupRootPath);
  const setGroupServerCommandOverride = useForgeStore((state) => state.setGroupServerCommandOverride);
  const setSelectedPath = useForgeStore((state) => state.setSelectedPath);
  const toggleFavoriteRepoPath = useForgeStore((state) => state.toggleFavoriteRepoPath);

  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? null;
  const workspace = workspaceByGroup[activeGroupId];
  const suggestionRootPath = open ? (activeGroup?.rootPath ?? null) : null;
  const suggestionOverride = open ? (activeGroup?.serverCommandOverride ?? null) : null;
  const { serverSuggestion, defaultServerSuggestion } = useServerSuggestion(
    suggestionRootPath,
    suggestionOverride
  );
  const [workspacePathInput, setWorkspacePathInput] = useState("");
  const [expandedPaths, setExpandedPaths] = useState(() => new Set());
  const [editingPath, setEditingPath] = useState(true);
  const [serverCommandInput, setServerCommandInput] = useState("");
  const [editingServerCommand, setEditingServerCommand] = useState(false);

  useEffect(() => {
    setWorkspacePathInput(activeGroup?.rootPath ?? "");
    setEditingPath(!(activeGroup?.rootPath ?? ""));
  }, [activeGroup?.id, activeGroup?.rootPath]);

  useEffect(() => {
    setEditingServerCommand(false);
    setServerCommandInput(activeGroup?.serverCommandOverride ?? "");
  }, [activeGroup?.id, activeGroup?.rootPath, activeGroup?.serverCommandOverride]);

  useEffect(() => {
    if (editingServerCommand || activeGroup?.serverCommandOverride) return;
    setServerCommandInput(defaultServerSuggestion.value?.command ?? "");
  }, [activeGroup?.serverCommandOverride, defaultServerSuggestion.value?.command, editingServerCommand]);

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
  const defaultServerCommand = defaultServerSuggestion.value?.command ?? "";
  const activeServerCommand = serverSuggestion.value?.command ?? "";
  const hasSavedServerCommand = Boolean(activeGroup?.serverCommandOverride);
  const canResetToSuggested =
    hasSavedServerCommand &&
    Boolean(defaultServerCommand) &&
    activeGroup.serverCommandOverride.trim() !== defaultServerCommand;

  const commitServerCommand = useCallback(
    (nextCommand = serverCommandInput) => {
      if (!activeGroup) return;
      const trimmed = nextCommand.trim();
      const nextOverride =
        trimmed && trimmed !== defaultServerCommand
          ? trimmed
          : null;
      setGroupServerCommandOverride(activeGroup.id, nextOverride);
      setServerCommandInput(nextOverride ?? defaultServerCommand);
      setEditingServerCommand(false);
    },
    [activeGroup, defaultServerCommand, serverCommandInput, setGroupServerCommandOverride]
  );

  const resetServerCommandOverride = useCallback(() => {
    if (!activeGroup) return;
    setGroupServerCommandOverride(activeGroup.id, null);
    setServerCommandInput(defaultServerCommand);
    setEditingServerCommand(false);
  }, [activeGroup, defaultServerCommand, setGroupServerCommandOverride]);

  const cancelServerCommandEdit = useCallback(() => {
    setServerCommandInput(activeGroup?.serverCommandOverride ?? defaultServerCommand);
    setEditingServerCommand(false);
  }, [activeGroup?.serverCommandOverride, defaultServerCommand]);

  if (!open || !activeGroup) {
    return null;
  }

  const handleOpenFile = (node) => {
    setSelectedPath(activeGroup.id, node.path);
    if (isHtmlPath(node.path)) {
      launchPreviewForFile(activeGroup.id, node.path);
      onClose?.();
      return;
    }
    if (!["markdown", "text", "image"].includes(node.file_type)) {
      return;
    }
    openDocument(activeGroup.id, node.path, node.file_type);
    onClose?.();
  };

  return (
    <div
      className={`repo-browser-popover surface-menu${tourElevated ? " tour-elevated-menu" : ""}`}
      data-motion-state={motionState}
      data-placement="down-right"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="repo-browser-header surface-stagger" style={{ "--surface-index": 0 }}>
        <ParticleLayer location="repoBrowser" />
        <div className="repo-browser-title">Repository</div>
        <div className="repo-browser-header-actions">
          {activeGroup.rootPath ? (
            <>
              <button
                type="button"
                className="repo-browser-action"
                onClick={() =>
                  invoke("open_in_file_manager", { path: activeGroup.rootPath })
                }
              >
                {IS_MACOS ? "Finder" : "Explorer"}
              </button>
              <button type="button" className="repo-browser-action" onClick={onRefresh}>
                Refresh
              </button>
              <button
                type="button"
                className={`repo-browser-action${editingPath ? " repo-browser-action-active" : ""}`}
                onClick={() => setEditingPath((current) => !current)}
              >
                {editingPath ? "Done" : "Change Path"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {editingPath ? (
        <div className="repo-browser-bind-row surface-stagger" style={{ "--surface-index": 1 }}>
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
          <button
            type="button"
            className="repo-browser-action"
            onClick={() => commitWorkspacePath()}
          >
            Set
          </button>
          <button
            type="button"
            className={`repo-browser-star${isFavoriteTarget ? " repo-browser-star-active" : ""}`}
            onClick={() => toggleFavoriteRepoPath(favoriteTargetPath)}
            disabled={!favoriteTargetPath}
            aria-label={isFavoriteTarget ? "Unstar repo" : "Star repo"}
          >
            <StarIcon filled={isFavoriteTarget} />
          </button>
        </div>
      ) : activeGroup.rootPath ? (
        <div className="repo-browser-path-row surface-stagger" style={{ "--surface-index": 1 }}>
          <div className="repo-browser-path" title={activeGroup.rootPath}>
            {activeGroup.rootPath}
          </div>
          <div className="repo-browser-path-actions">
            <button
              type="button"
              className={`repo-browser-star${
                favoriteRepoPaths.includes(activeGroup.rootPath)
                  ? " repo-browser-star-active"
                  : ""
              }`}
              onClick={() => toggleFavoriteRepoPath(activeGroup.rootPath)}
              aria-label={
                favoriteRepoPaths.includes(activeGroup.rootPath)
                  ? "Unstar repo"
                  : "Star repo"
              }
            >
              <StarIcon filled={favoriteRepoPaths.includes(activeGroup.rootPath)} />
            </button>
            <button type="button" className="repo-browser-clear" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="repo-browser-note surface-stagger" style={{ "--surface-index": 1 }}>
          Paste a repository path to browse files, open documents, and launch HTML previews.
        </div>
      )}

      {activeGroup.rootPath ? (
        <div className="repo-browser-server-row">
          <div className="repo-browser-server-header">
            <div className="repo-browser-server-title">Server Command</div>
            <div className="repo-browser-server-badge">
              {hasSavedServerCommand ? "Saved" : activeServerCommand ? "Suggested" : "Blank"}
            </div>
          </div>
          {editingServerCommand ? (
            <>
              <div className="repo-browser-server-edit">
                <input
                  className="repo-browser-input"
                  value={serverCommandInput}
                  onChange={(event) => setServerCommandInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitServerCommand();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelServerCommandEdit();
                    }
                  }}
                  placeholder="e.g. npm run tauri dev"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="repo-browser-action"
                  onClick={() => commitServerCommand()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="repo-browser-clear"
                  onClick={cancelServerCommandEdit}
                >
                  Cancel
                </button>
                {defaultServerCommand ? (
                  <button
                    type="button"
                    className="repo-browser-action"
                    onClick={() => setServerCommandInput(defaultServerCommand)}
                  >
                    Use Suggested
                  </button>
                ) : null}
              </div>
              <div className="repo-browser-server-meta">
                Save a project-specific command for the Server tab menu. Leave it matching the suggested command to fall back to auto-detection.
              </div>
            </>
          ) : (
            <>
              <div className={`repo-browser-server-command${activeServerCommand ? "" : " repo-browser-server-command-empty"}`}>
                {activeServerCommand || "No saved or suggested command yet"}
              </div>
              <div className="repo-browser-server-meta">
                {activeServerCommand
                  ? `${serverSuggestion.value.reason}. Used when you open a Server tab from the + menu.`
                  : defaultServerSuggestion.status === "loading"
                    ? "Inspecting this repo for a likely dev command."
                    : "Forge will open a blank server tab until you save a command here."}
              </div>
              <div className="repo-browser-server-actions">
                <button
                  type="button"
                  className="repo-browser-action"
                  onClick={() => {
                    setServerCommandInput(activeGroup.serverCommandOverride ?? defaultServerCommand);
                    setEditingServerCommand(true);
                  }}
                >
                  {activeServerCommand ? "Edit" : "Add Command"}
                </button>
                {canResetToSuggested ? (
                  <button
                    type="button"
                    className="repo-browser-clear"
                    onClick={resetServerCommandOverride}
                  >
                    Use Suggested
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      {!activeGroup.rootPath ? null : workspace?.status === "loading" ? (
        <div className="repo-browser-empty surface-stagger" style={{ "--surface-index": 2 }}>
          Loading repository tree...
        </div>
      ) : workspace?.status === "error" ? (
        <div className="repo-browser-empty surface-stagger" style={{ "--surface-index": 2 }}>
          <p>{workspace.error || "Workspace scan failed."}</p>
          <button type="button" className="repo-browser-action" onClick={onRefresh}>
            Retry
          </button>
        </div>
      ) : workspace?.status === "empty-folder" ? (
        <div className="repo-browser-empty surface-stagger" style={{ "--surface-index": 2 }}>
          No files were found after applying workspace ignores.
        </div>
      ) : (
        <div className="repo-browser-tree surface-stagger" style={{ "--surface-index": 2 }}>
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
