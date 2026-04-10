import { useCallback, useEffect, useRef, useState } from "react";
import useForgeStore from "../store/useForgeStore";
import useEscapeKey from "../hooks/useEscapeKey";
import useTourDemoContent from "../hooks/useTourDemoContent";
import { TOUR_STEPS } from "../data/tourSteps";

const TOOLTIP_GAP = 12;
const DEFAULT_PADDING = 0;
const TRANSITION_MS = 180;

function getUnionRect(rects) {
  if (rects.length === 0) return null;
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const r of rects) {
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return { top, left, right, bottom, width: right - left, height: bottom - top };
}

function getClipPath(rect, padding) {
  if (!rect) return "none";
  const top = rect.top - padding;
  const left = rect.left - padding;
  const right = rect.right + padding;
  const bottom = rect.bottom + padding;
  return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px, ${left}px ${top}px)`;
}

function computeTooltipPosition(rect, placement, tooltipSize) {
  if (!rect || placement === "center") {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top, left;

  switch (placement) {
    case "right":
      top = rect.top + rect.height / 2 - tooltipSize.height / 2;
      left = rect.right + TOOLTIP_GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipSize.height / 2;
      left = rect.left - TOOLTIP_GAP - tooltipSize.width;
      break;
    case "bottom":
      top = rect.bottom + TOOLTIP_GAP;
      left = rect.left + rect.width / 2 - tooltipSize.width / 2;
      break;
    case "top":
      top = rect.top - TOOLTIP_GAP - tooltipSize.height;
      left = rect.left + rect.width / 2 - tooltipSize.width / 2;
      break;
    default:
      top = rect.bottom + TOOLTIP_GAP;
      left = rect.left;
  }

  const margin = 12;
  top = Math.max(margin, Math.min(vh - tooltipSize.height - margin, top));
  left = Math.max(margin, Math.min(vw - tooltipSize.width - margin, left));

  return { top: `${top}px`, left: `${left}px`, transform: "none" };
}

function computeArrowStyle(placement, targetRect, tooltipPos, tooltipSize) {
  if (!targetRect || placement === "center") return null;

  const parsePx = (v) => (typeof v === "string" ? parseFloat(v) : v);
  const tTop = parsePx(tooltipPos.top);
  const tLeft = parsePx(tooltipPos.left);
  if (isNaN(tTop) || isNaN(tLeft)) return null;

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const minEdge = 16;

  if (placement === "right" || placement === "left") {
    let arrowTop = targetCenterY - tTop;
    arrowTop = Math.max(minEdge, Math.min(tooltipSize.height - minEdge, arrowTop));
    return {
      position: "absolute",
      width: "8px",
      height: "8px",
      background: "var(--bg-sidebar)",
      border: "1px solid rgba(var(--accent-active-rgb), 0.4)",
      transform: "rotate(45deg)",
      ...(placement === "right"
        ? { left: "-5px", top: `${arrowTop}px`, marginTop: "-4px", borderRight: "none", borderTop: "none" }
        : { right: "-5px", top: `${arrowTop}px`, marginTop: "-4px", borderLeft: "none", borderBottom: "none" }),
    };
  }

  if (placement === "bottom" || placement === "top") {
    let arrowLeft = targetCenterX - tLeft;
    arrowLeft = Math.max(minEdge, Math.min(tooltipSize.width - minEdge, arrowLeft));
    return {
      position: "absolute",
      width: "8px",
      height: "8px",
      background: "var(--bg-sidebar)",
      border: "1px solid rgba(var(--accent-active-rgb), 0.4)",
      transform: "rotate(45deg)",
      ...(placement === "bottom"
        ? { top: "-5px", left: `${arrowLeft}px`, marginLeft: "-4px", borderBottom: "none", borderRight: "none" }
        : { bottom: "-5px", left: `${arrowLeft}px`, marginLeft: "-4px", borderTop: "none", borderLeft: "none" }),
    };
  }

  return null;
}

export default function GuidedTour({ onClose }) {
  const tourStep = useForgeStore((s) => s.tourStep);
  const setTourStep = useForgeStore((s) => s.setTourStep);
  const setTourExpandedPanel = useForgeStore((s) => s.setTourExpandedPanel);

  const [targetRect, setTargetRect] = useState(null);
  const [multiRects, setMultiRects] = useState([]);
  const [tooltipAnchorRect, setTooltipAnchorRect] = useState(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 340, height: 200 });
  const [transitioning, setTransitioning] = useState(false);

  const tooltipRef = useRef(null);
  const resizeTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);

  const step = TOUR_STEPS[tourStep];
  const isFirst = tourStep === 0;
  const isLast = tourStep === TOUR_STEPS.length - 1;
  const isCentered = step?.placement === "center";
  const padding = step?.padding ?? DEFAULT_PADDING;

  useTourDemoContent(true, tourStep, TOUR_STEPS);

  useEscapeKey(onClose);

  const measureTarget = useCallback(() => {
    // Measure highlight targets (for glow ring + clip-path)
    if (step?.highlightMultiple) {
      const rects = step.highlightMultiple
        .map((sel) => document.querySelector(sel))
        .filter(Boolean)
        .map((el) => el.getBoundingClientRect());
      setMultiRects(rects);
      setTargetRect(getUnionRect(rects));
    } else if (step?.target) {
      const el = document.querySelector(step.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        setMultiRects([rect]);
      } else {
        setTargetRect(null);
        setMultiRects([]);
      }
    } else {
      setTargetRect(null);
      setMultiRects([]);
    }

    // Measure tooltip anchor (expanded panel element, if specified)
    if (step?.tooltipTarget) {
      const el = document.querySelector(step.tooltipTarget);
      if (el) {
        setTooltipAnchorRect(el.getBoundingClientRect());
      } else {
        setTooltipAnchorRect(null);
      }
    } else {
      setTooltipAnchorRect(null);
    }
  }, [step]);

  // Measure tooltip size
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (tooltipRef.current) {
        const rect = tooltipRef.current.getBoundingClientRect();
        setTooltipSize((prev) =>
          prev.width === rect.width && prev.height === rect.height
            ? prev
            : { width: rect.width, height: rect.height }
        );
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [tourStep]);

  // Measure target and set expanded panel on step change
  useEffect(() => {
    setTourExpandedPanel(step?.expandPanel || null);
    // Delay measurement to let expanded panels render
    const timer = setTimeout(measureTarget, step?.expandPanel ? 200 : 50);
    return () => clearTimeout(timer);
  }, [tourStep, step, measureTarget, setTourExpandedPanel]);

  // Re-measure on resize
  useEffect(() => {
    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(measureTarget, 100);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimerRef.current);
    };
  }, [measureTarget]);

  const navigate = useCallback((delta) => {
    if (transitioning) return;
    const next = tourStep + delta;
    if (next < 0 || next >= TOUR_STEPS.length) return;
    setTransitioning(true);
    setTourExpandedPanel(null);
    requestAnimationFrame(() => {
      setTourStep(next);
    });
    clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = setTimeout(() => setTransitioning(false), TRANSITION_MS);
  }, [transitioning, tourStep, setTourStep, setTourExpandedPanel]);

  const goNext = useCallback(() => {
    if (isLast) { onClose(); return; }
    navigate(1);
  }, [isLast, onClose, navigate]);

  const goPrev = useCallback(() => {
    if (isFirst) return;
    navigate(-1);
  }, [isFirst, navigate]);

  useEffect(() => () => clearTimeout(transitionTimerRef.current), []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  if (!step) return null;

  // Use tooltipAnchorRect (expanded panel) for tooltip positioning when available,
  // otherwise fall back to the highlight target rect
  const tooltipRefRect = tooltipAnchorRect || targetRect;
  const tooltipPlacement = step.tooltipPlacement || step.placement;
  const tooltipPos = computeTooltipPosition(tooltipRefRect, tooltipPlacement, tooltipSize);

  // Arrow points from tooltip toward the tooltipAnchor (expanded panel) or target
  const arrowStyle = computeArrowStyle(tooltipPlacement, tooltipRefRect, tooltipPos, tooltipSize);
  const totalSteps = TOUR_STEPS.length;

  return (
    <>
      {!isCentered && (
        <div
          className="tour-overlay"
          style={{
            clipPath: targetRect ? getClipPath(targetRect, padding) : "none",
          }}
        />
      )}

      {isCentered && <div className="tour-backdrop" />}

      {/* Glow rings — one per highlighted element */}
      {!isCentered && multiRects.map((rect, i) => (
        <div
          key={i}
          className="tour-glow-ring"
          style={{
            top: `${rect.top - padding}px`,
            left: `${rect.left - padding}px`,
            width: `${rect.width + padding * 2}px`,
            height: `${rect.height + padding * 2}px`,
          }}
        />
      ))}

      <div
        ref={tooltipRef}
        className={`tour-tooltip ${isCentered ? "tour-tooltip-centered" : ""}`}
        style={tooltipPos}
      >
        <button type="button" className="tour-tooltip-close" onClick={onClose} aria-label="Close tour">
          &#x2715;
        </button>

        {arrowStyle && !isCentered && <div style={arrowStyle} />}
        <div className="tour-tooltip-header">{step.header}</div>
        <div className="tour-tooltip-body">{step.body}</div>
        <div className="tour-tooltip-footer">
          <span className="tour-step-counter">
            {tourStep + 1} / {totalSteps}
          </span>
          <div className="tour-tooltip-buttons">
            {!isFirst && (
              <button type="button" className="tour-btn" onClick={goPrev} disabled={transitioning}>
                Back
              </button>
            )}
            <button
              type="button"
              className="tour-btn tour-btn-primary"
              onClick={isLast ? onClose : goNext}
              disabled={transitioning}
            >
              {isLast ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
