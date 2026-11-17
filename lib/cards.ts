import { isLanguageCode, type LanguageCode } from "@/lib/languages";
import { isLlmModelId } from "@/lib/models";

// Card model, status derivation, and Web Storage persistence.
// The cards live in localStorage so prepared cards survive
// closing the tab or the browser; the input draft and the gate
// ack remain in sessionStorage (per-tab, per-session by design). All functions
// here are pure or take a Storage object, so they can be unit tested
// without a browser.

export const CARD_COUNT = 20;
export const MAX_CARD_TITLE_LENGTH = 20;

export const STORAGE_KEYS = {
  cards: "chourei:v1:cards",
  session: "chourei:v1:session",
  ack: "chourei:v1:ack",
  sessionStart: "chourei:v1:session-start",
} as const;

const STORAGE_PREFIX = "chourei:";

export interface CardSource {
  text: string;
  division: string;
  topic: string;
}

export interface CardData extends CardSource {
  title: string;
  // Translation results by language code. M2 has no translation yet, so
  // results stay empty until M3/M4 fill them; the status logic already
  // handles partial results, so those milestones do not change it.
  results: Partial<Record<LanguageCode, string>>;
  // The source exactly as it was when `results` were produced. Editing
  // the source afterwards is what makes a translated card stale.
  translatedSource: CardSource | null;
}

export type CardSlots = ReadonlyArray<CardData | null>;

export type CardStatus = "empty" | "saved" | "translated" | "stale";

export function createEmptyCards(): (CardData | null)[] {
  return Array.from({ length: CARD_COUNT }, () => null);
}

export function hasResults(card: CardData): boolean {
  return Object.keys(card.results).length > 0;
}

export function isSameSource(a: CardSource, b: CardSource): boolean {
  return (
    a.text === b.text && a.division === b.division && a.topic === b.topic
  );
}

// the status is derived from the stored data, never stored
// itself — and it judges ONLY the card's own stored
// fields. A card is storage (sentence + its translation, shown again
// at chourei without re-translating), so what the operator is
// currently typing in the editor must never change a card's badge:
// earlier, the active card dropped to stale as soon as the next
// sentence was typed, which made a safely stored translation look
// lost. "stale" now means the card's own stored source no longer
// matches the source its stored results were translated from (only
// possible for data saved by older builds; new saves are consistent
// by construction — see handleSaveCard in app/page.tsx).
export function deriveCardStatus(card: CardData | null): CardStatus {
  if (!card) {
    return "empty";
  }
  if (!hasResults(card)) {
    return "saved";
  }
  if (!card.translatedSource || !isSameSource(card, card.translatedSource)) {
    return "stale";
  }
  return "translated";
}

export function saveCard(
  cards: CardSlots,
  slotIndex: number,
  data: CardData,
): (CardData | null)[] {
  const next = [...cards];
  next[slotIndex] = data;
  return next;
}

export function clearCard(
  cards: CardSlots,
  slotIndex: number,
): (CardData | null)[] {
  const next = [...cards];
  next[slotIndex] = null;
  return next;
}

export function getCard(cards: CardSlots, slotIndex: number): CardData | null {
  return cards[slotIndex] ?? null;
}

// the session draft holds the input draft, the active slot, and
// the panel choices. The consent status lives under its own
// key (AckData below); the user's API key is never in web
// storage at all — it sits in the httpOnly cookie.
export type PanelCount = 1 | 2 | 3 | 4;

// A panel's language selection: one of the seven codes, or "" when
// the operator has not chosen a language for that panel yet
// .
export type PanelLangSelection = LanguageCode | "";

export type PanelLangs = [
  PanelLangSelection,
  PanelLangSelection,
  PanelLangSelection,
  PanelLangSelection,
];

// no language is chosen by default, and the panel count
// defaults to 2 (since ; it was 1 from );
// the operator picks the count (1–4) and each panel's language
// deliberately.
export const DEFAULT_PANEL_LANGS: PanelLangs = ["", "", "", ""];

