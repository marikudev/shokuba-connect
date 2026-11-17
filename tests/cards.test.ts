import { describe, expect, it } from "vitest";

import {
  CARD_COUNT,
  EMPTY_SESSION_DRAFT,
  STORAGE_KEYS,
  cardsFromStorageEvent,
  clearAllChoureiData,
  clearCard,
  createEmptyCards,
  deriveCardStatus,
  getCard,
  loadCards,
  loadSessionDraft,
  loadSessionStart,
  parseAck,
  parseCards,
  parseSessionDraft,
  sanitizePanelLangs,
  saveCard,
  sessionRemainingMs,
  storeAck,
  storeCards,
  storeSessionDraft,
  storeSessionStart,
  type CardData,
} from "@/lib/cards";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

class QuotaStorage extends MemoryStorage {
  override setItem(): void {
    throw new DOMException("quota exceeded", "QuotaExceededError");
  }
}

const source = { text: "本日はテストです", division: "組立課", topic: "不具合" };

const savedCard: CardData = {
  ...source,
  title: "朝礼1",
  results: {},
  translatedSource: null,
};

const translatedCard: CardData = {
  ...source,
  title: "",
  results: { id: "Hari ini adalah tes", my: "မြန်မာ" },
  translatedSource: { ...source },
};

describe("card status derivation", () => {
  it("starts with ten empty slots", () => {
    const cards = createEmptyCards();
    expect(cards).toHaveLength(CARD_COUNT);
    expect(cards.every((card) => card === null)).toBe(true);
    expect(deriveCardStatus(null)).toBe("empty");
  });

  it("a saved card without results is saved-untranslated", () => {
    expect(deriveCardStatus(savedCard)).toBe("saved");
  });

  it("a card with results for its current source is translated, even with partial languages", () => {
    expect(Object.keys(translatedCard.results)).toEqual(["id", "my"]);
    expect(deriveCardStatus(translatedCard)).toBe("translated");
  });

  it("a card whose own stored source no longer matches its results is stale", () => {
    // Only reachable with data saved by older builds: the stored text
    // was changed while the old results and their source snapshot
    // were carried over .
    const cards = saveCard(createEmptyCards(), 0, {
      ...translatedCard,
      text: "本日はテストでした",
    });
    expect(deriveCardStatus(getCard(cards, 0))).toBe("stale");

    const contextEdited = saveCard(createEmptyCards(), 0, {
      ...translatedCard,
      topic: "安全",
    });
    expect(deriveCardStatus(getCard(contextEdited, 0))).toBe("stale");
  });
});

describe("card slot operations", () => {
  it("saves into a slot without mutating the original array", () => {
    const before = createEmptyCards();
    const after = saveCard(before, 3, savedCard);
    expect(getCard(before, 3)).toBeNull();
    expect(getCard(after, 3)).toEqual(savedCard);
  });

  it("overwriting a filled slot replaces its data", () => {
    const cards = saveCard(createEmptyCards(), 0, savedCard);
    const replacement: CardData = { ...savedCard, title: "差し替え", text: "別の文" };
    const after = saveCard(cards, 0, replacement);
    expect(getCard(after, 0)).toEqual(replacement);
  });

  it("clearing a slot empties only that slot", () => {
    let cards = saveCard(createEmptyCards(), 0, savedCard);
    cards = saveCard(cards, 1, savedCard);
    const after = clearCard(cards, 0);
    expect(getCard(after, 0)).toBeNull();
    expect(getCard(after, 1)).toEqual(savedCard);
  });
});

