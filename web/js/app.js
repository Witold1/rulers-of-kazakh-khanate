import { parseRulers, listColumns, EMPTY } from "./parse.js";
import { buildYearGrid, yearExtent } from "./grid.js";
import { PALETTE_PRESETS, paletteForPreset, repeatingColors, THEMES } from "./colors.js";
import {
  renderChart,
  setActiveRuler,
  setHoverColumn,
  yearAtPoint,
} from "./chart.js";
import { renderLegend, setLegendSelection } from "./legend.js";
import { bindTooltip, yearReadout, yearTooltipHtml } from "./tooltip.js";
import { initExport } from "./export.js";

const PRESET_MANIFEST_URL = "../data/presets.meta.json";
const DEFAULT_DATASET_ID = "khans";
const DATASETS = {};
const DEFAULT_AUTHOR_HTML = `Author: Witold @ <a href="https://witold1.github.io">Witold1.github.io</a>`;

const svg = document.querySelector("#chart");
const legendEl = document.querySelector("#legend");
const tooltipEl = document.querySelector("#tooltip");
const readoutEl = document.querySelector("#readout");
const errorEl = document.querySelector("#error");
const themeBtn = document.querySelector("#theme-toggle");
const titleEl = document.querySelector("#chart-title");
const sourcesEl = document.querySelector("#sources");
const authorEl = document.querySelector("#author-line");
const presetControlsEl = document.querySelector("#preset-controls");
const uploadOpenBtn = document.querySelector("#upload-open");
const uploadInput = document.querySelector("#custom-tsv");
const customFileNameEl = document.querySelector("#custom-file-name");
const formatSelect = document.querySelector("#custom-format");
const customPanelEl = document.querySelector("#custom-panel");
const customTitleInput = document.querySelector("#custom-title");
const customSourcesInput = document.querySelector("#custom-sources");
const customAuthorInput = document.querySelector("#custom-author");
const colNameSelect = document.querySelector("#col-name");
const colPeriodSelect = document.querySelector("#col-period");
const colGroupSelect = document.querySelector("#col-group");
const colMarkSelect = document.querySelector("#col-mark");
const colNativeSelect = document.querySelector("#col-native");
const colDeathSelect = document.querySelector("#col-death");
const applyCustomBtn = document.querySelector("#apply-custom");
const customErrorEl = document.querySelector("#custom-error");
const paletteSelect = document.querySelector("#custom-palette");
const palettePreviewEl = document.querySelector("#palette-preview");
const tooltip = bindTooltip(tooltipEl, readoutEl);
const COPIED_READOUT_MS = 1000;
const CUSTOM_DATASET_ID = "__custom__";
let copiedReadoutTimer = null;

function showCustomError(message) {
  customErrorEl.hidden = false;
  customErrorEl.textContent = message;
  const setupToggle = customPanelEl.querySelector("#dataset-setup-toggle");
  if (setupToggle) setSectionOpen(setupToggle, true);
}

function clearCustomError() {
  customErrorEl.hidden = true;
  customErrorEl.textContent = "";
}

function closeFieldTips() {
  document.querySelectorAll(".stat-tip-bubble").forEach((bubble) => {
    bubble.hidden = true;
  });
  document.querySelectorAll(".stat-tip").forEach((btn) => {
    btn.setAttribute("aria-expanded", "false");
  });
}

function bindFieldTips(root) {
  root.querySelectorAll(".stat-tip").forEach((btn) => {
    const bubble = btn.parentElement?.querySelector(".stat-tip-bubble");
    if (!bubble) return;
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = bubble.hidden;
      closeFieldTips();
      if (open) {
        bubble.hidden = false;
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

function setSectionOpen(btn, open) {
  const name = btn.dataset.sectionName || "section";
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.setAttribute("aria-label", open ? `Hide ${name}` : `Show ${name}`);
}

function collapseCustomSections() {
  customPanelEl.querySelectorAll(".section-toggle").forEach((btn) => {
    setSectionOpen(btn, false);
  });
}

function bindSectionToggles(root) {
  root.querySelectorAll(".section-toggle").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = btn.getAttribute("aria-expanded") !== "true";
      setSectionOpen(btn, open);
    });
  });
}

function knownDataset(datasetId) {
  return datasetId in DATASETS;
}

