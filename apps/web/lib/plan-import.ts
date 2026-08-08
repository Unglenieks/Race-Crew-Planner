import type { EventRecord } from "@/lib/events-api";

export type ImportIssue = {
  severity: "error" | "warning";
  field: string;
  message: string;
};

export type ImportConfidence = {
  date: number;
  time: number;
  place: number;
  description: number;
  personnel: number;
  movementType: number;
  tags: number;
};

export type ParsedImportRow = {
  sourcePage?: number;
  sourceRow: number;
  rawValues: Record<string, string>;
  operationalDay?: string;
  normalizedDate?: string;
  normalizedTime?: string;
  normalizedEndTime?: string;
  placeText?: string;
  proposedVenueId?: string;
  description: string;
  rawPersonnel?: string;
  resolvedAssignments: string[];
  proposedMovementType:
    "exact" | "approximate" | "range" | "allDay" | "unspecified";
  proposedTags: string[];
  fieldConfidence: ImportConfidence;
  issues: ImportIssue[];
  warningsAccepted: boolean;
};

export type ParsedImport = {
  rows: ParsedImportRow[];
  detectedSections: string[];
};

type SourceRow = Record<string, string>;

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const nonScheduleSections = new Set([
  "Venues",
  "Contacts",
  "Grocery",
  "Fuel",
  "Auto Parts",
  "Tire Shops",
  "Weather",
]);

function clean(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function key(row: Record<string, string>, candidates: string[]) {
  const normalized = new Map(
    Object.entries(row).map(([name, value]) => [
      name.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""),
      value,
    ]),
  );
  for (const candidate of candidates) {
    const value = normalized.get(candidate);
    if (value !== undefined) return clean(value);
  }
  return "";
}

