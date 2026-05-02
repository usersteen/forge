// Forge preview picker. Injected as initialization script into the preview
// child webview. Exposes window.__forgePicker.setMode(bool) and renders
// element outlines + a Heph-styled composer when comment mode is on.
//
// This file is loaded via include_str! in src-tauri/src/preview.rs and
// concatenated with a small bootstrap that sets window.__forgePickerConfig.
(function () {
  if (window.__forgePicker) return;

  const config = window.__forgePickerConfig || {};
  const COMMENT_SERVER_PORT = config.commentServerPort || 47823;
  const CSS = config.css || "";
  const TAB_ID = config.tabId || "";

  const ZBASE = 2147483600;
  let active = false;
  let currentEl = null;
  let frozen = false;

  // ---- style injection ----
  const styleEl = document.createElement("style");
  styleEl.textContent =
    CSS +
    `
    .__forge-outline { position: absolute; pointer-events: none; z-index: ${ZBASE};
      box-sizing: border-box;
      border: 1px dashed rgba(var(--forge-accent-rgb, 106, 100, 98), 0.85);
      outline: 1px solid rgba(var(--forge-accent-rgb, 106, 100, 98), 0.18);
      outline-offset: 1px;
      transition: top 60ms linear, left 60ms linear, width 60ms linear, height 60ms linear; }
    .__forge-outline.frozen { border-style: solid; border-width: 1.5px; }
    /* Crosshair on the underlying page; explicit overrides for composer. */
    html.__forge-cursor, html.__forge-cursor body, html.__forge-cursor * { cursor: crosshair; }
    html.__forge-cursor .__forge-composer,
    html.__forge-cursor .__forge-composer * { cursor: auto; }
    html.__forge-cursor .__forge-composer textarea { cursor: text; }
    html.__forge-cursor .__forge-composer button { cursor: pointer; }
    .__forge-composer { position: absolute; z-index: ${ZBASE + 1};
      width: 340px; max-width: calc(100vw - 24px); padding: 10px 12px;
      background: var(--forge-bg-active, #141312);
      color: var(--forge-text-primary, #e2e8f0);
      border: 1px solid var(--forge-border, #262220);
      border-radius: 0;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(var(--forge-accent-rgb, 106, 100, 98), 0.05);
      font: 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      animation: __forge-pop 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
    @keyframes __forge-pop { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    .__forge-composer .__forge-target { color: var(--forge-text-muted, #64748b);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 10.5px; margin-bottom: 8px; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; letter-spacing: 0.02em; }
    .__forge-composer textarea { display: block; width: 100%; min-height: 60px;
      max-height: 200px; resize: vertical; padding: 8px;
      background: var(--forge-bg-deep, #090909);
      color: var(--forge-text-primary, #e2e8f0);
      border: 1px solid var(--forge-border, #262220);
      border-radius: 0;
      font: inherit; box-sizing: border-box; outline: none; }
    .__forge-composer textarea::placeholder { color: var(--forge-text-muted, #64748b); }
    .__forge-composer textarea:focus { border-color: rgba(var(--forge-accent-rgb, 106, 100, 98), 0.7); box-shadow: inset 0 0 0 1px rgba(var(--forge-accent-rgb, 106, 100, 98), 0.18); }
    .__forge-composer .__forge-row { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
    .__forge-composer .__forge-segment { display: inline-flex; gap: 0; border: 1px solid var(--forge-border, #262220); border-radius: 0; overflow: hidden; }
    .__forge-composer .__forge-segment button { background: transparent; color: var(--forge-text-secondary, #94a3b8); border: 0; padding: 5px 10px; font: inherit; font-size: 11px; }
    .__forge-composer .__forge-segment button:hover { background: var(--forge-bg-elevated, #1a1816); color: var(--forge-text-primary, #e2e8f0); }
    .__forge-composer .__forge-segment button.on { background: var(--forge-bg-elevated, #1a1816); color: var(--forge-text-primary, #e2e8f0); box-shadow: inset 0 -1px 0 var(--forge-accent, #6a6462); }
    .__forge-composer .__forge-segment button + button { border-left: 1px solid var(--forge-border, #262220); }
    .__forge-composer .__forge-btn { background: transparent; color: var(--forge-text-secondary, #94a3b8); border: 1px solid var(--forge-border, #262220); padding: 5px 12px; border-radius: 0; font: inherit; font-size: 11px; }
    .__forge-composer .__forge-btn:hover { background: var(--forge-bg-elevated, #1a1816); color: var(--forge-text-primary, #e2e8f0); border-color: var(--forge-border-strong, #383330); }
    .__forge-composer .__forge-btn.primary { background: rgba(var(--forge-accent-rgb, 106, 100, 98), 0.14); color: var(--forge-text-primary, #e2e8f0); border-color: rgba(var(--forge-accent-rgb, 106, 100, 98), 0.5); }
    .__forge-composer .__forge-btn.primary:hover { background: rgba(var(--forge-accent-rgb, 106, 100, 98), 0.22); }
    .__forge-composer .__forge-hint { color: var(--forge-text-muted, #64748b); font-size: 10.5px; margin-left: auto; letter-spacing: 0.02em; }
    .__forge-composer .__forge-label { color: var(--forge-text-muted, #64748b); font-size: 11px; }
    `;
  styleEl.id = "__forge-picker-style";

  // ---- outline element ----
  const outlineEl = document.createElement("div");
  outlineEl.className = "__forge-outline";
  outlineEl.style.display = "none";

  function ensureMounted() {
    if (!styleEl.isConnected) document.documentElement.appendChild(styleEl);
    if (!outlineEl.isConnected) document.documentElement.appendChild(outlineEl);
  }

  function rectFor(el) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left + window.scrollX,
      top: r.top + window.scrollY,
      width: r.width,
      height: r.height,
    };
  }

  function showOutline(el, frozenState) {
    if (!el) {
      outlineEl.style.display = "none";
      return;
    }
    const r = rectFor(el);
    outlineEl.style.display = "block";
    outlineEl.style.left = r.left + "px";
    outlineEl.style.top = r.top + "px";
    outlineEl.style.width = r.width + "px";
    outlineEl.style.height = r.height + "px";
    outlineEl.classList.toggle("frozen", !!frozenState);
  }

  // ---- selector helper ----
  function uniqueSelector(el) {
    if (!(el instanceof Element)) return "";
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return "#" + el.id;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.nodeName.toLowerCase();
      const cls = (cur.className && typeof cur.className === "string"
        ? cur.className.trim().split(/\s+/).filter((c) => /^[A-Za-z_][\w-]*$/.test(c)).slice(0, 2)
        : []);
      if (cls.length) part += "." + cls.join(".");
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((s) => s.nodeName === cur.nodeName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(cur) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
      if (parts.length >= 5) break;
    }
    return parts.join(" > ");
  }

  function reactSource(el) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
    if (!key) return null;
    let fiber = el[key];
    while (fiber) {
      if (fiber._debugSource) {
        const s = fiber._debugSource;
        return { file: s.fileName || null, line: s.lineNumber || null, column: s.columnNumber || null };
      }
      fiber = fiber.return;
    }
    return null;
  }

  // ---- composer ----
  let composerEl = null;

  function closeComposer() {
    if (composerEl) {
      composerEl.remove();
      composerEl = null;
    }
    frozen = false;
    showOutline(null, false);
  }

  function openComposer(el) {
    closeComposer();
    frozen = true;
    showOutline(el, true);

    const composer = document.createElement("div");
    composer.className = "__forge-composer";

    const lastProvider = (() => {
      try { return localStorage.getItem("forge.preview.lastProvider") || "claude"; } catch { return "claude"; }
    })();

    const targetLine = `${el.nodeName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0,2).join(".") : ""}`;

    composer.innerHTML = `
      <div class="__forge-target">${targetLine}</div>
      <textarea placeholder="What would you change about this element?" rows="3"></textarea>
      <div class="__forge-row">
        <span class="__forge-label">Send to</span>
        <div class="__forge-segment" role="radiogroup">
          <button type="button" data-provider="claude" class="${lastProvider === "claude" ? "on" : ""}">Claude</button>
          <button type="button" data-provider="codex" class="${lastProvider === "codex" ? "on" : ""}">Codex</button>
        </div>
      </div>
      <div class="__forge-row">
        <span class="__forge-hint">Ctrl+Enter · Esc</span>
        <button type="button" class="__forge-btn" data-action="cancel">Cancel</button>
        <button type="button" class="__forge-btn primary" data-action="send">Send</button>
      </div>
    `;

    document.documentElement.appendChild(composer);
    composerEl = composer;

    // Position near the element, flipping if it would overflow viewport.
    const r = rectFor(el);
    const composerW = 360;
    const composerH = composer.offsetHeight || 180;
    const margin = 12;
    let left = r.left;
    let top = r.top + r.height + margin;
    const viewportRight = window.scrollX + window.innerWidth;
    const viewportBottom = window.scrollY + window.innerHeight;
    if (left + composerW + 12 > viewportRight) left = Math.max(window.scrollX + 12, viewportRight - composerW - 12);
    if (top + composerH + 12 > viewportBottom) top = Math.max(window.scrollY + 12, r.top - composerH - margin);
    composer.style.left = left + "px";
    composer.style.top = top + "px";

    const textarea = composer.querySelector("textarea");
    textarea.focus();

    let provider = lastProvider;
    composer.querySelectorAll("[data-provider]").forEach((btn) => {
      btn.addEventListener("click", () => {
        provider = btn.dataset.provider;
        composer.querySelectorAll("[data-provider]").forEach((b) => b.classList.toggle("on", b === btn));
        try { localStorage.setItem("forge.preview.lastProvider", provider); } catch {}
        textarea.focus();
      });
    });

    composer.querySelector('[data-action="cancel"]').addEventListener("click", closeComposer);
    composer.querySelector('[data-action="send"]').addEventListener("click", () => submit());

    composer.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeComposer();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    });

    function submit() {
      const comment = textarea.value.trim();
      if (!comment) return;
      const payload = {
        tabId: TAB_ID,
        comment,
        provider,
        selector: uniqueSelector(el),
        source: reactSource(el),
        html: (el.outerHTML || "").slice(0, 400),
        text: (el.innerText || el.textContent || "").trim().slice(0, 400),
        origin: location.origin,
      };
      fetch(`http://127.0.0.1:${COMMENT_SERVER_PORT}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) throw new Error("status " + res.status);
          closeComposer();
        })
        .catch((err) => {
          textarea.disabled = false;
          console.error("[forge] failed to send comment", err);
        });
      textarea.disabled = true;
    }
  }

  // ---- event handlers ----
  function onMouseMove(e) {
    if (!active || frozen) return;
    const el = e.target;
    if (!el || el === currentEl) return;
    if (el.closest && el.closest(".__forge-composer")) return;
    currentEl = el;
    showOutline(el, false);
  }

  function onClick(e) {
    if (!active) return;
    if (e.target.closest && e.target.closest(".__forge-composer")) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (!el) return;
    openComposer(el);
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") {
      if (composerEl) {
        closeComposer();
      } else {
        api.setMode(false);
      }
    }
  }

  // ---- public API ----
  const api = {
    setMode(on) {
      const next = !!on;
      if (next === active) return;
      active = next;
      ensureMounted();
      if (next) {
        document.documentElement.classList.add("__forge-cursor");
        document.addEventListener("mousemove", onMouseMove, true);
        document.addEventListener("click", onClick, true);
        document.addEventListener("keydown", onKey, true);
      } else {
        document.documentElement.classList.remove("__forge-cursor");
        document.removeEventListener("mousemove", onMouseMove, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey, true);
        currentEl = null;
        closeComposer();
      }
    },
    isActive() {
      return active;
    },
  };

  window.__forgePicker = api;
})();