function initialDatasetId() {
  const hash = location.hash.replace(/^#/, "");
  if (knownDataset(hash)) return hash;
  const stored = localStorage.getItem("rulers-chart-dataset");
  if (knownDataset(stored)) return stored;
  if (knownDataset(DEFAULT_DATASET_ID)) return DEFAULT_DATASET_ID;
  return Object.keys(DATASETS)[0];
}

const state = {
  theme: localStorage.getItem("rulers-chart-theme") || "dark",
  datasetId: DEFAULT_DATASET_ID,
  rulers: [],
  occupancy: null,
  colors: [],
  selectedId: null,
  hoverCol: null,
  nRows: 0,
  byId: new Map(),
  customTitle: "Custom rulers",
  customSources: "Source: Local file",
  customAuthor: "Author: Local file upload",
  customFileText: "",
  customFilename: "",
  customColumns: [],
  customPalettePreset: "default",
  formPresetId: null,
};

function renderPresetButtons() {
  presetControlsEl.innerHTML = "";
  for (const dataset of Object.values(DATASETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.dataset.dataset = dataset.id;
    button.textContent = dataset.title;
    presetControlsEl.append(button);
  }
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return await res.text();
}

function normalizePreset(item) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    sources: item.sources || "",
    author: item.author || DEFAULT_AUTHOR_HTML,
    format: item.format || "tsv",
    columns: item.columns || {},
  };
}

function filenameFromUrl(url) {
  return url?.split("/").pop() || "preset.tsv";
}

function updatePresetSelection() {
  const activePreset =
    state.formPresetId ?? (state.datasetId !== CUSTOM_DATASET_ID ? state.datasetId : null);
  for (const btn of presetControlsEl.querySelectorAll("[data-dataset]")) {
    const on = btn.dataset.dataset === activePreset;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
}

async function loadPresetManifest() {
  const raw = await fetchText(PRESET_MANIFEST_URL);
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.datasets)) {
    throw new Error("Preset manifest is invalid.");
  }
  for (const item of parsed.datasets) {
    if (!item?.id || !item?.title || !item?.url) continue;
    DATASETS[item.id] = normalizePreset(item);
  }
  if (Object.keys(DATASETS).length === 0) {
    throw new Error("Preset manifest has no valid datasets.");
  }
}

async function loadTsv(dataset) {
  try {
    return await fetchText(dataset.url);
  } catch (err) {
    throw new Error(
      `Could not load the reign table. Serve the repo root over HTTP (for example python -m http.server from the project root). ${err.message}`,
    );
  }
}

function rulersInCell(row, col) {
  const ids = state.occupancy?.grid[row]?.[col] ?? [EMPTY];
  if (ids.length === 1 && ids[0] === EMPTY) return [];
  return ids.map((id) => {
    const ruler = state.byId.get(id);
    return { ...ruler, color: state.colors[id - 1] };
  });
}

function activePalette() {
  if (state.datasetId === CUSTOM_DATASET_ID) {
    return paletteForPreset(state.customPalettePreset, state.theme);
  }
  return paletteForPreset("default", state.theme);
}

function renderPalettePreview() {
  palettePreviewEl.innerHTML = "";
  const colors = paletteForPreset(paletteSelect.value, state.theme);
  for (const color of colors) {
    const swatch = document.createElement("span");
    swatch.className = "palette-swatch";
    swatch.style.background = color;
    swatch.title = color;
    palettePreviewEl.append(swatch);
  }
}

function initPaletteSelect() {
  paletteSelect.innerHTML = "";
  for (const [id, preset] of Object.entries(PALETTE_PRESETS)) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = preset.label;
    paletteSelect.append(option);
  }
  paletteSelect.value = state.customPalettePreset;
  renderPalettePreview();
}

function paint() {
  const extent = yearExtent(state.rulers);
  state.occupancy = buildYearGrid(state.rulers, extent);
  state.colors = repeatingColors(state.rulers.length, activePalette());
  const drawn = renderChart(svg, state.occupancy, state.colors, state.theme);
  state.hoverCol = drawn.hoverCol;
  state.nRows = drawn.nRows;
  renderLegend(legendEl, state.rulers, state.colors, THEMES[state.theme].legendHeader);
  setActiveRuler(svg, state.selectedId);
  setLegendSelection(legendEl, state.selectedId);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  themeBtn.textContent = state.theme === "light" ? "Dark" : "Light";
  themeBtn.setAttribute("aria-pressed", state.theme === "dark" ? "true" : "false");
  localStorage.setItem("rulers-chart-theme", state.theme);
}