export interface SessionDraft extends CardSource {
  activeSlot: number | null;
  panelCount: PanelCount;
  panelLangs: PanelLangs;
  // The LLM model choice: an allowlisted id
  // from lib/models.ts — or "" when the operator has not chosen one
  // yet .
  model: string;
  // The industry choice : "automotive" is the only
  // working industry; "" means the operator has not chosen yet —
  // the dropdown opens on 業種を選択 and every translate action
  // stays disabled until a real industry is picked, exactly like
  // the unselected model. Drafts stored by older builds carry no
  // industry field and parse as "" (not chosen).
  industry: string;
  // Display mode for the main screen: true hides the input
  // column (model picker, source text, translate/save buttons)
  // and leaves only the narrow card rail beside the panels, so
  // the big chourei monitor shows translations and card numbers
  // and nothing else. It is a per-tab draft preference like the
  // panel choices; drafts stored by older builds carry no such
  // field and parse as false (input column shown).
  sidebarHidden: boolean;
}

export const EMPTY_SESSION_DRAFT: SessionDraft = {
  text: "",
  division: "",
  topic: "",
  activeSlot: null,
  // Two panels by default .
  panelCount: 2,
  panelLangs: [...DEFAULT_PANEL_LANGS],
  model: "",
  industry: "",
  sidebarHidden: false,
};

// --- Serialization -----------------------------------------------------
// Stored data is never trusted: anything malformed falls back to empty,
// so a corrupted entry can never crash the app.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sanitizeSource(value: unknown): CardSource | null {
  // `text` is the one field a real card or draft always has; an entry
  // without a string text is treated as corruption, not as an empty card.
  if (!isRecord(value) || typeof value.text !== "string") {
    return null;
  }
  return {
    text: value.text,
    division: asString(value.division),
    topic: asString(value.topic),
  };
}

function sanitizeCard(value: unknown): CardData | null {
  if (!isRecord(value)) {
    return null;
  }
  const source = sanitizeSource(value);
  if (!source) {
    return null;
  }
  const results: Partial<Record<LanguageCode, string>> = {};
  if (isRecord(value.results)) {
    for (const [code, text] of Object.entries(value.results)) {
      if (isLanguageCode(code) && typeof text === "string") {
        results[code] = text;
      }
    }
  }
  return {
    ...source,
    title: asString(value.title),
    results,
    translatedSource: sanitizeSource(value.translatedSource),
  };
}

export function parseCards(raw: string | null): (CardData | null)[] {
  if (!raw) {
    return createEmptyCards();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return createEmptyCards();
    }
    return Array.from({ length: CARD_COUNT }, (_, index) =>
      sanitizeCard(parsed[index]),
    );
  } catch {
    return createEmptyCards();
  }
}

// Panel languages are stored as four slots, each either a distinct
// language code or "" (not chosen yet — duplicates are forbidden
// among chosen languages). Invalid entries and duplicates drop to
// "", and missing slots stay "" (drafts stored when
// only three slots existed simply gain an unselected fourth).
export function sanitizePanelLangs(value: unknown): PanelLangs {
  const picked: PanelLangSelection[] = [];
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 4)) {
      if (
        typeof item === "string" &&
        isLanguageCode(item) &&
        !picked.includes(item)
      ) {
        picked.push(item);
      } else {
        picked.push("");
      }
    }
  }
  while (picked.length < 4) {
    picked.push("");
  }
  return [picked[0], picked[1], picked[2], picked[3]];
}

export function parseSessionDraft(raw: string | null): SessionDraft | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    const source = sanitizeSource(parsed);
    if (!source) {
      return null;
    }
    const activeSlot =
      typeof parsed.activeSlot === "number" &&
      parsed.activeSlot >= 0 &&
      parsed.activeSlot < CARD_COUNT
        ? parsed.activeSlot
        : null;
    return {
      ...source,
      activeSlot,
      // A stored 1, 3 or 4 is a deliberate earlier choice and is
      // honoured; anything else (missing, corrupt) falls back to
      // the fresh default of 2 .
      panelCount:
        parsed.panelCount === 1
          ? 1
          : parsed.panelCount === 3
            ? 3
            : parsed.panelCount === 4
              ? 4
              : 2,
      panelLangs: sanitizePanelLangs(parsed.panelLangs),
      // A stored choice survives only while it is still allowlisted;
      // anything else (a removed model, a corrupt value) falls back
      // to "not chosen yet" — never to a silent substitute model.
      model: isLlmModelId(parsed.model) ? parsed.model : "",
      // Only the one working industry survives a round trip; the
      // coming-soon entries are disabled in the UI and can never
      // be a stored value.
      industry: parsed.industry === "automotive" ? "automotive" : "",
      // Only an explicit true hides the input column; anything
      // else (including drafts stored before the field existed)
      // keeps it shown.
      sidebarHidden: parsed.sidebarHidden === true,
    };
  } catch {
    return null;
  }
}

