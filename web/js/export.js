/** Download the chart poster as .svg or .png (2×), matching rulers-lifetimes-and-reign-arcs. */

const EXPORT_FAIL = "Could not save PNG. Try SVG instead.";
/** Desktop poster width (matches rulers-lifetimes-and-reign-arcs). */
const EXPORT_WIDTH = 1180;
const EXPORT_PIXEL_RATIO = 2;
/** iOS Safari canvas area cap (~4096²). */
const CANVAS_MAX_AREA = 16777216;
const CANVAS_MAX_SIDE = 4096;

const DOWNLOAD_ICON =
  '<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M8 2v8.2M5.2 7.5 8 10.3l2.8-2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<path d="M3 12.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
  "</svg>";

let htmlToImage = null;
let legendSnapshot = null;

async function loadHtmlToImage() {
  if (htmlToImage) return htmlToImage;
  htmlToImage = await import("https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm");
  return htmlToImage;
}

function pageBackground() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--face").trim() || "#ffffff"
  );
}

function fileTimestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `-${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`
  );
}

function slugify(title) {
  const slug = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "rulers-chart";
}

function exportFilename(ext) {
  const title = document.querySelector("#chart-title")?.textContent?.trim() || "rulers-chart";
  return `${slugify(title)}-${fileTimestamp()}.${ext}`;
}

function isAppleTouch() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isSafariFamily() {
  const ua = navigator.userAgent;
  if (isAppleTouch()) return true;
  return /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua);
}