function applyDatasetChrome() {
  const dataset =
    state.datasetId === CUSTOM_DATASET_ID
      ? {
          title: state.customTitle,
          sources: state.customSources,
          author: state.customAuthor,
        }
      : DATASETS[state.datasetId];
  titleEl.textContent = dataset.title;
  document.title = dataset.title;
  svg.setAttribute("aria-label", `Century by year tile chart of ${dataset.title}`);
  sourcesEl.innerHTML = dataset.sources;
  authorEl.innerHTML = dataset.author || DEFAULT_AUTHOR_HTML;
  updatePresetSelection();
}

async function showDataset(datasetId) {
  const dataset = DATASETS[datasetId];
  if (!dataset) return;
  errorEl.hidden = true;
  const tsv = await loadTsv(dataset);
  state.datasetId = datasetId;
  state.rulers = parseRulers(tsv, {
    format: dataset.format ?? "tsv",
    columns: dataset.columns,
  });
  state.byId = new Map(state.rulers.map((r) => [r.rulerId, r]));
  state.selectedId = null;
  state.customTitle = "Custom rulers";
  state.customSources = "Source: Local file";
  state.customAuthor = "Author: Local file upload";
  state.customFileText = "";
  state.customFilename = "";
  state.customColumns = [];
  state.customPalettePreset = "default";
  state.formPresetId = datasetId;
  paletteSelect.value = "default";
  renderPalettePreview();
  localStorage.setItem("rulers-chart-dataset", datasetId);
  if (location.hash.replace(/^#/, "") !== datasetId) {
    history.replaceState(null, "", `#${datasetId}`);
  }
  applyDatasetChrome();
  paint();
}

function customParseOptions() {
  return {
    format: formatSelect.value,
    columns: {
      name: colNameSelect.value || undefined,
      period: colPeriodSelect.value || undefined,
      group: colGroupSelect.value || undefined,
      mark: colMarkSelect.value || undefined,
      nativeName: colNativeSelect.value || undefined,
      deathReason: colDeathSelect.value || undefined,
    },
  };
}

function showCustomDataset(tsvText, filename = "Local file") {
  clearCustomError();
  errorEl.hidden = true;
  const rulers = parseRulers(tsvText, customParseOptions());
  if (rulers.length === 0) {
    throw new Error(
      "Could not parse the file. Choose Ruler name and Reign period columns with valid data.",
    );
  }
  state.datasetId = CUSTOM_DATASET_ID;
  state.rulers = rulers;
  state.byId = new Map(state.rulers.map((r) => [r.rulerId, r]));
  state.selectedId = null;
  state.customTitle = customTitleInput.value.trim() || `${filename} (custom)`;
  state.customSources = customSourcesInput.value.trim() || "Source: Local file";
  state.customAuthor = customAuthorInput.value.trim() || "Author: Local file upload";
  state.customPalettePreset = paletteSelect.value;
  state.formPresetId = null;
  history.replaceState(null, "", "#custom");
  localStorage.removeItem("rulers-chart-dataset");
  applyDatasetChrome();
  paint();
}

function setSelectOptions(selectEl, columns, preferredRegex, { required = false } = {}) {
  const current = selectEl.value;
  selectEl.innerHTML = "";
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "(none)";
  selectEl.append(none);
  for (const col of columns) {
    const option = document.createElement("option");
    option.value = col;
    option.textContent = col;
    selectEl.append(option);
  }
  if (columns.includes(current)) {
    selectEl.value = current;
    return;
  }
  if (required) {
    const preferred = columns.find((name) => preferredRegex.test(name));
    selectEl.value = preferred || "";
    return;
  }
  selectEl.value = "";
}

function populateColumnSelects(columns, mapping = {}) {
  setSelectOptions(colNameSelect, columns, /name|имя/i, { required: true });
  setSelectOptions(colPeriodSelect, columns, /period|reign|правлен|годы|years/i, {
    required: true,
  });
  setSelectOptions(colNativeSelect, columns);
  setSelectOptions(colGroupSelect, columns);
  setSelectOptions(colMarkSelect, columns);
  setSelectOptions(colDeathSelect, columns);
  if (mapping.name && columns.includes(mapping.name)) colNameSelect.value = mapping.name;
  if (mapping.period && columns.includes(mapping.period)) {
    colPeriodSelect.value = mapping.period;
  }
  if (mapping.nativeName && columns.includes(mapping.nativeName)) {
    colNativeSelect.value = mapping.nativeName;
  }
  if (mapping.group && columns.includes(mapping.group)) colGroupSelect.value = mapping.group;
  if (mapping.mark && columns.includes(mapping.mark)) colMarkSelect.value = mapping.mark;
  if (mapping.deathReason && columns.includes(mapping.deathReason)) {
    colDeathSelect.value = mapping.deathReason;
  }
}

function syncCustomColumns(sourceText, filename, { detectFormat = false } = {}) {
  state.customFileText = sourceText;
  state.customFilename = filename;
  state.formPresetId = null;
  if (detectFormat) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".csv")) formatSelect.value = "csv";
    else if (lower.endsWith(".tsv")) formatSelect.value = "tsv";
  }
  state.customColumns = listColumns(sourceText, { format: formatSelect.value });
  populateColumnSelects(state.customColumns);
  if (!customTitleInput.value.trim()) {
    customTitleInput.value = `${filename} (custom)`;
  }
  customFileNameEl.textContent = filename;
  updatePresetSelection();
}