describe("card storage", () => {
  it("round-trips cards through storage, keeping partial results", () => {
    const storage = new MemoryStorage();
    const cards = saveCard(createEmptyCards(), 2, translatedCard);
    expect(storeCards(storage, cards)).toBe(true);
    expect(loadCards(storage)).toEqual(cards);
    expect(getCard(loadCards(storage), 2)?.results).toEqual({
      id: "Hari ini adalah tes",
      my: "မြန်မာ",
    });
  });

  it("falls back to empty cards when stored data is corrupted", () => {
    expect(parseCards("{not json")).toEqual(createEmptyCards());
    expect(parseCards('"just a string"')).toEqual(createEmptyCards());
    expect(parseCards(null)).toEqual(createEmptyCards());

    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.cards, "[null, 42, {}]");
    const loaded = loadCards(storage);
    expect(loaded).toHaveLength(CARD_COUNT);
    expect(loaded.every((card) => card === null)).toBe(true);
  });

  it("reports quota failures instead of throwing", () => {
    const storage = new QuotaStorage();
    expect(storeCards(storage, createEmptyCards())).toBe(false);
    expect(storeSessionDraft(storage, EMPTY_SESSION_DRAFT)).toBe(false);
  });

  it("round-trips the session draft and rejects malformed drafts", () => {
    const storage = new MemoryStorage();
    const draft = {
      ...EMPTY_SESSION_DRAFT,
      ...source,
      activeSlot: 4,
      panelCount: 3 as const,
      panelLangs: ["vi", "en", "pt", ""] as ["vi", "en", "pt", ""],
    };
    expect(storeSessionDraft(storage, draft)).toBe(true);
    expect(loadSessionDraft(storage)).toEqual(draft);

    storage.setItem(STORAGE_KEYS.session, "{broken");
    expect(loadSessionDraft(storage)).toBeNull();
  });

  it("honours a stored panel count of 4 and the sidebar display mode", () => {
    const parsed = parseSessionDraft(
      JSON.stringify({ ...source, panelCount: 4, sidebarHidden: true }),
    );
    expect(parsed?.panelCount).toBe(4);
    expect(parsed?.sidebarHidden).toBe(true);
    // Drafts stored before the field existed keep the column shown.
    const legacy = parseSessionDraft(JSON.stringify({ ...source }));
    expect(legacy?.sidebarHidden).toBe(false);
  });

  it("applies panel defaults to drafts stored before M4", () => {
    const legacy = JSON.stringify({ ...source, activeSlot: 1 });
    const parsed = parseSessionDraft(legacy);
    // Panel defaults: a draft without a stored
    // count falls back to two panels (it was one before that).
    expect(parsed?.panelCount).toBe(2);
    expect(parsed?.panelLangs).toEqual(["", "", "", ""]);
  });

  it("sanitizes panel languages: valid codes kept distinct, everything else stays unselected ", () => {
    expect(sanitizePanelLangs(["vi", "vi", "en"])).toEqual([
      "vi",
      "",
      "en",
      "",
    ]);
    expect(sanitizePanelLangs(["xx"])).toEqual(["", "", "", ""]);
    expect(sanitizePanelLangs(undefined)).toEqual(["", "", "", ""]);
    expect(sanitizePanelLangs(["pt", "my", "id"])).toEqual([
      "pt",
      "my",
      "id",
      "",
    ]);
    expect(sanitizePanelLangs(["id"])).toEqual(["id", "", "", ""]);
    expect(sanitizePanelLangs(["", "my", ""])).toEqual(["", "my", "", ""]);
  });

  it("clears only the chourei:* keys on session delete", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.cards, "[]");
    storage.setItem(STORAGE_KEYS.session, "{}");
    storage.setItem(STORAGE_KEYS.ack, "true");
    storage.setItem("unrelated:key", "keep me");

    clearAllChoureiData(storage);

    expect(storage.getItem(STORAGE_KEYS.cards)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.ack)).toBeNull();
    expect(storage.getItem("unrelated:key")).toBe("keep me");
  });
});

