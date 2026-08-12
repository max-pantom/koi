import type { MediaItem, SearchMode } from "./types";

type SearchField = "name" | "tag" | "folder" | "site" | "type" | "color";

type SearchToken = {
  value: string;
  exclude: boolean;
  field?: SearchField;
};

type WeightedField = {
  field: SearchField;
  value: string;
  weight: number;
};

const FIELD_ALIASES = new Map<string, SearchField>([
  ["name", "name"],
  ["tag", "tag"],
  ["tags", "tag"],
  ["folder", "folder"],
  ["site", "site"],
  ["source", "site"],
  ["type", "type"],
  ["kind", "type"],
  ["color", "color"],
  ["colour", "color"],
]);

export function searchMedia(
  items: MediaItem[],
  query: string,
  mode: SearchMode,
  folderNames = new Map<string, string>(),
) {
  const tokens = parseSearchQuery(query);
  if (!tokens.length) return items;

  return items
    .map((item, index) => ({ item, index, score: scoreItem(item, tokens, mode, folderNames) }))
    .filter((result) => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item);
}

export function parseSearchQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const matcher = /(-?)(?:([\p{L}\p{N}_-]+):)?(?:"([^"]+)"|(\S+))/gu;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(query)) !== null) {
    const value = normalize(match[3] ?? match[4] ?? "");
    if (!value) continue;
    const fieldName = match[2]?.toLowerCase();
    const field = fieldName ? FIELD_ALIASES.get(fieldName) : undefined;
    if (fieldName && !field) {
      tokens.push({ value: normalize(`${fieldName} ${value}`), exclude: match[1] === "-" });
      continue;
    }
    tokens.push({ value, exclude: match[1] === "-", field });
  }

  return tokens;
}

function scoreItem(
  item: MediaItem,
  tokens: SearchToken[],
  mode: SearchMode,
  folderNames: Map<string, string>,
) {
  const fields = buildFields(item, mode, folderNames);
  let total = 0;

  for (const token of tokens) {
    const candidates = token.field ? fields.filter((field) => field.field === token.field) : fields;
    const best = candidates.reduce(
      (score, field) => Math.max(score, matchScore(field.value, token.value) * field.weight),
      0,
    );

    if (token.exclude) {
      if (best > 0) return -1;
      continue;
    }

    if (best === 0) return -1;
    total += best;
  }

  const wholeQuery = normalize(tokens.filter((token) => !token.exclude && !token.field).map((token) => token.value).join(" "));
  if (wholeQuery && normalize(item.name).includes(wholeQuery)) total += 24;
  return total;
}

function buildFields(item: MediaItem, mode: SearchMode, folderNames: Map<string, string>): WeightedField[] {
  const fields: WeightedField[] = [
    { field: "name", value: normalize(item.name), weight: 10 },
    { field: "tag", value: normalize(item.tags.join(" ")), weight: 9 },
    { field: "folder", value: normalize(folderNames.get(item.folderId) ?? ""), weight: 6 },
    { field: "site", value: normalize([item.sourceTitle, item.sourceSiteName, hostname(item.sourcePageUrl), hostname(item.sourceUrl)].filter(Boolean).join(" ")), weight: 7 },
    { field: "type", value: normalize([item.kind, item.captureType, item.extension].filter(Boolean).join(" ")), weight: 5 },
  ];

  if (mode === "smart") {
    fields.push(
      { field: "color", value: normalize([...item.colorNames, ...item.dominantColors].join(" ")), weight: 7 },
      { field: "name", value: normalize(item.path), weight: 2 },
      { field: "site", value: normalize([item.sourcePageUrl, item.sourceUrl].filter(Boolean).join(" ")), weight: 4 },
    );
  }

  return fields;
}

function matchScore(haystack: string, needle: string) {
  if (!haystack || !needle) return 0;
  if (haystack === needle) return 12;
  if (haystack.replace(/\s/g, "") === needle.replace(/\s/g, "")) return 11;
  const words = haystack.split(" ");
  if (words.includes(needle)) return 10;
  if (words.some((word) => word.startsWith(needle))) return 7;
  if (haystack.includes(needle)) return 5;
  if (needle.length >= 4 && words.some((word) => oneEditAway(word, needle))) return 2;
  return 0;
}

function oneEditAway(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }

  return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hostname(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}
