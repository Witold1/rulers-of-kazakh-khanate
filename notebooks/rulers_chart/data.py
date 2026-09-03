"""Read and rasterize reign tables.

Turns a TSV/CSV of reigns into:
  1. a row per ruler (`parse_rulers` / `load_rulers`)
  2. a century × year grid of who ruled when (`build_year_grid`)
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

# Sentinel in the year grid: "nobody reigned this year". Ruler ids start at 1.
EMPTY = 0

# Wikipedia copy-paste mixes en-dash, em-dash, and ASCII hyphen (Batyr Khan).
PERIOD_SPLIT = r"[–—-]"


def century_from_year(year: int) -> int:
    """Ordinal century: 1456 → 15 (15th century), not the 1400s row index."""
    return int(year) // 100 + 1


def load_rulers(
    path: str | Path,
    *,
    name_col: str,
    reign_col: str,
    sep: str = "\t",
) -> pd.DataFrame:
    """Read a reign table from `path`.

    `name_col` and `reign_col` are the exact header names in that file.
    Extra columns are kept. A single year like `744` is a one-year reign.
    """
    table = pd.read_csv(path, sep=sep, encoding="utf-8")
    return parse_rulers(table, name_col=name_col, reign_col=reign_col)


def parse_rulers(
    table: pd.DataFrame,
    *,
    name_col: str,
    reign_col: str,
) -> pd.DataFrame:
    """Parse a reign table into one row per reign.

    `name_col` and `reign_col` must match the DataFrame headers exactly.
    Unicode prefixes on names (ᴭ ᶬ ᴶ ᴹ ᴮ) are left in the string.
    Web charts now prefer a `Group symbol` column instead.
    """
    table = table.copy()
    start_end = (
        table[reign_col].astype(str).str.split(PERIOD_SPLIT, n=1, expand=True)
    )
    table["start"] = start_end[0].astype(int)
    if start_end.shape[1] > 1:
        end_raw = start_end[1].replace("", pd.NA)
        table["end"] = (
            pd.to_numeric(end_raw, errors="coerce").fillna(table["start"]).astype(int)
        )
    else:
        table["end"] = table["start"]
    table["start_century"] = table["start"].map(century_from_year)
    table["end_century"] = table["end"].map(century_from_year)
    # Legend text: "Kerei 1456-1473" (parens from the old Chart String stripped).
    table["chart_label"] = (
        table[name_col].astype(str).str.replace(r"[()]", "", regex=True)
        + " "
        + table["start"].astype(str)
        + "-"
        + table["end"].astype(str)
    )
    # Stable so equal start years keep file order (Buidash before Ahmed, etc.).
    table = table.sort_values("start", kind="stable").reset_index(drop=True)
    table["ruler_id"] = table.index + 1  # 1-based: colors[ruler_id - 1]
    return table


def build_year_grid(
    table: pd.DataFrame,
    *,
    max_year: int = 1900,
    years_per_century: int = 100,
) -> list[list[list[int]]]:
    """Map each calendar year to the ruler ids who reigned that year.

    Returns century rows × 100 years × [ruler_id, ...].

    Year 1456 lives at `grid[14][56]`:
        1456 // 100 = 14  → 1400s row (axis label "1400ₛ")
        1456 %  100 = 56  → column 56

    End years are inclusive (`range(start, end + 1)`), so adjacent Wikipedia
    periods like 1456–1473 and 1473–1480 share 1473. Gaps stay `[EMPTY]`.
    Overlaps append every id, in table order — no overwriting.
    """
    years: list[list[int]] = [[EMPTY] for _ in range(max_year)]
    for ruler_id, start, end in table[["ruler_id", "start", "end"]].itertuples(
        index=False
    ):
        for year in range(int(start), int(end) + 1):
            if EMPTY in years[year]:
                years[year].remove(EMPTY)
            years[year].append(int(ruler_id))

    n_centuries = max_year // years_per_century
    return [
        years[i * years_per_century : (i + 1) * years_per_century]
        for i in range(n_centuries)
    ]
