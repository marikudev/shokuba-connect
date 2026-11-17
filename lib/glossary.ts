import glossaryFileData from "@/data/glossary/anzen.json";
import { LANGUAGE_CODES, type LanguageCode } from "@/lib/languages";

// Glossary loading, schema validation, and prompt-line selection
// (PRD section 10). Server-side only: the glossary file is read
// from disk here and its lines reach the LLM through lib/prompt.ts.
// The `note`, `reading`, `domain`, and `status` fields are NEVER part
// of a prompt line (SEC-09); only ja, the style marker, the target
// language columns, and meaning are.

export type GlossaryStyle = "term" | "explain";
export type GlossaryStatus = "draft" | "verified";

export interface GlossaryEntry {
  ja: string;
  reading?: string;
  domain?: string;
  style: GlossaryStyle;
  meaning?: string;
  note?: string;
  id?: string;
  my?: string;
  pt?: string;
  en?: string;
  vi?: string;
  // fil and zh joined in; the parser and the schema's
  // allowed keys iterate LANGUAGE_CODES dynamically, so these two
  // fields are the only glossary change a new language needs here.
  fil?: string;
  zh?: string;
  status: GlossaryStatus;
}

export const GLOSSARY_MAX_ENTRIES = 30;
// The budget counts the full prompt text: ja, the language columns,
// the [EXPLAIN] marker, the meaning suffix, separators, and the
// newlines between lines.
export const GLOSSARY_MAX_CHARS = 2500;
export const EXPLAIN_MAX_WORDS = 10;
// Code-point bound for the languages whose writing has no
// word spaces: Burmese (my) and Simplified Chinese (zh).
export const EXPLAIN_MAX_NOSPACE_CODE_POINTS = 90;

// The language columns come from lib/languages.ts — the single
// definition of the language codes — so adding a language
// there extends this schema automatically instead of being
// silently rejected here.
const ALLOWED_KEYS = new Set<string>([
  "ja",
  "reading",
  "domain",
  "style",
  "meaning",
  "note",
  ...LANGUAGE_CODES,
  "status",
]);

export class GlossarySchemaError extends Error {}

function fail(message: string): never {
  throw new GlossarySchemaError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  where: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    fail(`${where}: "${key}" must be a string`);
  }
  return value;
}

function codePointLength(text: string): number {
  return Array.from(text).length;
}

// Validates one entry against the section 10 schema. Unknown keys,
// empty or duplicate ja, bad enums, a verified entry without meaning
// or without any translation, and malformed explain texts all fail.
function parseEntry(raw: unknown, index: number): GlossaryEntry {
  const where = `terms[${index}]`;
  if (!isRecord(raw)) {
    fail(`${where}: entry must be an object`);
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) {
      fail(`${where}: unknown key "${key}"`);
    }
  }
  const ja = raw.ja;
  if (typeof ja !== "string" || ja.length === 0) {
    fail(`${where}: "ja" must be a non-empty string`);
  }
  if (raw.style !== "term" && raw.style !== "explain") {
    fail(`${where}: "style" must be "term" or "explain"`);
  }
  if (raw.status !== "draft" && raw.status !== "verified") {
    fail(`${where}: "status" must be "draft" or "verified"`);
  }
  const entry: GlossaryEntry = {
    ja,
    style: raw.style,
    status: raw.status,
  };
  entry.reading = optionalString(raw, "reading", where);
  entry.domain = optionalString(raw, "domain", where);
  entry.meaning = optionalString(raw, "meaning", where);
  entry.note = optionalString(raw, "note", where);
  for (const code of LANGUAGE_CODES) {
    const value = optionalString(raw, code, where);
    if (value !== undefined) {
      entry[code] = value;
    }
  }

  const filledCodes = LANGUAGE_CODES.filter((code) => isFilled(entry[code]));
  if (entry.status === "verified") {
    if (!isFilled(entry.meaning)) {
      fail(`${where}: a verified entry requires "meaning"`);
    }
    if (filledCodes.length === 0) {
      fail(`${where}: a verified entry requires at least one translation`);
    }
  }
  if (entry.style === "explain") {
    for (const code of filledCodes) {
      validateExplain(entry, code, where);
    }
  }
  return entry;
}

