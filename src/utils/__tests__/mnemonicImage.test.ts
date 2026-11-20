import { inlineSvgClassStyles, liftOpacityForDarkTheme } from "../mnemonicImage";

// Shape of WaniKani's radical mnemonic illustrations: a blue highlight plus artwork
// drawn on 50% and 25% opacity layers with no explicit fill (defaults to black).
const MNEMONIC_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1420 1420">
  <defs><style>
    .cls-1 { fill: #0af; }
    .cls-2 { opacity: .5; }
    .cls-3 { opacity: .25; }
  </style></defs>
  <g id="highlight"><path class="cls-1" d="M0 0h10v10z"/></g>
  <g id="artwork">
    <g id="opacity-50" class="cls-2"><path d="M1 1h5v5z"/></g>
    <g id="opacity-25" class="cls-3"><path d="M2 2h5v5z"/></g>
    <path d="M3 3h5v5z" fill-opacity="0.5" stroke-opacity="50%"/>
  </g>
</svg>`;

describe("liftOpacityForDarkTheme", () => {
  it("lifts partial opacities along a square-root curve", () => {
    expect(liftOpacityForDarkTheme(".25")).toBe("0.5");
    expect(liftOpacityForDarkTheme("0.5")).toBe("0.707");
    expect(liftOpacityForDarkTheme("25%")).toBe("0.5");
  });

  it("leaves fully opaque, fully transparent and non-numeric values alone", () => {
    expect(liftOpacityForDarkTheme("1")).toBe("1");
    expect(liftOpacityForDarkTheme("0")).toBe("0");
    expect(liftOpacityForDarkTheme("inherit")).toBe("inherit");
  });
});

describe("inlineSvgClassStyles", () => {
  it("lifts each faint artwork layer exactly once in dark themes", () => {
    const svg = inlineSvgClassStyles(MNEMONIC_SVG, "#f5f5f5", true, "#f5f5f5");

    expect(svg).toContain('<g id="opacity-50" opacity="0.707" class="cls-2">');
    expect(svg).toContain('<g id="opacity-25" opacity="0.5" class="cls-3">');
    expect(svg).toContain('fill-opacity="0.707"');
    expect(svg).toContain('stroke-opacity="0.707"');
    // Unfilled artwork paths are recolored to the theme text color.
    expect(svg).toContain('<path d="M1 1h5v5z" fill="#f5f5f5"/>');
    // The highlight keeps WaniKani's blue.
    expect(svg).toContain('<path fill="#0af" class="cls-1"');
  });

  it("keeps the original opacities and colors in light themes", () => {
    const svg = inlineSvgClassStyles(MNEMONIC_SVG, "#333333", false, "#333333");

    expect(svg).toContain('<g id="opacity-50" opacity=".5" class="cls-2">');
    expect(svg).toContain('<g id="opacity-25" opacity=".25" class="cls-3">');
    expect(svg).toContain('fill-opacity="0.5"');
    expect(svg).toContain('stroke-opacity="50%"');
    expect(svg).toContain('<path d="M1 1h5v5z"/>');
  });
});
