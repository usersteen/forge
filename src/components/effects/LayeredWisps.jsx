/**
 * Wisp configs per container variant.
 * "header" — short/wide container (logo block), stage 4+
 * "sidebar" — tall container, stage 5
 * "tabbar" — short/wide container, stage 5
 */

const HEADER_WISPS = [
  { left: "10%", delay: 0,   dur: 3.0, w: 8,  h: 18 },
  { left: "30%", delay: 0.8, dur: 3.4, w: 10, h: 22 },
  { left: "55%", delay: 1.6, dur: 2.8, w: 7,  h: 16 },
  { left: "75%", delay: 0.4, dur: 3.2, w: 9,  h: 20 },
  { left: "42%", delay: 2.2, dur: 3.6, w: 8,  h: 24 },
];

const SIDEBAR_WISPS = [
  { left: "12%", delay: 0,    dur: 8.0,  w: 10, h: 40 },
  { left: "42%", delay: 3.0,  dur: 9.5,  w: 12, h: 50 },
  { left: "70%", delay: 1.5,  dur: 7.5,  w: 9,  h: 35 },
  { left: "28%", delay: 5.0,  dur: 10.0, w: 11, h: 45 },
  { left: "58%", delay: 2.5,  dur: 8.5,  w: 10, h: 42 },
  { left: "85%", delay: 6.5,  dur: 9.0,  w: 8,  h: 38 },
];

const TABBAR_WISPS = [
  { left: "8%",  delay: 0,   dur: 3.2, w: 8,  h: 16 },
  { left: "22%", delay: 0.6, dur: 2.8, w: 9,  h: 18 },
  { left: "38%", delay: 1.4, dur: 3.4, w: 7,  h: 14 },
  { left: "54%", delay: 0.3, dur: 3.0, w: 10, h: 20 },
  { left: "70%", delay: 1.8, dur: 2.6, w: 8,  h: 16 },
  { left: "86%", delay: 1.0, dur: 3.2, w: 9,  h: 18 },
];

const CONFIGS = {
  header: HEADER_WISPS,
  sidebar: SIDEBAR_WISPS,
  tabbar: TABBAR_WISPS,
};

const FILTER_IDS = {
  header: "wisp-noise-header",
  sidebar: "wisp-noise-sidebar",
  tabbar: "wisp-noise-tabbar",
};

export default function LayeredWisps({ variant }) {
  const wisps = CONFIGS[variant];
  const filterId = FILTER_IDS[variant];
  const className = `wisp-strand wisp-strand-${variant}`;

  return (
    <div className="steam-overlay">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.035"
              numOctaves="4"
              seed="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="18"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <div className={`wisp-noise-layer wisp-noise-layer-${variant}`}>
        {wisps.map((w, i) => (
          <div
            key={i}
            className={className}
            style={{
              left: w.left,
              width: w.w,
              height: w.h,
              animationDelay: `${w.delay}s`,
              animationDuration: `${w.dur}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
