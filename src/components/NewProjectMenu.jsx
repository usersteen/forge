import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import useEscapeKey from "../hooks/useEscapeKey";
import useFloatingSurfacePosition from "../hooks/useFloatingSurfacePosition";
import useForgeStore from "../store/useForgeStore";

function repoNameFromPath(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export default function NewProjectMenu({
  x,
  y,
  onSelect,
  onClose,
  anchorRef,
  tourElevated,
  motionState = "open",
}) {
  const [inputValue, setInputValue] = useState("");
  const [repos, setRepos] = useState([]);
  const favoriteRepoPaths = useForgeStore((s) => s.favoriteRepoPaths);
  const reposRootPath = useForgeStore((s) => s.reposRootPath);

  useEffect(() => {
    if (!reposRootPath) return;
    invoke("list_repos", { rootPath: reposRootPath }).then(setRepos).catch(() => setRepos([]));
  }, [reposRootPath]);

  const filterValue = inputValue.trim().toLowerCase();
  const filteredFavoriteRepoPaths = useMemo(
    () =>
      filterValue
        ? favoriteRepoPaths.filter((path) => {
            const repoName = repoNameFromPath(path).toLowerCase();
            return path.toLowerCase().includes(filterValue) || repoName.includes(filterValue);
          })
        : favoriteRepoPaths,
    [favoriteRepoPaths, filterValue]
  );
  const filteredRepos = useMemo(
    () => (filterValue ? repos.filter((name) => name.toLowerCase().includes(filterValue)) : repos),
    [filterValue, repos]
  );

  const { surfaceRef, surfaceStyle, placement } = useFloatingSurfacePosition({
    x,
    y,
    deps: [
      inputValue,
      repos.length,
      filteredRepos.length,
      favoriteRepoPaths.length,
      filteredFavoriteRepoPaths.length,
    ],
    preferredHorizontal: "right",
    preferredVertical: "down",
  });

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (anchorRef?.current?.contains(event.target)) return;
      if (surfaceRef.current?.contains(event.target)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [anchorRef, onClose, surfaceRef]);

  useEscapeKey(onClose);

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && inputValue.trim()) {
      onSelect(inputValue.trim());
      onClose();
    }
  };

  const selectRepo = (name) => {
    const separator = reposRootPath.includes("/") ? "/" : "\\";
    const fullPath = reposRootPath.replace(/[\\/]+$/, "") + separator + name;
    onSelect(fullPath);
    onClose();
  };

  return (
    <div
      ref={surfaceRef}
      className={`quick-tab-menu new-project-menu surface-menu${tourElevated ? " tour-elevated-menu" : ""}`}
      data-motion-state={motionState}
      data-placement={placement}
      style={surfaceStyle}
    >
      <div className="new-project-input-row surface-stagger" style={{ "--surface-index": 0 }}>
        <input
          className="new-project-path-input"
          type="text"
          placeholder={
            repos.length > 0 || favoriteRepoPaths.length > 0
              ? "Filter repos or paste a path..."
              : "Paste a repo path..."
          }
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>

      {filteredFavoriteRepoPaths.length > 0 && (
        <div className="surface-stagger" style={{ "--surface-index": 1 }}>
          <div className="new-project-divider" />
          <div className="new-project-section-label">Starred Repos</div>
          <div className="new-project-starred-list">
            {filteredFavoriteRepoPaths.map((path) => (
              <button
                key={path}
                className="quick-tab-item"
                onClick={() => {
                  onSelect(path);
                  onClose();
                }}
                title={path}
              >
                <span className="quick-tab-item-label">{repoNameFromPath(path)}</span>
                <span className="quick-tab-item-hint">{path}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredRepos.length > 0 && (
        <div className="surface-stagger" style={{ "--surface-index": 2 }}>
          <div className="new-project-divider" />
          <div className="new-project-section-label">Repos</div>
          <div className="new-project-repo-list">
            {filteredRepos.map((name) => (
              <button key={name} className="quick-tab-item" onClick={() => selectRepo(name)}>
                <span className="quick-tab-item-label">{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="surface-stagger" style={{ "--surface-index": 3 }}>
        <div className="new-project-divider" />
        <button
          className="quick-tab-item"
          onClick={() => {
            onSelect(null);
            onClose();
          }}
        >
          <span className="quick-tab-item-label">Skip</span>
          <span className="quick-tab-item-hint">Create a blank project</span>
        </button>
      </div>
    </div>
  );
}
