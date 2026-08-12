import type { MediaItem, SearchMode } from "./types";

type SearchField = "name" | "tag" | "folder" | "site" | "type" | "color";

type SearchToken = {
  value: string;
  exclude: boolean;
  field?: SearchField;
};

type PreparedToken = SearchToken & {
  compact: string;
};

type WeightedField = {
  field: SearchField;
  value: string;
  compact: string;
  words: string[];
  weight: number;
};

type CachedFields = {
  folderName: string;
  normal: WeightedField[];
  smart: WeightedField[];
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

const SEARCH_FIELD_CACHE = new WeakMap<MediaItem, CachedFields>();

export function searchMedia(
  items: MediaItem[],
  query: string,
  mode: SearchMode,
  folderNames = new Map<string, string>(),
) {
  const parsedTokens = parseSearchQuery(query);
  if (!parsedTokens.length) return items;

  const tokens: PreparedToken[] = parsedTokens.map((token) => ({
    ...token,
    compact: token.value.replace(/ /g, ""),
  }));
  const wholeQuery = normalize(tokens.filter((token) => !token.exclude && !token.field).map((token) => token.value).join(" "));
  const results: Array<{ item: MediaItem; index: number; score: number }> = [];

  items.forEach((item, index) => {
    const score = scoreItem(item, tokens, wholeQuery, mode, folderNames);
    if (score >= 0) results.push({ item, index, score });
  });

  results.sort((a, b) => b.score - a.score || a.index - b.index);
  return results.map(({ item }) => item);
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
  tokens: PreparedToken[],
  wholeQuery: string,
  mode: SearchMode,
  folderNames: Map<string, string>,
) {
  const fields = getFields(item, mode, folderNames);
  let total = 0;

  for (const token of tokens) {
    let best = 0;
    for (const field of fields) {
      if (token.field && field.field !== token.field) continue;
      best = Math.max(best, matchScore(field, token.value, token.compact) * field.weight);
    }

    if (token.exclude) {
      if (best > 0) return -1;
      continue;
    }

    if (best === 0) return -1;
    total += best;
  }

  if (wholeQuery && fields[0]?.value.includes(wholeQuery)) total += 24;
  return total;
}

function getFields(item: MediaItem, mode: SearchMode, folderNames: Map<string, string>) {
  const folderName = folderNames.get(item.folderId) ?? "";
  const cached = SEARCH_FIELD_CACHE.get(item);
  if (cached?.folderName === folderName) return mode === "smart" ? cached.smart : cached.normal;

  const fields: WeightedField[] = [
    createField("name", item.name, 10),
    createField("tag", item.tags.join(" "), 9),
    createField("folder", folderName, 6),
    createField("site", [item.sourceTitle, item.sourcePageTitle, item.sourceSiteName, item.sourceDescription, hostname(item.sourceLinkUrl), hostname(item.sourcePageUrl), hostname(item.sourceCanonicalUrl), hostname(item.sourceFinalUrl), hostname(item.sourceUrl)].filter(Boolean).join(" "), 7),
    createField("type", [item.kind, item.captureType, item.extension].filter(Boolean).join(" "), 5),
  ];

  const smart = [
    ...fields,
    createField("color", [...item.colorNames, ...item.dominantColors].join(" "), 7),
    createField("name", item.path, 2),
    createField("site", [item.sourceDescription, item.sourceLinkUrl, item.sourcePageUrl, item.sourceCanonicalUrl, item.sourceFinalUrl, item.sourceUrl].filter(Boolean).join(" "), 4),
  ];

  SEARCH_FIELD_CACHE.set(item, { folderName, normal: fields, smart });
  return mode === "smart" ? smart : fields;
}

function createField(field: SearchField, value: string, weight: number): WeightedField {
  const normalized = normalize(value);
  return {
    field,
    value: normalized,
    compact: normalized.replace(/ /g, ""),
    words: normalized.split(" "),
    weight,
  };
}

function matchScore(haystack: WeightedField, needle: string, compactNeedle: string) {
  const { value, compact, words } = haystack;
  if (!value || !needle) return 0;
  if (value === needle) return 12;
  if (compact === compactNeedle) return 11;
  if (words.includes(needle)) return 10;
  if (words.some((word) => word.startsWith(needle))) return 7;
  if (value.includes(needle)) return 5;
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