function addDays(date: string, amount: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

function dateValue(value: string) {
  const normalized = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match === null) return undefined;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  const date = `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? undefined : date;
}

function timeValue(value: string) {
  const approximate = /^\s*~/.test(value);
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 3 || digits.length > 4) return undefined;
  const padded = digits.padStart(4, "0");
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2));
  if (minute > 59 || hour > 24 || (hour === 24 && minute !== 0))
    return undefined;
  return {
    value: hour === 24 ? "00:00" : `${padded.slice(0, 2)}:${padded.slice(2)}`,
    approximate,
    nextDay: hour === 24,
  };
}

function rawMinutes(value: string) {
  const digits = value.replace(/[^0-9]/g, "").padStart(4, "0");
  if (digits.length !== 4) return undefined;
  return Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2));
}

function normalizedName(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function proposedVenue(place: string, records: EventRecord[]) {
  if (place.length === 0) return undefined;
  const target = normalizedName(place);
  return records.find((record) => normalizedName(record.name) === target)?._id;
}

function resolvedPersonnel(personnel: string, records: EventRecord[]) {
  if (personnel.length === 0 || personnel === "-") return [];
  const target = normalizedName(personnel);
  return records
    .filter((record) => record.type === "person")
    .filter((record) => normalizedName(record.name) === target)
    .map((record) => record.name);
}

function makeRow(source: SourceRow, records: EventRecord[]): ParsedImportRow {
  const rawDate = key(source, ["date", "normalizeddate"]);
  const rawTime = key(source, ["time", "timein", "starttime", "scheduledfor"]);
  const rawEndTime = key(source, ["endtime", "timeout"]);
  const rawPlace = key(source, ["location", "place", "venue"]);
  const description = key(source, [
    "description",
    "title",
    "movement",
    "activity",
  ]);
  const personnel = key(source, ["personnel", "people", "crew", "assignee"]);
  const operationalDay = key(source, ["operationalday", "day"]);
  const requestedType = key(source, ["movementtype", "type"]);
  const rawTags = key(source, ["tags", "tag"]);
  const start = timeValue(rawTime);
  const end = timeValue(rawEndTime);
  const rawRange = rawTime.match(/(.+?)\s*-\s*(.+)/);
  const rangeEnd = rawRange === null ? end : timeValue(rawRange[2]);
  const rangeStart = rawRange === null ? start : timeValue(rawRange[1]);
  const normalizedDate = dateValue(rawDate);
  const placeText = rawPlace === "-" ? "" : rawPlace;
  const issues: ImportIssue[] = [];
  if (description.length === 0)
    issues.push({
      severity: "error",
      field: "description",
      message: "A movement description is required.",
    });
  if (normalizedDate === undefined)
    issues.push({
      severity: "error",
      field: "date",
      message: "A valid ISO date is required.",
    });
  if (rangeStart === undefined)
    issues.push({
      severity: "error",
      field: "time",
      message: "A valid start time is required.",
    });
  if (placeText.length === 0)
    issues.push({
      severity: "warning",
      field: "place",
      message:
        "No place was supplied; this movement will be imported without a location.",
    });
  const type =
    rangeEnd === undefined
      ? rangeStart?.approximate || requestedType === "approximate"
        ? "approximate"
        : requestedType === "allDay"
          ? "allDay"
          : requestedType === "unspecified"
            ? "unspecified"
            : "exact"
      : "range";
  if (type === "range" && rangeEnd === undefined)
    issues.push({
      severity: "error",
      field: "time",
      message: "A range requires an end time.",
    });
  const tags = rawTags
    .split(",")
    .map((tag) => clean(tag))
    .filter(Boolean);
  return {
    sourcePage: source.__page === undefined ? undefined : Number(source.__page),
    sourceRow: Number(source.__sourceRow),
    rawValues: Object.fromEntries(
      Object.entries(source).filter(([name]) => !name.startsWith("__")),
    ),
    operationalDay: operationalDay || undefined,
    normalizedDate,
    normalizedTime: rangeStart?.value,
    normalizedEndTime: rangeEnd?.value,
    placeText: placeText || undefined,
    proposedVenueId: proposedVenue(placeText, records),
    description,
    rawPersonnel: personnel && personnel !== "-" ? personnel : undefined,
    resolvedAssignments: resolvedPersonnel(personnel, records),
    proposedMovementType: type,
    proposedTags: tags,
    fieldConfidence: {
      date: normalizedDate === undefined ? 0 : 100,
      time: rangeStart === undefined ? 0 : rangeStart.approximate ? 70 : 100,
      place:
        placeText.length === 0
          ? 0
          : proposedVenue(placeText, records)
            ? 100
            : 65,
      description: description.length === 0 ? 0 : 100,
      personnel:
        personnel.length === 0 || personnel === "-"
          ? 100
          : resolvedPersonnel(personnel, records).length > 0
            ? 100
            : 55,
      movementType: rangeEnd === undefined ? 85 : 100,
      tags: tags.length === 0 ? 100 : 90,
    },
    issues,
    warningsAccepted: false,
  };
}

export function parseDelimited(text: string, delimiter = ",") {
  const rows: string[][] = [[]];
  let quoted = false;
  let value = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      rows.at(-1)?.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      rows.at(-1)?.push(value);
      value = "";
      rows.push([]);
    } else {
      value += character;
    }
  }
  rows.at(-1)?.push(value);
  return rows.filter((row) => row.some((cell) => clean(cell).length > 0));
}

export function stageTabularRows(
  matrix: string[][],
  records: EventRecord[],
): ParsedImport {
  const [headers = [], ...values] = matrix;
  const rows = values.map((cells, index) =>
    makeRow(
      Object.fromEntries([
        ...headers.map((header, cell) => [header, cells[cell] ?? ""]),
        ["__sourceRow", String(index + 2)],
      ]),
      records,
    ),
  );
  return { rows, detectedSections: [] };
}

function dateForWeekday(day: string, rangeStart?: string) {
  if (rangeStart === undefined) return undefined;
  const wanted = weekdays.indexOf(day);
  if (wanted < 0) return undefined;
  const initial = new Date(`${rangeStart}T00:00:00Z`);
  const difference = wanted - initial.getUTCDay();
  return addDays(rangeStart, difference);
}

function documentRange(lines: string[]) {
  const match = lines
    .join(" ")
    .match(/([A-Za-z]+)\s*\/\s*(\d{1,2})\s*-\s*\d{1,2}\s*\/\s*(\d{4})/);
  if (match === null) return undefined;
  const month = new Date(`${match[1]} 1, ${match[3]} UTC`).getUTCMonth() + 1;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

type PositionedText = { str: string; x: number; y: number };

function linesFromPage(items: PositionedText[]) {
  const lines = new Map<number, PositionedText[]>();
  for (const item of items) {
    const y = Math.round(item.y / 3) * 3;
    lines.set(y, [...(lines.get(y) ?? []), item]);
  }
  return [...lines.entries()]
    .sort(([left], [right]) => right - left)
    .map(([, line]) => line.sort((left, right) => left.x - right.x));
}

/** Extracts only schedule table rows from a text-layer PDF; it never invokes OCR. */
export async function parseSchedulePdf(
  file: File,
  records: EventRecord[],
): Promise<ParsedImport> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;
  const pageLines: Array<{ page: number; lines: PositionedText[][] }> = [];
  const allText: string[] = [];
  for (let page = 1; page <= pdf.numPages; page += 1) {
    const content = await (await pdf.getPage(page)).getTextContent();
    const items: PositionedText[] = content.items.flatMap((item) => {
      if (!("str" in item)) return [];
      const text = item as unknown as { str: string; transform: number[] };
      return [{ str: text.str, x: text.transform[4], y: text.transform[5] }];
    });
    allText.push(...items.map((item) => item.str));
    pageLines.push({ page, lines: linesFromPage(items) });
  }
  const rangeStart = documentRange(allText);
  const detected = new Set<string>();
  let day: string | undefined;
  let headers: number[] | undefined;
  let dayOffset = 0;
  let previousMinutes: number | undefined;
  const source: SourceRow[] = [];
  for (const { page, lines } of pageLines) {
    for (const line of lines) {
      const text = clean(line.map((item) => item.str).join(" "));
      if (nonScheduleSections.has(text)) detected.add(text);
      const heading = text.match(
        new RegExp(`^(${weekdays.join("|")}) Schedule$`),
      );
      if (heading !== null) {
        day = heading[1];
        headers = undefined;
        dayOffset = 0;
        previousMinutes = undefined;
        continue;
      }
      if (day === undefined) continue;
      if (/Time In.*Location.*Description.*Personnel/i.test(text)) {
        const starts = ["time", "location", "description", "personnel"].map(
          (label) =>
            line.find((item) => item.str.toLocaleLowerCase().startsWith(label))
              ?.x,
        );
        headers = starts.every((start) => start !== undefined)
          ? (starts as number[])
          : undefined;
        continue;
      }
      const time = text.match(/^~?\d{3,4}(?:\s*-\s*\d{3,4})?\b/);
      if (time === null || headers === undefined || headers.length < 3)
        continue;
      const columns = ["", "", "", ""];
      for (const item of line) {
        const index = headers.findLastIndex((start) => item.x >= start - 8);
        if (index >= 0 && index < columns.length)
          columns[index] += `${columns[index] ? " " : ""}${item.str}`;
      }
      const start = timeValue(columns[0]);
      const rowDate = dateForWeekday(day, rangeStart);
      const minutes = rawMinutes(columns[0]);
      if (
        minutes !== undefined &&
        previousMinutes !== undefined &&
        minutes < previousMinutes &&
        previousMinutes < 24 * 60
      ) {
        dayOffset += 1;
      }
      if (start?.nextDay) dayOffset += 1;
      if (minutes !== undefined) previousMinutes = minutes;
      source.push({
        __page: String(page),
        __sourceRow: String(source.length + 1),
        "Operational day": rowDate ?? "",
        Date: rowDate === undefined ? "" : addDays(rowDate, dayOffset),
        "Time in": columns[0],
        Location: clean(columns[1]),
        Description: clean(columns[2]),
        Personnel: clean(columns[3]),
      });
    }
  }
  return {
    rows: source.map((row) => makeRow(row, records)),
    detectedSections: [...detected],
  };
}

export async function parseSpreadsheet(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (sheet === undefined) return [];
  return XLSX.utils
    .sheet_to_json<string[]>(sheet, { header: 1, defval: "" })
    .map((row) => row.map(String));
}