function isFilled(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

// An explain column must read "{ja} ({explanation})". The explanation
// is at most 10 space-separated words for id/pt/en/vi/fil and at most
// 90 code points for my and zh, whose writing has no word spaces
// (section 10; the Myanmar bound is a proposal, V-09; the Chinese
// bound follows it since.
function validateExplain(
  entry: GlossaryEntry,
  code: LanguageCode,
  where: string,
): void {
  const value = entry[code];
  if (!isFilled(value)) {
    return;
  }
  const prefix = `${entry.ja} (`;
  if (!value.startsWith(prefix) || !value.endsWith(")")) {
    fail(
      `${where}: explain column "${code}" must have the form "{ja} (explanation)"`,
    );
  }
  const explanation = value.slice(prefix.length, -1);
  if (code === "my" || code === "zh") {
    if (codePointLength(explanation) > EXPLAIN_MAX_NOSPACE_CODE_POINTS) {
      fail(
        `${where}: explain column "${code}" exceeds ${EXPLAIN_MAX_NOSPACE_CODE_POINTS} code points`,
      );
    }
  } else {
    const words = explanation.split(/\s+/).filter(Boolean).length;
    if (words > EXPLAIN_MAX_WORDS) {
      fail(
        `${where}: explain column "${code}" exceeds ${EXPLAIN_MAX_WORDS} words`,
      );
    }
  }
}

// Parses and validates a whole glossary file body. Throws
// GlossarySchemaError on the first problem found.
export function parseGlossaryData(data: unknown): GlossaryEntry[] {
  if (!isRecord(data) || !Array.isArray(data.terms)) {
    fail('glossary file must be an object with a "terms" array');
  }
  const entries = data.terms.map((raw, index) => parseEntry(raw, index));
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.ja)) {
      fail(`duplicate "ja": ${entry.ja}`);
    }
    seen.add(entry.ja);
  }
  return entries;
}

// Loads the production glossary, once per server process. The file is
// a static import, so it is bundled with the server code: editing
// data/glossary/anzen.json in the repository takes effect on
// the next deploy — no runtime file path to go wrong. A schema
// error yields an empty glossary so the app
// keeps running; the schema itself is enforced by the test
// suite through parseGlossaryData.
let cachedTerms: GlossaryEntry[] | null = null;

export function loadGlossaryTerms(): GlossaryEntry[] {
  if (cachedTerms !== null) {
    return cachedTerms;
  }
  try {
    cachedTerms = parseGlossaryData(glossaryFileData);
  } catch {
    cachedTerms = [];
  }
  return cachedTerms;
}

export interface GlossarySelection {
  lines: string[];
  skipped: number;
}

function buildLine(entry: GlossaryEntry, langs: LanguageCode[]): string {
  const parts: string[] = [];
  for (const code of langs) {
    const value = entry[code];
    if (isFilled(value)) {
      parts.push(`${code}: ${value}`);
    }
  }
  const marker = entry.style === "explain" ? "[EXPLAIN] " : "";
  return `${entry.ja} => ${marker}${parts.join(" | ")} [meaning: ${entry.meaning ?? ""}]`;
}

// Selects the glossary lines for one translate request (section 10):
// verified entries whose ja appears in the input text or the context
// fields (NFKC-normalized), longest term first, with at least one
// filled column among the requested languages. Entries that no longer
// fit the entry/character budget are counted as skipped.
export function selectGlossaryLines(
  terms: GlossaryEntry[],
  source: { text: string; division: string; topic: string },
  langs: LanguageCode[],
): GlossarySelection {
  const haystacks = [source.text, source.division, source.topic].map(
    (field) => field.normalize("NFKC"),
  );
  const candidates = terms.filter((entry) => {
    if (entry.status !== "verified") {
      return false;
    }
    if (!langs.some((code) => isFilled(entry[code]))) {
      return false;
    }
    const needle = entry.ja.normalize("NFKC");
    return haystacks.some((haystack) => haystack.includes(needle));
  });
  candidates.sort(
    (a, b) => codePointLength(b.ja) - codePointLength(a.ja),
  );

  const lines: string[] = [];
  let skipped = 0;
  let totalChars = 0;
  for (const entry of candidates) {
    const line = buildLine(entry, langs);
    const addedChars = codePointLength(line) + (lines.length > 0 ? 1 : 0);
    if (
      lines.length >= GLOSSARY_MAX_ENTRIES ||
      totalChars + addedChars > GLOSSARY_MAX_CHARS
    ) {
      skipped += 1;
      continue;
    }
    lines.push(line);
    totalChars += addedChars;
  }
  return { lines, skipped };
}
