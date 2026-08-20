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
    return `<strong>${year}</strong><div class="tip-muted">No recorded reign</div>`;
  }
  const rows = rulers
    .map((r) => {
      const extra = [
        r.group ? `<span class="tip-native" dir="auto">${r.group}</span>` : "",
        r.nativeName
          ? `<span class="tip-native" dir="auto">${r.nativeName}</span>`
          : "",
        r.deathReason
          ? `<span class="tip-native" dir="auto">${r.deathReason}</span>`
          : "",
      ].join("");
      return (
        `<div class="tip-row"><span class="tip-swatch" style="background:${r.color}"></span>` +
        `<span>${r.mark}${r.name} ${r.start}–${r.end}</span>` +
        extra +
        `</div>`
      );
    })
    .join("");
  return `<strong>${year}</strong>${rows}`;
}

export function yearReadout(year, rulers) {
  if (year == null) return "";
  if (!rulers.length) return `${year} — no recorded reign`;
  return `${year} — ${rulers.map((r) => r.chartLabel).join(", ")}`;
}