describe("cross-tab card synchronisation ", () => {
  const card: CardData = {
    text: "明日の朝礼は7時からです",
    division: "",
    topic: "",
    title: "朝礼1",
    results: {},
    translatedSource: null,
  };

  it("adopts the cards another tab stored", () => {
    const external = saveCard(createEmptyCards(), 3, card);
    const next = cardsFromStorageEvent(
      STORAGE_KEYS.cards,
      JSON.stringify(external),
    );
    expect(next).toHaveLength(CARD_COUNT);
    expect(next?.[3]?.title).toBe("朝礼1");
  });

  it("empties the cards when another tab removed the key (session delete)", () => {
    expect(cardsFromStorageEvent(STORAGE_KEYS.cards, null)).toEqual(
      createEmptyCards(),
    );
  });

  it("empties the cards when the whole storage area was cleared", () => {
    expect(cardsFromStorageEvent(null, null)).toEqual(createEmptyCards());
  });

  it("ignores events about any other key", () => {
    expect(cardsFromStorageEvent(STORAGE_KEYS.session, "{}")).toBeNull();
    expect(cardsFromStorageEvent(STORAGE_KEYS.ack, "{}")).toBeNull();
    expect(cardsFromStorageEvent("unrelated:key", "x")).toBeNull();
  });

  it("sanitizes a damaged payload instead of adopting it raw", () => {
    expect(cardsFromStorageEvent(STORAGE_KEYS.cards, "{not json")).toEqual(
      createEmptyCards(),
    );
  });
});

describe("gate ack (no stored code)", () => {
  it("parses the current shape: a consent timestamp only", () => {
    expect(
      parseAck('{"acknowledgedAt":"T00:00:00.000Z"}'),
    ).toEqual({ acknowledgedAt: "T00:00:00.000Z" });
  });

  it("ignores unknown fields in a stored ack", () => {
    const parsed = parseAck(
      '{"code":"legacy-secret","acknowledgedAt":"T00:00:00.000Z"}',
    );
    expect(parsed).toEqual({ acknowledgedAt: "T00:00:00.000Z" });
    expect(JSON.stringify(parsed)).not.toContain("legacy-secret");
  });

  it("rejects missing or malformed values", () => {
    expect(parseAck(null)).toBeNull();
    expect(parseAck("{}")).toBeNull();
    expect(parseAck('{"acknowledgedAt":""}')).toBeNull();
    expect(parseAck("not json")).toBeNull();
  });

  it("storeAck never writes a code field", () => {
    const storage = new MemoryStorage();
    storeAck(storage, { acknowledgedAt: "T00:00:00.000Z" });
    const raw = storage.getItem(STORAGE_KEYS.ack) ?? "";
    expect(raw).toContain("acknowledgedAt");
    expect(raw).not.toContain("code");
  });
});

describe("session start bookkeeping (expiry reminder, )", () => {
  const TTL = 24 * 60 * 60 * 1000;

  it("round-trips the recorded start and rejects junk", () => {
    const storage = new MemoryStorage();
    expect(loadSessionStart(storage)).toBeNull();
    expect(storeSessionStart(storage, 1_700_000_000_000)).toBe(true);
    expect(loadSessionStart(storage)).toBe(1_700_000_000_000);
    storage.setItem(STORAGE_KEYS.sessionStart, "not a number");
    expect(loadSessionStart(storage)).toBeNull();
    storage.setItem(STORAGE_KEYS.sessionStart, "-5");
    expect(loadSessionStart(storage)).toBeNull();
  });

  it("is removed by the session-delete sweep like every chourei key", () => {
    const storage = new MemoryStorage();
    storeSessionStart(storage, 1_700_000_000_000);
    clearAllChoureiData(storage);
    expect(loadSessionStart(storage)).toBeNull();
  });

  it("computes the remaining time and clamps it at zero", () => {
    const start = 1_700_000_000_000;
    expect(sessionRemainingMs(null, start, TTL)).toBeNull();
    expect(sessionRemainingMs(start, start, TTL)).toBe(TTL);
    expect(sessionRemainingMs(start, start + TTL - 30 * 60_000, TTL)).toBe(
      30 * 60_000,
    );
    expect(sessionRemainingMs(start, start + TTL + 1, TTL)).toBe(0);
  });
});
