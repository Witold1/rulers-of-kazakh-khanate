"""Draw the century × year tile chart.

Layout (same idea as the Barely Maps Roman-emperors chart / missingno matrix):

    x = year inside the century (1456 → column 56)
    y = century row         (1456 → row 14, labeled 1400s)

Each year is a colored rectangle. Empty years (power vacuum) are left blank.
When two khans overlap, that year is split into horizontal stripes.

Color is keyed by 1-based `ruler_id` after a stable sort by start year, so the
legend and the tiles stay aligned as long as nobody shuffles the table later.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Literal, Sequence

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import pandas as pd

from .data import EMPTY

ThemeName = Literal["dark", "light"]

THEMES: dict[str, dict[str, str]] = {
    "dark": {
        "face": "#666666",
        "tick": "white",
        "grid": "white",
        "title": "white",
        "legend_header": "white",
        "caption": "white",
    },
    "light": {
        "face": "white",
        "tick": "black",
        "grid": "black",
        "title": "black",
        "legend_header": "black",
        "caption": "#9a9a9a",
    },
}

# Six colors, then they wrap. The 7th khan reuses the 1st color on purpose.
PALETTES: dict[str, list[str]] = {
    "dark": ["#dd7e73", "#FFCC00", "#FFFFCC", "#66CC33", "#F0D1E2", "#789de5", "#C0C0C0"],
    "light": ["#dd7e73", "#FFCC00", "#FFFFCC", "#66CC33", "#F0D1E2", "#789de5", "#C0C0C0"],
}

DEFAULT_CAPTION = (
    "Source: en.wikipedia.org/wiki/List_of_Kazakh_khans",
    "& ru.wikipedia.org/wiki/Казахский_хан",
    "Author: Witold @ Witold1.github.io",
)


def artifacts_dir() -> Path:
    """`notebooks/artifacts/` next to this package (created if missing).

    This file lives at `notebooks/rulers_chart/plot.py`, so the notebooks
    folder is one parent up.
    """
    path = Path(__file__).resolve().parents[1] / "artifacts"
    path.mkdir(exist_ok=True)
    return path


def repeating_colors(n: int, palette: Sequence[str]) -> list[str]:
    """Tile `palette` until there is one color per ruler."""
    return list(palette) * math.ceil(n / len(palette))


def _stripe_size(
    n_stripes: int, *, cell_height: float = 0.5, gap: float = 0.025
) -> tuple[float, float]:
    """Split one year-cell's height into N stripes with a little gap between."""
    if n_stripes <= 1:
        return cell_height, gap
    height = cell_height / n_stripes - gap
    # Spread the leftover so the stack still fills the same 0.5 cell.
    gap = gap + gap / (n_stripes - 1)
    return height, gap


def draw_year_tiles(
    ax: plt.Axes,
    year_grid: Sequence[Sequence[Sequence[int]]],
    colors: Sequence[str],
    *,
    sort_stripes: bool = False,
    svg_gids: bool = False,
    width: float = 0.6,
    single_x_offset: float = 0.3,
    stripe_x_offset: float = 0.35,
    y_offset: float = 0.25,
    cell_height: float = 0.5,
    gap: float = 0.025,
) -> None:
    """Draw one rectangle (or a stack of stripes) per year.

    `sort_stripes=True` orders ids in a cell, which looks tidier but a khan
    can jump to another stripe when a rival appears. Stable lanes are still
    an open problem.

    `svg_gids` writes matplotlib `gid=` onto patches so the SVG can be
    targeted later (hover, CSS, etc.).
    """
    for century, years in enumerate(year_grid):
        for year_in_century, rulers in enumerate(years):
            if rulers == [EMPTY]:
                continue  # power vacuum / no data — leave the hole

            if len(rulers) == 1:
                ruler_id = rulers[0]
                gid = f"stripe | {century}-{year_in_century}" if svg_gids else None
                ax.add_patch(
                    mpatches.Rectangle(
                        # Slightly different x nudge than the overlap branch;
                        # leftover from the original notebook, kept on purpose.
                        xy=(year_in_century - single_x_offset, century - y_offset),
                        width=width,
                        height=cell_height,
                        facecolor=colors[ruler_id - 1],
                        gid=gid,
                    )
                )
                continue

            height, stripe_gap = _stripe_size(
                len(rulers), cell_height=cell_height, gap=gap
            )
            ordered = sorted(rulers) if sort_stripes else list(rulers)
            for stripe_i, ruler_id in enumerate(ordered):
                gid = (
                    f"stripe | {century}-{year_in_century}-{ruler_id}"
                    if svg_gids
                    else None
                )
                ax.add_patch(
                    mpatches.Rectangle(
                        xy=(
                            year_in_century - stripe_x_offset,
                            century + stripe_i * (height + stripe_gap) - y_offset,
                        ),
                        width=width,
                        height=height,
                        facecolor=colors[ruler_id - 1],
                        gid=gid,
                    )
                )


def occupied_century_rows(
    year_grid: Sequence[Sequence[Sequence[int]]],
) -> tuple[int, ...]:
    """Inclusive range of century-row indices that contain at least one reign."""
    occupied = [
        i
        for i, years in enumerate(year_grid)
        if any(list(rulers) != [EMPTY] for rulers in years)
    ]
    if not occupied:
        return (14, 15, 16, 17, 18)
    return tuple(range(occupied[0], occupied[-1] + 1))