async function fillFormFromPreset(datasetId) {
  const dataset = DATASETS[datasetId];
  if (!dataset) return;
  clearCustomError();
  const text = await loadTsv(dataset);
  const filename = filenameFromUrl(dataset.url);
  formatSelect.value = dataset.format ?? "tsv";
  state.customFileText = text;
  state.customFilename = filename;
  state.formPresetId = datasetId;
  state.customColumns = listColumns(text, { format: formatSelect.value });
  populateColumnSelects(state.customColumns, dataset.columns);
  customTitleInput.value = dataset.title;
  customSourcesInput.value = dataset.sources;
  customAuthorInput.value = dataset.author;
  customFileNameEl.textContent = filename;
  updatePresetSelection();
}

function copyRulerName(name) {
  if (!name) return;
  const write = navigator.clipboard?.writeText?.(name);
  if (write) {
    write.catch(() => {});
  }
  const copiedText = `Copied ${name}`;
  tooltip.setReadout(copiedText);
  if (copiedReadoutTimer) clearTimeout(copiedReadoutTimer);
  copiedReadoutTimer = setTimeout(() => {
    if (readoutEl.textContent === copiedText) {
      tooltip.setReadout("");
    }
    copiedReadoutTimer = null;
  }, COPIED_READOUT_MS);
}

function selectRuler(rulerId) {
  state.selectedId = state.selectedId === rulerId ? null : rulerId;
  setActiveRuler(svg, state.selectedId);
  setLegendSelection(legendEl, state.selectedId);
  if (state.selectedId == null) return;
  const ruler = state.byId.get(state.selectedId);
  if (ruler) copyRulerName(ruler.name);
}

function clearSelection() {
  if (state.selectedId == null) return;
  state.selectedId = null;
  setActiveRuler(svg, null);
  setLegendSelection(legendEl, null);
}

themeBtn.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  applyTheme();
  renderPalettePreview();
  paint();
});

presetControlsEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-dataset]");
  if (!btn) return;
  const id = btn.dataset.dataset;
  if (!id) return;
  clearCustomError();
  showDataset(id)
    .then(() => {
      customPanelEl.hidden = true;
      uploadOpenBtn.setAttribute("aria-expanded", "false");
    })
    .catch((err) => {
      showCustomError(err.message);
    });
});

uploadInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    clearCustomError();
    const text = await file.text();
    syncCustomColumns(text, file.name, { detectFormat: true });
    const setupToggle = customPanelEl.querySelector("#dataset-setup-toggle");
    if (setupToggle) setSectionOpen(setupToggle, true);
  } catch (err) {
    showCustomError(err.message);
  } finally {
    uploadInput.value = "";
  }
});

formatSelect.addEventListener("change", () => {
  if (!state.customFileText) return;
  const mapping = state.formPresetId ? DATASETS[state.formPresetId]?.columns : {};
  state.customColumns = listColumns(state.customFileText, { format: formatSelect.value });
  populateColumnSelects(state.customColumns, mapping);
});

