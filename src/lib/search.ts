import type { MediaItem } from "./types";

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
  fields: WeightedField[];
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

// Saved-article bodies can be huge; only their opening is worth indexing.
const MARKDOWN_INDEX_LIMIT = 20_000;

const COVERAGE_BONUS = 40;

const SEARCH_FIELD_CACHE = new WeakMap<MediaItem, CachedFields>();

export function searchMedia(
  items: MediaItem[],
  query: string,
  folderNames = new Map<string, string>(),
) {
  const parsedTokens = parseSearchQuery(query);
  if (!parsedTokens.length) return items;

  const tokens: PreparedToken[] = parsedTokens.map((token) => ({
    ...token,
    compact: token.value.replace(/ /g, ""),
  }));
  const requiredTokens = tokens.filter((token) => !token.exclude);
  const wholeQuery = normalize(requiredTokens.map((token) => token.value).join(" "));
  const results: Array<{ item: MediaItem; index: number; score: number }> = [];

  items.forEach((item, index) => {
    const score = scoreItem(item, tokens, wholeQuery, folderNames);
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
  folderNames: Map<string, string>,
) {
  const fields = getFields(item, folderNames);
  let total = 0;
  let requiredTotal = 0;
  let requiredMatched = 0;

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

    requiredTotal += 1;
    if (best === 0) continue;
    requiredMatched += 1;
    total += best;
  }

  // Partial queries still rank: matching more of the query lifts an item far
  // above single-token matches, but no token ever hard-filters the result.
  if (!requiredMatched || !requiredTotal) return -1;
  total += (requiredMatched / requiredTotal) * COVERAGE_BONUS;

  if (requiredMatched === requiredTotal && wholeQuery && fields[0]?.value.includes(wholeQuery)) total += 24;
  return total;
}

function getFields(item: MediaItem, folderNames: Map<string, string>) {
  const folderName = folderNames.get(item.folderId) ?? "";
  const cached = SEARCH_FIELD_CACHE.get(item);
  if (cached?.folderName === folderName) return cached.fields;

  const fields: WeightedField[] = [
    createField("name", item.name, 10),
    createField("tag", item.tags.join(" "), 9),
    createField("site", [
      item.sourceTitle,
      item.sourcePageTitle,
      item.sourceSiteName,
      item.sourceByline,
      truncateForIndex(item.sourceDescription),
      truncateForIndex(item.sourceContentMarkdown),
      hostname(item.sourceLinkUrl),
      hostname(item.sourcePageUrl),
      hostname(item.sourceCanonicalUrl),
      hostname(item.sourceFinalUrl),
      hostname(item.sourceUrl),
    ].filter(Boolean).join(" "), 7),
    createField("color", [...item.colorNames, ...item.dominantColors].join(" "), 7),
    createField("folder", folderName, 6),
    createField("type", [item.kind, item.captureType, item.extension].filter(Boolean).join(" "), 5),
    createField("site", [item.sourceLinkUrl, item.sourcePageUrl, item.sourceCanonicalUrl, item.sourceFinalUrl, item.sourceUrl].filter(Boolean).join(" "), 4),
    createField("name", item.path, 2),
  ];

  SEARCH_FIELD_CACHE.set(item, { folderName, fields });
  return fields;
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
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;

  if (left.length === right.length) {
    const difference = firstDifference(left, right);
    if (difference < 0) return true;
    // An adjacent transposition ("koi"/"oki") counts as a single edit.
    if (
      difference + 1 < left.length
      && left[difference] === right[difference + 1]
      && left[difference + 1] === right[difference]
      && left.slice(difference + 2) === right.slice(difference + 2)
    ) return true;
    return left.slice(difference + 1) === right.slice(difference + 1);
  }

  const [longer, shorter] = left.length > right.length ? [left, right] : [right, left];
  const difference = firstDifference(longer, shorter);
  if (difference < 0) return true;
  return longer.slice(difference + 1) === shorter.slice(difference);
}

function firstDifference(left: string, right: string) {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return shared < Math.max(left.length, right.length) ? shared : -1;
}

function truncateForIndex(value?: string) {
  return value && value.length > MARKDOWN_INDEX_LIMIT ? value.slice(0, MARKDOWN_INDEX_LIMIT) : value || "";
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