def style_century_axes(
    ax: plt.Axes,
    *,
    theme: ThemeName,
    centuries: Sequence[int] | None = None,
) -> None:
    """Bare chart frame: decades on top, century rows top to bottom.

    `centuries` are row indices of the year grid (14 = 1400s), not ordinal
    centuries. Defaults to 14..18 (Kazakh khans). Pass the occupied range
    for other datasets (caliphs: 6..12).
    """
    if centuries is None:
        centuries = (14, 15, 16, 17, 18)
    colors = THEMES[theme]
    ax.set_facecolor(colors["face"])
    ax.set_ylim([centuries[0] - 0.5, centuries[-1] + 0.5])
    ax.set_axisbelow(True)
    ax.spines[["top", "bottom", "right", "left"]].set_visible(False)
    ax.grid(axis="x", ls="--", alpha=0.5, color=colors["grid"])
    ax.margins(x=0.03, y=0.1, tight=True)
    ax.invert_yaxis()  # 1400s at the top
    ax.yaxis.get_major_locator().set_params(integer=True)
    ax.xaxis.set_ticks_position("top")
    ax.tick_params(axis="x", colors=colors["tick"])
    ax.tick_params(axis="y", colors=colors["tick"])
    ax.tick_params(axis="both", which="both", length=0)
    ax.xaxis.set_major_locator(plt.MultipleLocator(10))
    ax.set_yticks(
        list(centuries),
        [f"{century * 100}ₛ" for century in centuries],
        rotation="vertical",
        va="center",
    )


def add_century_legend(
    fig: plt.Figure,
    table: pd.DataFrame,
    colors: Sequence[str],
    *,
    theme: ThemeName,
    svg_gids: bool = False,
    x0: float = 0.02,
    y0: float = -0.05,
    line_step: float = 0.05,
) -> None:
    """Names under the chart, grouped by the century the *reign started*.

    A khan who starts in 1715 and rules into the 1800s is listed only under
    the 18th century. Colors are consumed in the same order as `ruler_id`.

    Positions are figure fractions (can sit below the axes). Column spacing
    is still hand-tuned; the extra 18th-century nudge makes room for the
    crowded post-split names.
    """
    header_color = THEMES[theme]["legend_header"]
    colors_iter = iter(colors)
    x = x0
    for century, group in table.groupby("start_century"):
        y = y0
        fig.text(
            s=f"{century}ᵗʰ century",
            x=x,
            y=y,
            horizontalalignment="left",
            va="top",
            wrap=True,
            fontweight="heavy",
            color=header_color,
            gid=f"text | {century}" if svg_gids else None,
        )
        for i, label in enumerate(group["chart_label"]):
            y -= line_step
            fig.text(
                s=label,
                x=x,
                y=y,
                horizontalalignment="left",
                va="top",
                wrap=True,
                fontweight="light",
                color=next(colors_iter),
                gid=f"text | {i}-{label}" if svg_gids else None,
            )
        x = x + 0.165 + century / 1000
        if century == 18:
            x += 0.055


def add_caption(
    fig: plt.Figure,
    *,
    theme: ThemeName,
    title: str = "Kazakh khans by Year",
    lines: Sequence[str] = DEFAULT_CAPTION,
    y0: float = -0.75,
    line_step: float = 0.05,
) -> None:
    """Title (top-right) and source lines hanging below the axes."""
    colors = THEMES[theme]
    fig.suptitle(
        title,
        x=1.0,
        horizontalalignment="right",
        fontsize=22,
        fontweight="normal",
        color=colors["title"],
    )
    y = y0
    for i, line in enumerate(lines):
        # Sources in mono; author line keeps the default font, as originally.
        extra = {"family": "mono"} if i < len(lines) - 1 else {}
        fig.text(
            s=line,
            x=0.999,
            y=y,
            horizontalalignment="right",
            wrap=True,
            fontweight="normal",
            color=colors["caption"],
            **extra,
        )
        y -= line_step


def plot_rulers(
    table: pd.DataFrame,
    year_grid: Sequence[Sequence[Sequence[int]]],
    *,
    theme: ThemeName = "light",
    sort_stripes: bool | None = None,
    svg_gids: bool | None = None,
    title: str = "Kazakh khans by Year",
    figsize: tuple[float, float] = (10, 4),
    dpi: int = 200,
    save_stem: str | None = None,
) -> tuple[plt.Figure, plt.Axes]:
    """Render the century grid and optionally save `{stem}.svg` / `{stem}.png`.

    Bare stems (`kazakh_khans_dark`) go to `notebooks/artifacts/`. An absolute path is
    used as-is.

    Light theme defaults: sort stripes, tag SVG ids (the old `beta4w` chart).
    Dark theme defaults: table order, no gids (the old `beta4` chart).
    """
    if sort_stripes is None:
        sort_stripes = theme == "light"
    if svg_gids is None:
        svg_gids = theme == "light"

    palette = repeating_colors(len(table), PALETTES[theme])
    centuries = occupied_century_rows(year_grid)
    fig, ax = plt.subplots(1, 1, figsize=figsize, dpi=dpi, tight_layout=True)
    fig.set_facecolor(THEMES[theme]["face"])
    draw_year_tiles(
        ax, year_grid, palette, sort_stripes=sort_stripes, svg_gids=svg_gids
    )
    style_century_axes(ax, theme=theme, centuries=centuries)
    add_century_legend(fig, table, palette, theme=theme, svg_gids=svg_gids)
    add_caption(fig, theme=theme, title=title)
    fig.tight_layout()
    if save_stem:
        stem = Path(save_stem)
        dest = stem if stem.is_absolute() else artifacts_dir() / stem.name
        dest.parent.mkdir(parents=True, exist_ok=True)
        for fmt in ("svg", "png"):
            fig.savefig(
                dest.with_suffix(f".{fmt}"),
                bbox_inches="tight",
                pad_inches=0.3,
                format=fmt,
            )
    return fig, ax
