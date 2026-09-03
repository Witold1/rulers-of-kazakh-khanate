import { formatYear, formatYearRange } from "./parse.js";

/** Pointer tooltip + a text readout for keyboard / screen readers. */

export function bindTooltip(tooltipEl, readoutEl) {
  function hide() {
    tooltipEl.hidden = true;
    tooltipEl.innerHTML = "";
  }

  function show(html, clientX, clientY) {
    tooltipEl.hidden = false;
    tooltipEl.innerHTML = html;
    const pad = 12;
    const { innerWidth, innerHeight } = window;
    const rect = tooltipEl.getBoundingClientRect();
    let left = clientX + pad;
    let top = clientY + pad;
    if (left + rect.width > innerWidth - 8) left = clientX - rect.width - pad;
    if (top + rect.height > innerHeight - 8) top = clientY - rect.height - pad;
    tooltipEl.style.left = `${Math.max(8, left)}px`;
    tooltipEl.style.top = `${Math.max(8, top)}px`;
  }

  function setReadout(text) {
    readoutEl.textContent = text;
  }

  return { show, hide, setReadout };
}

export function yearTooltipHtml(year, rulers) {
  if (!rulers.length) {
    return `<strong>${formatYear(year)}</strong><div class="tip-muted">No recorded reign</div>`;
  }
  const rows = rulers
    .map((r) => {
      const groupLine = [r.mark, r.group].filter(Boolean).join(" ");
      const extra = [
        r.nativeName
          ? `<span class="tip-native" dir="auto">${r.nativeName}</span>`
          : "",
        groupLine ? `<span class="tip-native" dir="auto">${groupLine}</span>` : "",
        r.deathReason
          ? `<span class="tip-native" dir="auto">${r.deathReason}</span>`
          : "",
      ].join("");
      return (
        `<div class="tip-row"><span class="tip-swatch" style="background:${r.color}"></span>` +
        `<span dir="auto">${r.name} ${formatYearRange(r.start, r.end)}</span>` +
        extra +
        `</div>`
      );
    })
    .join("");
  return `<strong>${formatYear(year)}</strong>${rows}`;
}

export function yearReadout(year, rulers) {
  if (year == null) return "";
  if (!rulers.length) return `${formatYear(year)} — no recorded reign`;
  return `${formatYear(year)} — ${rulers.map((r) => r.chartLabel).join(", ")}`;
}
