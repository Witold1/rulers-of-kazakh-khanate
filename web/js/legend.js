/** Clickable legend grouped by the century the reign started. */

import { ordinalSuffix } from "./parse.js";

function appendLegendLabel(button, ruler) {
  const label = document.createElement("span");
  label.className = "legend-label";
  if (ruler.mark) {
    const mark = document.createElement("span");
    mark.className = "legend-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = ruler.mark;
    label.append(mark, document.createTextNode(` ${ruler.name} ${ruler.start}-${ruler.end}`));
  } else {
    label.textContent = `${ruler.name} ${ruler.start}-${ruler.end}`;
  }
  button.append(label);
}

export function renderLegend(container, rulers, colors, themeHeaderColor) {
  container.replaceChildren();
  const byCentury = new Map();
  for (const ruler of rulers) {
    const list = byCentury.get(ruler.startCentury) ?? [];
    list.push(ruler);
    byCentury.set(ruler.startCentury, list);
  }

  const centuries = [...byCentury.keys()].sort((a, b) => a - b);
  // One column per start-century, like `add_century_legend` in plot.py.
  container.style.setProperty("--legend-cols", String(centuries.length));
  for (const century of centuries) {
    const col = document.createElement("section");
    col.className = "legend-col";
    const heading = document.createElement("h3");
    heading.style.color = themeHeaderColor;
    heading.textContent = `${century}${ordinalSuffix(century)} century`;
    col.append(heading);

    const list = document.createElement("ul");
    for (const ruler of byCentury.get(century)) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "legend-item";
      button.dataset.rulerId = String(ruler.rulerId);
      const color = colors[ruler.rulerId - 1];
      button.dataset.color = color;
      button.style.color = color;
      appendLegendLabel(button, ruler);
      button.setAttribute("aria-pressed", "false");
      item.append(button);
      list.append(item);
    }
    col.append(list);
    container.append(col);
  }
}

export function setLegendSelection(container, rulerId) {
  for (const button of container.querySelectorAll(".legend-item")) {
    const match = Number(button.dataset.rulerId) === rulerId;
    button.classList.toggle("is-selected", match);
    button.setAttribute("aria-pressed", match ? "true" : "false");
  }
}