paletteSelect.addEventListener("change", () => {
  renderPalettePreview();
  if (state.datasetId === CUSTOM_DATASET_ID) {
    state.customPalettePreset = paletteSelect.value;
    paint();
  }
});

uploadOpenBtn.addEventListener("click", () => {
  const expanded = uploadOpenBtn.getAttribute("aria-expanded") === "true";
  uploadOpenBtn.setAttribute("aria-expanded", expanded ? "false" : "true");
  customPanelEl.hidden = expanded;
  if (!expanded) {
    collapseCustomSections();
    paletteSelect.value = state.customPalettePreset;
    renderPalettePreview();
    const presetId =
      state.formPresetId ?? (state.datasetId !== CUSTOM_DATASET_ID ? state.datasetId : null);
    if (presetId && DATASETS[presetId]) {
      fillFormFromPreset(presetId).catch((err) => {
        showCustomError(err.message);
      });
    } else if (state.customFileText) {
      customTitleInput.value = state.customTitle;
      customSourcesInput.value = state.customSources;
      customAuthorInput.value = state.customAuthor;
      customFileNameEl.textContent = state.customFilename || "Local file";
      populateColumnSelects(state.customColumns);
    }
  }
});

applyCustomBtn.addEventListener("click", () => {
  try {
    clearCustomError();
    if (!state.customFileText) {
      throw new Error("Upload a TSV/CSV file first.");
    }
    if (!colNameSelect.value || !colPeriodSelect.value) {
      throw new Error("Ruler name and Reign period columns are required.");
    }
    showCustomDataset(state.customFileText, state.customFilename || "Local file");
    customPanelEl.hidden = true;
    uploadOpenBtn.setAttribute("aria-expanded", "false");
  } catch (err) {
    showCustomError(err.message);
  }
});

legendEl.addEventListener("click", (event) => {
  const btn = event.target.closest(".legend-item");
  if (!btn) return;
  selectRuler(Number(btn.dataset.rulerId));
});

legendEl.addEventListener("pointerover", (event) => {
  const btn = event.target.closest(".legend-item");
  if (!btn || state.selectedId != null) return;
  setActiveRuler(svg, Number(btn.dataset.rulerId));
});

legendEl.addEventListener("pointerout", (event) => {
  if (event.target.closest(".legend-item") && state.selectedId == null) {
    setActiveRuler(svg, null);
  }
});

svg.addEventListener("pointermove", (event) => {
  const at = yearAtPoint(svg, event.clientX, event.clientY, state.nRows);
  if (!at || !state.occupancy) {
    tooltip.hide();
    setHoverColumn(state.hoverCol, null);
    return;
  }
  const year = (state.occupancy.firstRow + at.row) * 100 + at.col;
  const people = rulersInCell(at.row, at.col);
  setHoverColumn(state.hoverCol, at.col);
  tooltip.show(yearTooltipHtml(year, people), event.clientX, event.clientY);
  tooltip.setReadout(yearReadout(year, people));
});

svg.addEventListener("pointerleave", () => {
  tooltip.hide();
  setHoverColumn(state.hoverCol, null);
  tooltip.setReadout("");
});

svg.addEventListener("click", (event) => {
  const tile = event.target.closest?.(".tile");
  if (tile) {
    selectRuler(Number(tile.getAttribute("data-ruler-id")));
    return;
  }
  const at = yearAtPoint(svg, event.clientX, event.clientY, state.nRows);
  if (at) {
    const people = rulersInCell(at.row, at.col);
    if (people.length === 1) {
      selectRuler(people[0].rulerId);
      return;
    }
  }
  clearSelection();
});

document.addEventListener("click", (event) => {
  closeFieldTips();
  if (event.target.closest("#chart, .legend-item, #theme-toggle, [data-dataset], .export-tools")) return;
  clearSelection();
});

try {
  await loadPresetManifest();
  state.datasetId = initialDatasetId();
  renderPresetButtons();
  bindFieldTips(customPanelEl);
  bindSectionToggles(customPanelEl);
  initPaletteSelect();
  applyTheme();
  initExport();
  await showDataset(state.datasetId);
} catch (err) {
  errorEl.hidden = false;
  errorEl.textContent = err.message;
}