// --- Storage -----------------------------------------------------------
// The store helpers return false instead of throwing when the storage
// quota is exceeded, so the UI can warn instead of crashing.

export function loadCards(storage: Storage): (CardData | null)[] {
  try {
    return parseCards(storage.getItem(STORAGE_KEYS.cards));
  } catch {
    return createEmptyCards();
  }
}

export function storeCards(storage: Storage, cards: CardSlots): boolean {
  try {
    storage.setItem(STORAGE_KEYS.cards, JSON.stringify(cards));
    return true;
  } catch {
    return false;
  }
}

// Cross-tab synchronisation : interprets a
// "storage" event fired because ANOTHER tab changed Web Storage.
// Returns the sanitized cards when the event concerns the cards key
// (a null newValue means the key was removed there, e.g. by that
// tab's session delete), the empty card set when the whole storage
// area was cleared (a null key), and null when the event is about
// anything else and must be ignored.
export function cardsFromStorageEvent(
  key: string | null,
  newValue: string | null,
): (CardData | null)[] | null {
  if (key === STORAGE_KEYS.cards) {
    return parseCards(newValue);
  }
  if (key === null) {
    return createEmptyCards();
  }
  return null;
}


export function loadSessionDraft(storage: Storage): SessionDraft | null {
  try {
    return parseSessionDraft(storage.getItem(STORAGE_KEYS.session));
  } catch {
    return null;
  }
}

export function storeSessionDraft(
  storage: Storage,
  draft: SessionDraft,
): boolean {
  try {
    storage.setItem(STORAGE_KEYS.session, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

// The gate state — only the consent timestamp. No
// credential is stored anywhere client-side: /api/verify
// holds the user's own API key in an httpOnly session cookie
// and the browser authenticates with that. Unknown fields in
// a stored ack are ignored when it is parsed.
export interface AckData {
  acknowledgedAt: string;
}

export function parseAck(raw: string | null): AckData | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.acknowledgedAt !== "string") {
      return null;
    }
    if (parsed.acknowledgedAt === "") {
      return null;
    }
    return { acknowledgedAt: parsed.acknowledgedAt };
  } catch {
    return null;
  }
}

export function loadAck(storage: Storage): AckData | null {
  try {
    return parseAck(storage.getItem(STORAGE_KEYS.ack));
  } catch {
    return null;
  }
}

export function storeAck(storage: Storage, ack: AckData): boolean {
  try {
    storage.setItem(STORAGE_KEYS.ack, JSON.stringify(ack));
    return true;
  } catch {
    return false;
  }
}

// Session start bookkeeping for the expiry reminder . The session cookie holds the raw API key and nothing
// else — no timestamp — and it is httpOnly, so the page cannot read
// its Max-Age either. The only moment the client knows a session
// began is the fresh key verification, so that timestamp is kept in
// localStorage (shared by every tab, like the cookie itself) purely
// to warn before the session runs out. Resuming a stored key does
// NOT move the start: the server never re-issues the cookie on
// resume, so the expiry stays where the fresh verification put it.
export function storeSessionStart(
  storage: Storage,
  startedAtMs: number,
): boolean {
  try {
    storage.setItem(STORAGE_KEYS.sessionStart, String(startedAtMs));
    return true;
  } catch {
    return false;
  }
}

export function loadSessionStart(storage: Storage): number | null {
  try {
    const raw = storage.getItem(STORAGE_KEYS.sessionStart);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

// Milliseconds left in the session, or null when no start was ever
// recorded in this browser (a cookie set by an older build, or the
// record was cleared with the site data) — the reminder then simply
// stays hidden rather than guessing. Never negative.
export function sessionRemainingMs(
  startedAtMs: number | null,
  nowMs: number,
  ttlMs: number,
): number | null {
  if (startedAtMs === null) {
    return null;
  }
  return Math.max(0, startedAtMs + ttlMs - nowMs);
}

// delete every key owned by this app, and nothing else.
export function clearAllChoureiData(storage: Storage): void {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    storage.removeItem(key);
  }
}