function exportPixelRatio(width, height) {
  const areaCap = Math.sqrt(CANVAS_MAX_AREA / Math.max(1, width * height));
  const sideCap = Math.min(CANVAS_MAX_SIDE / width, CANVAS_MAX_SIDE / height);
  return Math.max(1, Math.min(EXPORT_PIXEL_RATIO, areaCap, sideCap));
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const isBase64 = /;base64/i.test(header);
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  if (!isBase64) {
    return new Blob([decodeURIComponent(data)], { type: mime });
  }
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadViaAnchor(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * Prefer the system share sheet on iOS (download attributes are unreliable there);
 * otherwise trigger a normal file download.
 */
async function deliverFile(blob, filename) {
  const type = blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type });
  const url = URL.createObjectURL(blob);

  try {
    if (isAppleTouch() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }

    downloadViaAnchor(url, filename);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

/** Omit interactive chrome from the cloned tree. */
function exportFilter(node) {
  if (!(node instanceof Element)) return true;
  if (
    node.classList.contains("controls") ||
    node.classList.contains("export-tools") ||
    node.classList.contains("footer-export") ||
    node.id === "tooltip" ||
    node.id === "readout" ||
    node.id === "error" ||
    node.id === "custom-panel"
  ) {
    return false;
  }
  return true;
}

function lockExportRootType(doc) {
  const root = doc.documentElement;
  const body = doc.body;
  if (root) {
    root.style.fontSize = "16px";
    root.style.webkitTextSizeAdjust = "100%";
    root.style.textSizeAdjust = "100%";
  }
  if (body) {
    body.classList.add("is-exporting");
    body.style.fontSize = "18px";
    body.style.webkitTextSizeAdjust = "100%";
    body.style.textSizeAdjust = "100%";
    body.style.padding = "0";
  }
}

function styleLegendExportLine(el, source) {
  el.classList.remove("is-selected");
  const color = source.dataset.color || source.style.color;
  if (color) {
    el.style.setProperty("color", color, "important");
    el.style.setProperty("-webkit-text-fill-color", color, "important");
  }
  el.style.setProperty("display", "block", "important");
  el.style.setProperty("margin", "0", "important");
  el.style.setProperty("padding", "0", "important");
  el.style.setProperty("border", "0", "important");
  el.style.setProperty("min-height", "0", "important");
  el.style.setProperty("height", "auto", "important");
  el.style.setProperty("line-height", "1.15", "important");
  el.style.setProperty("opacity", "1", "important");
  el.style.setProperty("background", "transparent", "important");
  el.style.setProperty("appearance", "none", "important");
  el.style.setProperty("overflow-wrap", "break-word", "important");
  el.style.setProperty("word-break", "normal", "important");
  el.style.setProperty("box-sizing", "border-box", "important");
  for (const child of el.querySelectorAll(".legend-label, .legend-mark")) {
    child.style.setProperty("line-height", "1.15", "important");
    child.style.setProperty("margin", "0", "important");
    child.style.setProperty("padding", "0", "important");
  }
  for (const mark of el.querySelectorAll(".legend-mark")) {
    mark.style.setProperty("font-size", "0.72em", "important");
    mark.style.setProperty("vertical-align", "baseline", "important");
  }
}

/** Buttons and list wrappers often pick up extra block padding in foreignObject capture. */
function flattenLegendForExport(root) {
  root.querySelectorAll(".legend-col ul").forEach((list) => {
    list.style.setProperty("margin", "0", "important");
    list.style.setProperty("padding", "0", "important");
  });

  root.querySelectorAll(".legend-col li").forEach((li) => {
    const btn = li.querySelector(".legend-item");
    if (!btn) return;

    const span = document.createElement("span");
    span.className = "legend-item";
    span.innerHTML = btn.innerHTML;
    for (const [key, value] of Object.entries(btn.dataset)) {
      span.dataset[key] = value;
    }

    styleLegendExportLine(span, btn);
    li.replaceWith(span);
  });
}

function prepareLegendForExport() {
  const legend = document.querySelector("#legend");
  if (!legend) return;
  legendSnapshot = legend.innerHTML;
  flattenLegendForExport(legend);
}

function restoreLegendAfterExport() {
  const legend = document.querySelector("#legend");
  if (!legend || legendSnapshot == null) return;
  legend.innerHTML = legendSnapshot;
  legendSnapshot = null;
}

function prepareLiveExportDom() {
  document.querySelector(".page")?.classList.add("is-export-capture");
  document.querySelector("#chart")?.classList.remove("is-filtered");
  document.querySelectorAll(".ruler-tiles.is-active").forEach((el) => {
    el.classList.remove("is-active");
  });
  document.querySelectorAll(".hover-col").forEach((el) => {
    el.setAttribute("fill-opacity", "0");
  });
  const scroll = document.querySelector(".chart-scroll");
  if (scroll) scroll.style.overflow = "visible";
  prepareLegendForExport();
}

function restoreLiveExportDom() {
  restoreLegendAfterExport();
  document.querySelector(".page")?.classList.remove("is-export-capture");
  const scroll = document.querySelector(".chart-scroll");
  if (scroll) scroll.style.overflow = "";
}

async function withExportLayout(fn) {
  const tip = document.getElementById("tooltip");
  if (tip) tip.hidden = true;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  document.body.classList.add("is-exporting");
  lockExportRootType(document);
  window.scrollTo(0, 0);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    prepareLiveExportDom();
    return await fn();
  } finally {
    restoreLiveExportDom();
    document.body.classList.remove("is-exporting");
    document.documentElement.style.fontSize = "";
    document.documentElement.style.webkitTextSizeAdjust = "";
    document.documentElement.style.textSizeAdjust = "";
    document.body.style.fontSize = "";
    document.body.style.webkitTextSizeAdjust = "";
    document.body.style.textSizeAdjust = "";
    document.body.style.padding = "";
    window.scrollTo(scrollX, scrollY);
  }
}

function captureOptions(poster) {
  const width = EXPORT_WIDTH;
  const height = Math.ceil(poster.scrollHeight);
  const pixelRatio = exportPixelRatio(width, height);

  return {
    filter: exportFilter,
    width,
    height,
    pixelRatio,
    cacheBust: true,
    backgroundColor: pageBackground(),
    style: {
      margin: "0",
      transform: "none",
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: `${width}px`,
      overflow: "visible",
      fontSize: "18px",
      webkitTextSizeAdjust: "100%",
      textSizeAdjust: "100%",
    },
  };
}

/** Safari often returns a blank/partial canvas on the first pass. */
async function captureUntilStable(run, maxPasses = 3) {
  let best = await run();
  if (!isSafariFamily()) return best;

  for (let i = 1; i < maxPasses; i++) {
    const next = await run();
    const bestScore = typeof best === "string" ? best.length : best?.size || 0;
    const nextScore = typeof next === "string" ? next.length : next?.size || 0;
    if (nextScore > bestScore) best = next;
    if (nextScore === bestScore && nextScore > 1000) return best;
  }
  return best;
}

function exportRoot() {
  const poster = document.querySelector(".page");
  if (!poster) throw new Error("Chart page not found");
  return poster;
}

async function saveSvg() {
  const { toSvg } = await loadHtmlToImage();
  const dataUrl = await withExportLayout(async () => {
    const poster = exportRoot();
    const options = captureOptions(poster);
    return captureUntilStable(() => toSvg(poster, options));
  });
  await deliverFile(dataUrlToBlob(dataUrl), exportFilename("svg"));
}

async function savePng() {
  const { toBlob, toPng } = await loadHtmlToImage();
  const blob = await withExportLayout(async () => {
    const poster = exportRoot();
    const options = captureOptions(poster);

    if (typeof toBlob === "function") {
      const result = await captureUntilStable(() => toBlob(poster, options));
      if (result && result.size > 1000) return result;
    }

    const dataUrl = await captureUntilStable(() => toPng(poster, options));
    return dataUrlToBlob(dataUrl);
  });

  if (!blob || blob.size < 1000) throw new Error("Empty PNG capture");
  await deliverFile(blob, exportFilename("png"));
}

function makeExportTools() {
  const tools = document.createElement("div");
  tools.className = "export-tools";
  tools.id = "export-tools";
  tools.setAttribute("role", "group");
  tools.setAttribute("aria-label", "Download chart");

  const icon = document.createElement("span");
  icon.className = "export-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = DOWNLOAD_ICON;

  const prefix = document.createElement("span");
  prefix.className = "export-prefix";
  prefix.textContent = "Save image: ";

  const svgBtn = document.createElement("button");
  svgBtn.type = "button";
  svgBtn.textContent = "SVG";
  svgBtn.title = "Save SVG";
  svgBtn.setAttribute("aria-label", "Save SVG");
  svgBtn.addEventListener("click", async () => {
    svgBtn.disabled = true;
    try {
      await saveSvg();
    } catch (err) {
      console.error(err);
      alert("Could not save SVG. If you opened the file directly, try a local server so the page loads fully.");
    } finally {
      svgBtn.disabled = false;
    }
  });

  const sep = document.createElement("span");
  sep.className = "export-sep";
  sep.textContent = "/";
  sep.setAttribute("aria-hidden", "true");

  const pngBtn = document.createElement("button");
  pngBtn.type = "button";
  pngBtn.textContent = "PNG";
  pngBtn.title = "Save PNG";
  pngBtn.setAttribute("aria-label", "Save PNG");
  pngBtn.addEventListener("click", async () => {
    pngBtn.disabled = true;
    try {
      await savePng();
    } catch (err) {
      console.error(err);
      alert(EXPORT_FAIL);
    } finally {
      pngBtn.disabled = false;
    }
  });

  tools.append(icon, prefix, svgBtn, sep, pngBtn);
  return tools;
}

export function initExport() {
  const poster = document.querySelector(".page");
  if (!poster || poster.dataset.exportAttached === "1") return;

  const footer = poster.querySelector(".caption");
  const tools = makeExportTools();
  if (footer) {
    const line = document.createElement("p");
    line.className = "footer-export";
    line.append(tools);
    footer.append(line);
  } else {
    poster.append(tools);
  }
  poster.dataset.exportAttached = "1";
}
