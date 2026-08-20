/** Parse a reign TSV into ruler records (port of `rulers_chart.data.parse_rulers`). */

export const EMPTY = 0;

/** Unicode prefixes on Name in the TSV: leftover category tags. */
export const NAME_MARKS = {
  "ᴭ": "Contested",
  "ᶬ": "Post-Tauke",
  "ᴶ": "Junior Juz",
  "ᴹ": "Middle Juz",
  "ᴮ": "Bokei Horde",
};

/** Dynasty column → same style of modifier letter as the Juz tags. */
export const DYNASTY_MARKS = {
  Rashidun: "ᴿ",
  "Праведные халифы": "ᴿ",
  "Umayyad (Damascus)": "ᵁ",
  Омейяды: "ᵁ",
  "Umayyad (Córdoba)": "ᴼ",
  "Abbasid (Baghdad)": "ᴬ",
  "Abbasid (Samarra)": "ᴬ",
  Аббасиды: "ᴬ",
  Fatimid: "ᶠ",
};

export function splitNameMark(rawName) {
  for (const mark of Object.keys(NAME_MARKS)) {
    if (rawName.startsWith(mark)) {
      return {
        mark,
        group: NAME_MARKS[mark],
        name: rawName.slice(mark.length).trim(),
      };
    }
  }
  return { mark: "", group: "", name: rawName };
}

export function markForDynasty(dynasty) {
  return DYNASTY_MARKS[dynasty] ?? "";
}

const PERIOD_SPLIT = /[–—-]/;
const PARENS = /[()]/g;

export function centuryFromYear(year) {
  return Math.floor(Number(year) / 100) + 1;
}

export function ordinalSuffix(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function splitRow(line, delimiter = "\t") {
  return line.split(delimiter).map((cell) => cell.trim());
}

function delimiterForFormat(format) {
  return format === "csv" ? "," : "\t";
}

function findColumn(header, pattern) {
  return header.findIndex((h) => pattern.test(h));
}

function findColumnByName(header, name) {
  if (!name) return -1;
  return header.findIndex((h) => h === name);
}

function cell(cols, index) {
  return index >= 0 ? (cols[index] ?? "").trim() : "";
}

function parsePeriod(period) {
  const [startText, endText] = period.split(PERIOD_SPLIT, 2);
  const start = Number.parseInt(startText, 10);
  let end;
  if (endText == null || endText.trim() === "") {
    end = start;
  } else if (/^present$/i.test(endText.trim())) {
    end = new Date().getFullYear();
  } else {
    end = Number.parseInt(endText, 10);
  }
  return { start, end };
}

/**
 * @param {string} source tabular text
 * @param {object} [options]
 * @param {"tsv"|"csv"} [options.format]
 * @returns {string[]}
 */
export function listColumns(source, options = {}) {
  const delimiter = delimiterForFormat(options.format ?? "tsv");
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 1) return [];
  return splitRow(lines[0], delimiter);
}

/**
 * @param {string} source tabular text
 * @param {object} [options]
 * @param {"tsv"|"csv"} [options.format]
 * @param {object} [options.columns]
 * @returns {object[]}
 */
export function parseRulers(source, options = {}) {
  const delimiter = delimiterForFormat(options.format ?? "tsv");
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const header = splitRow(lines[0], delimiter);
  const columns = options.columns ?? {};
  const iNameByChoice = findColumnByName(header, columns.name);
  const iPeriodByChoice = findColumnByName(header, columns.period);
  const iNativeByChoice = findColumnByName(header, columns.nativeName);
  const iGroupByChoice = findColumnByName(header, columns.group);
  const iDeathByChoice = findColumnByName(header, columns.deathReason);

  const iName = iNameByChoice >= 0 ? iNameByChoice : findColumn(header, /name|имя/i);
  const iPeriod =
    iPeriodByChoice >= 0 ? iPeriodByChoice : findColumn(header, /period|правлен|годы|years/i);
  const iNative =
    iNativeByChoice >= 0 ? iNativeByChoice : findColumn(header, /kazakh|native|arabic/i);
  const iGroup = iGroupByChoice >= 0 ? iGroupByChoice : findColumn(header, /dynast|династ|^group$/i);
  const iDeath = iDeathByChoice >= 0 ? iDeathByChoice : findColumn(header, /death|причин|note/i);

  const nameIdx = iName >= 0 ? iName : 0;
  const periodIdx = iPeriod >= 0 ? iPeriod : 1;

  const rows = [];
  for (const line of lines.slice(1)) {
    const cols = splitRow(line, delimiter);
    const rawName = cell(cols, nameIdx);
    const { start, end } = parsePeriod(cell(cols, periodIdx));
    if (!rawName || Number.isNaN(start) || Number.isNaN(end)) continue;

    const { mark: nameMark, group: markGroup, name } = splitNameMark(
      rawName.replace(PARENS, ""),
    );
    const dynasty = cell(cols, iGroup);
    const mark = nameMark || markForDynasty(dynasty);
    rows.push({
      rawName,
      mark,
      group: markGroup || dynasty,
      name,
      nativeName: cell(cols, iNative),
      deathReason: cell(cols, iDeath),
      start,
      end,
      startCentury: centuryFromYear(start),
      endCentury: centuryFromYear(end),
      chartLabel: `${mark}${name} ${start}-${end}`,
    });
  }

  rows.sort((a, b) => a.start - b.start);
  return rows.map((row, index) => ({
    ...row,
    rulerId: index + 1,
  }));
}
