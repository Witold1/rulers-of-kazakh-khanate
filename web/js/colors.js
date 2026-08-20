/** Light/dark palettes from `rulers_chart.plot`. */

export const THEMES = {
  dark: {
    face: "#666666",
    tick: "#ffffff",
    grid: "#ffffff",
    title: "#ffffff",
    legendHeader: "#ffffff",
    caption: "#ffffff",
  },
  light: {
    face: "#ffffff",
    tick: "#000000",
    grid: "#000000",
    title: "#000000",
    legendHeader: "#000000",
    caption: "#9a9a9a",
  },
};

export const PALETTE_PRESETS = {
  default: {
    label: "Default",
    palettes: {
      dark: ["#dd7e73", "#FFCC00", "#FFFFCC", "#66CC33", "#F0D1E2", "#789de5", "#C0C0C0"],
      light: ["#dd7e73", "#FFCC00", "#FFFFCC", "#66CC33", "#F0D1E2", "#789de5", "#C0C0C0"],
    },
  },
  warm: {
    label: "Warm",
    palettes: {
      dark: ["#e74c3c", "#e67e22", "#f1c40f", "#d35400", "#c0392b", "#f39c12", "#FF5722"],
      light: ["#c0392b", "#d35400", "#e67e22", "#f39c12", "#e74c3c", "#922b21", "#7b241c"],
    },
  },
  cool: {
    label: "Cool",
    palettes: {
      dark: ["#3498db", "#1abc9c", "#9b59b6", "#2980b9", "#16a085", "#8e44ad", "#5DADE2"],
      light: ["#2980b9", "#16a085", "#8e44ad", "#3498db", "#1abc9c", "#2c3e50", "#566573"],
    },
  },
  earth: {
    label: "Earth",
    palettes: {
      dark: ["#8d6e63", "#a1887f", "#bcaaa4", "#6d4c41", "#795548", "#d7ccc8", "#558B2F"],
      light: ["#5d4037", "#6d4c41", "#795548", "#8d6e63", "#a1887f", "#4e342e", "#33691e"],
    },
  },
};

/** @deprecated use PALETTE_PRESETS.default.palettes */
export const PALETTES = PALETTE_PRESETS.default.palettes;

export function paletteForPreset(presetId, theme) {
  const preset = PALETTE_PRESETS[presetId] ?? PALETTE_PRESETS.default;
  return preset.palettes[theme] ?? preset.palettes.dark;
}

export function repeatingColors(n, palette) {
  if (n <= 0) return [];
  const out = [];
  while (out.length < n) out.push(...palette);
  return out.slice(0, n);
}

export function colorForRuler(rulerId, colors) {
  return colors[rulerId - 1];
}
