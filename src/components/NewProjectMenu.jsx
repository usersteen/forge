import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import useEscapeKey from "../hooks/useEscapeKey";
import useForgeStore from "../store/useForgeStore";

function repoNameFromPath(path) {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

export default function NewProjectMenu({ x, y, onSelect, onClose, tourElevated }) {
  const menuRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [menuStyle, setMenuStyle] = useState({ left: x, top: y, opacity: 0 });
  const [repos, setRepos] = useState([]);
  const favoriteRepoPaths = useForgeStore((s) => s.favoriteRepoPaths);
  const reposRootPath = useForgeStore((s) => s.reposRootPath);

  useEffect(() => {
    if (!reposRootPath) return;
    invoke("list_repos", { rootPath: reposRootPath }).then(setRepos).catch(() => setRepos([]));
  }, [reposRootPath]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  useEscapeKey(onClose);

  // Clamp menu position to viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const margin = 8;
    const rect = menuRef.current.getBoundingClientRect();
    let nextX = x;
    let nextY = y;

    if (nextY + rect.height > window.innerHeight - margin) {
      nextY = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    if (nextX + rect.width > window.innerWidth - margin) {
      nextX = Math.max(margin, nextX - rect.width - 12);
    }

    setMenuStyle({ left: nextX, top: nextY, opacity: 1 });
  }, [x, y, repos, favoriteRepoPaths]);

  const handleInputKeyDown = (event) => {
    if (event.key === "Enter" && inputValue.trim()) {
      onSelect(inputValue.trim());
      onClose();
    }
  };

  const filterValue = inputValue.trim().toLowerCase();
  const filteredFavoriteRepoPaths = filterValue
    ? favoriteRepoPaths.filter((path) => {
        const repoName = repoNameFromPath(path).toLowerCase();
        return path.toLowerCase().includes(filterValue) || repoName.includes(filterValue);
      })
    : favoriteRepoPaths;
  const filteredRepos = filterValue
    ? repos.filter((name) => name.toLowerCase().includes(filterValue))
    : repos;

  const selectRepo = (name) => {
    const separator = reposRootPath.includes("/") ? "/" : "\\";
    const fullPath = reposRootPath.replace(/[\\/]+$/, "") + separator + name;
    onSelect(fullPath);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className={`quick-tab-menu new-project-menu${tourElevated ? " tour-elevated-menu" : ""}`}
      style={menuStyle}
    >
      <div className="new-project-input-row">
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
        <>
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
        </>
      )}

      {filteredRepos.length > 0 && (
        <>
          <div className="new-project-divider" />
          <div className="new-project-section-label">Repos</div>
          <div className="new-project-repo-list">
            {filteredRepos.map((name) => (
              <button
                key={name}
                className="quick-tab-item"
                onClick={() => selectRepo(name)}
              >
                <span className="quick-tab-item-label">{name}</span>
              </button>
            ))}
          </div>
        </>
      )}

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
  );
}
