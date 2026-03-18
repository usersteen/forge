import { AbsoluteFill, useCurrentFrame } from "remotion";
import ForgeWordmark from "../components/ForgeWordmark";
import { getEmberStyle } from "../utils/heat";
import { getThemeHeatColor, getThemeTokens } from "../utils/themes";
import "../styles/global.css";
import "./social.css";

const HEAT_STAGE = 5;
const SEGMENT_FRAMES = 75;
const THEME_ORDER = ["forge", "ice", "void", "grass"];
const HEADER_EMBER_POSITIONS = [3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 93, 97, 100];

export function ForgeSocialThemeCycle() {
  const frame = useCurrentFrame();
  const segmentIndex = Math.floor(frame / SEGMENT_FRAMES) % THEME_ORDER.length;
  const theme = THEME_ORDER[segmentIndex];
  const themeTokens = getThemeTokens(theme, HEAT_STAGE);
  const logoFill = getThemeHeatColor(theme, HEAT_STAGE);

  return (
    <AbsoluteFill
      className="social-stage5-root"
      data-heat={HEAT_STAGE}
      data-theme={theme}
      data-fx="on"
      style={themeTokens}
    >
      <div className="sidebar-header forge-heat-5 social-stage5-block">
        {HEADER_EMBER_POSITIONS.map((left, i) => (
          <span
            key={i}
            className="forge-ember"
            style={{ left: `${left}%`, animationDelay: `${(i * 0.4) % 2}s`, ...getEmberStyle(i, theme) }}
          />
        ))}
        <div className="sidebar-logo sidebar-logo-heat-5 social-stage5-logo">
          <ForgeWordmark fill={logoFill} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
