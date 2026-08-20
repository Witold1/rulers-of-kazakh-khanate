/** SVG century × year tiles (port of `draw_year_tiles` + `style_century_axes`). */

import { EMPTY } from "./parse.js";
import { absoluteYear } from "./grid.js";
import { THEMES } from "./colors.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const COL_W = 13;
const ROW_H = 80;
const PAD_L = 58;
const Y_LABEL_X = 28;
const PAD_R = 16;
const PAD_T = 32;
const PAD_B = 12;
const TILE_INSET = 0.08;
const TILE_W = 0.7;
const Y_OFFSET = 0.25;
const CELL_H = 0.5;
const GAP = 0.025;

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    node.setAttribute(key, String(value));
  }
  return node;
}

function stripeSize(nStripes, cellHeight = CELL_H, gap = GAP) {
  if (nStripes <= 1) return { height: cellHeight, gap };
  const height = cellHeight / nStripes - gap;
  gap = gap + gap / (nStripes - 1);
  return { height, gap };
}

function tileX(col) {
  return PAD_L + (col + TILE_INSET) * COL_W;
}

function yTop(row) {
  return PAD_T + row * ROW_H;
}

export function chartSize(nRows) {
  return {
    width: PAD_L + 100 * COL_W + PAD_R,
    height: PAD_T + nRows * ROW_H + PAD_B,
    colW: COL_W,
    rowH: ROW_H,
    padL: PAD_L,
    padT: PAD_T,
  };
}

export function yearAtPoint(svg, clientX, clientY, nRows) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const local = pt.matrixTransform(ctm.inverse());
  const col = Math.floor((local.x - PAD_L) / COL_W);
  const row = Math.floor((local.y - PAD_T) / ROW_H);
  if (col < 0 || col > 99 || row < 0 || row >= nRows) return null;
  return { row, col };
}

/**
 * @param {SVGElement} svg
 * @param {{ grid: number[][][], firstRow: number, lastRow: number }} occupancy
 * @param {string[]} colors
 * @param {"light" | "dark"} theme
 * @param {{ sortStripes?: boolean }} [opts]
 */
export function renderChart(svg, occupancy, colors, theme, opts = {}) {
  const { grid, firstRow } = occupancy;
  const nRows = grid.length;
  const { width, height } = chartSize(nRows);
  const themeColors = THEMES[theme];
  const sortStripes = opts.sortStripes ?? theme === "light";

  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.aspectRatio = `${width} / ${height}`;
  svg.style.background = themeColors.face;

  const root = svgEl("g", { class: "chart-root" });
  svg.append(root);

  root.append(
    svgEl("rect", {
      class: "plot-bg",
      x: PAD_L,
      y: PAD_T,
      width: 100 * COL_W,
      height: nRows * ROW_H,
      fill: themeColors.face,
    }),
  );

  const gridLayer = svgEl("g", {
    class: "axis-grid",
    "aria-hidden": "true",
    "pointer-events": "none",
  });
  for (let col = 0; col <= 100; col += 10) {
    const x = PAD_L + col * COL_W;
    gridLayer.append(
      svgEl("line", {
        x1: x,
        x2: x,
        y1: PAD_T,
        y2: PAD_T + nRows * ROW_H,
        stroke: themeColors.grid,
        "stroke-dasharray": "3 4",
        "stroke-opacity": "0.5",
        "stroke-width": "1.25",
      }),
    );
    if (col < 100) {
      const label = svgEl("text", {
        x: x - 1,
        y: PAD_T - 10,
        fill: themeColors.tick,
        "font-size": "15",
        "font-family": "Segoe UI, system-ui, sans-serif",
        "text-anchor": "start",
      });
      label.textContent = String(col);
      gridLayer.append(label);
    }
  }
  root.append(gridLayer);

  const labels = svgEl("g", { class: "axis-labels", "pointer-events": "none" });
  for (let row = 0; row < nRows; row += 1) {
    const century = firstRow + row;
    const labelY = yTop(row) + ROW_H / 2;
    const text = svgEl("text", {
      x: Y_LABEL_X,
      y: labelY,
      fill: themeColors.tick,
      "font-size": "15",
      "font-family": "Segoe UI, system-ui, sans-serif",
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      transform: `rotate(-90 ${Y_LABEL_X} ${labelY})`,
    });
    text.textContent = `${century * 100}s`;
    labels.append(text);
  }
  root.append(labels);

  const tiles = svgEl("g", { class: "tiles" });
  const groups = new Map();
  function groupFor(rulerId) {
    let group = groups.get(rulerId);
    if (!group) {
      group = svgEl("g", { class: "ruler-tiles", "data-ruler-id": rulerId });
      groups.set(rulerId, group);
    }
    return group;
  }
  function addTile(rulerId, year, x, y, width, height) {
    groupFor(rulerId).append(
      svgEl("rect", {
        class: "tile",
        x,
        y,
        width,
        height,
        fill: colors[rulerId - 1],
        "data-ruler-id": rulerId,
        "data-year": year,
      }),
    );
  }

  for (let row = 0; row < nRows; row += 1) {
    for (let col = 0; col < 100; col += 1) {
      const rulers = grid[row][col];
      if (rulers.length === 1 && rulers[0] === EMPTY) continue;
      const year = absoluteYear(firstRow, row, col);

      if (rulers.length === 1) {
        const rulerId = rulers[0];
        addTile(
          rulerId,
          year,
          tileX(col),
          yTop(row) + Y_OFFSET * ROW_H,
          TILE_W * COL_W,
          CELL_H * ROW_H,
        );
        continue;
      }

      const { height, gap } = stripeSize(rulers.length);
      const ordered = sortStripes ? [...rulers].sort((a, b) => a - b) : [...rulers];
      for (let i = 0; i < ordered.length; i += 1) {
        const rulerId = ordered[i];
        addTile(
          rulerId,
          year,
          tileX(col),
          yTop(row) + (Y_OFFSET + i * (height + gap)) * ROW_H,
          TILE_W * COL_W,
          height * ROW_H,
        );
      }
    }
  }
  for (const rulerId of [...groups.keys()].sort((a, b) => a - b)) {
    tiles.append(groups.get(rulerId));
  }
  root.append(tiles);

  const hoverCol = svgEl("rect", {
    class: "hover-col",
    x: PAD_L,
    y: PAD_T,
    width: COL_W,
    height: nRows * ROW_H,
    fill: themeColors.tick,
    "fill-opacity": "0",
    "pointer-events": "none",
  });
  root.append(hoverCol);

  return { nRows, width, height, hoverCol };
}

export function setHoverColumn(hoverCol, col) {
  if (!hoverCol) return;
  if (col == null || col < 0) {
    hoverCol.setAttribute("fill-opacity", "0");
    return;
  }
  hoverCol.setAttribute("x", String(PAD_L + col * COL_W));
  hoverCol.setAttribute("fill-opacity", "0.06");
}

export function setActiveRuler(svg, rulerId) {
  svg.classList.toggle("is-filtered", rulerId != null);
  for (const group of svg.querySelectorAll(".ruler-tiles.is-active")) {
    group.classList.remove("is-active");
  }
  if (rulerId == null) return;
  const group = svg.querySelector(`.ruler-tiles[data-ruler-id="${rulerId}"]`);
  group?.classList.add("is-active");
}
