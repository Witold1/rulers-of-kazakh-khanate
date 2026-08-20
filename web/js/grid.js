/** Century × year occupancy grid (port of `build_year_grid`). */

import { EMPTY } from "./parse.js";

export { EMPTY };

export function yearExtent(rulers) {
  const minYear = Math.min(...rulers.map((r) => r.start));
  const maxYear = Math.max(...rulers.map((r) => r.end));
  return {
    minYear,
    maxYear,
    firstRow: Math.floor(minYear / 100),
    lastRow: Math.floor(maxYear / 100),
  };
}

/**
 * Map each calendar year to the ruler ids who reigned that year.
 * End years are inclusive. Overlaps append every id in table order.
 *
 * `grid[row][year % 100]` is the 1400s row when `firstRow` is 14.
 */
export function buildYearGrid(rulers, extent = yearExtent(rulers)) {
  const { firstRow, lastRow } = extent;
  const nRows = lastRow - firstRow + 1;
  const grid = Array.from({ length: nRows }, () =>
    Array.from({ length: 100 }, () => [EMPTY]),
  );

  for (const ruler of rulers) {
    for (let year = ruler.start; year <= ruler.end; year += 1) {
      const row = Math.floor(year / 100) - firstRow;
      const col = ((year % 100) + 100) % 100;
      if (row < 0 || row >= nRows) continue;
      const cell = grid[row][col];
      const emptyAt = cell.indexOf(EMPTY);
      if (emptyAt !== -1) cell.splice(emptyAt, 1);
      cell.push(ruler.rulerId);
    }
  }

  return { grid, firstRow, lastRow, ...extent };
}

export function absoluteYear(firstRow, row, col) {
  return (firstRow + row) * 100 + col;
}
