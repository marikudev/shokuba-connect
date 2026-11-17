"use client";

import { useEffect, useState } from "react";

import {
  cardsFromStorageEvent,
  clearCard,
  createEmptyCards,
  getCard,
  isSameSource,
  loadCards,
  saveCard,
  storeCards,
  type CardData,
  type CardSource,
} from "@/lib/cards";
import type { LanguageCode } from "@/lib/languages";

// useCards — the 20 preparation cards and their persistence.
//
// Extracted from app/page.tsx in the refactor; the
// behaviour is unchanged.
//
// The cards live in localStorage (since ) so the
// morning's preparations survive the tab being closed — the
// whole point of preparing chourei materials the evening before.
// This hook owns:
//   - cards: the in-memory copy of the 20 slots (null = empty).
//   - storageError: true when a write failed (e.g. quota), shown
//     as a banner by the page; the in-memory state still updated
//     so the operator does not lose sight of their work.
//   - ready: false until the stored cards have been read once.
//   - Cross-tab synchronisation, so two open tabs cannot quietly
//     overwrite each other's saves.
//   - The write-back rule that stores fresh translations onto the
//     active card — guarded so a translation can only ever land
//     on the card whose own sentence produced it.
export function useCards() {
  const [cards, setCards] = useState<(CardData | null)[]>(createEmptyCards);
  const [storageError, setStorageError] = useState(false);
  const [ready, setReady] = useState(false);

  // Load the cards once, on mount. Reading storage is an
  // external-system sync, hence the scoped
  // lint disable (same pattern as the other storage hooks).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCards(loadCards(window.localStorage));
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cross-tab synchronisation : each tab
  // keeps its own in-memory copy of the shared localStorage
  // cards, so without this a tab would show the cards as they
  // were when it was opened — and a save from that stale tab
  // would overwrite newer saves from another tab. The "storage"
  // event reports writes made by OTHER tabs (the browser never
  // fires it in the tab that wrote), and the cards are re-read
  // whenever this tab becomes visible or regains focus, in case
  // an event was missed. The handlers only ever read; they never
  // write, so tabs cannot trigger each other in a loop. Only the
  // cards sync: the input draft and the gate ack stay per-tab by
  // design.
  useEffect(() => {
    if (!ready) {
      return;
    }
    const applyExternal = (next: (CardData | null)[]) => {
      setCards((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };
    const onStorage = (event: StorageEvent) => {
      const next = cardsFromStorageEvent(event.key, event.newValue);
      if (next) {
        applyExternal(next);
      }
    };
    const reload = () => {
      applyExternal(loadCards(window.localStorage));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reload();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready]);

  // Shared tail of every mutation: swap the in-memory slots,
  // then try to persist them, surfacing a failure as the banner
  // flag instead of throwing.
  const commit = (next: (CardData | null)[]) => {
    setCards(next);
    setStorageError(!storeCards(window.localStorage, next));
  };

  // Save (or overwrite) one slot with the given card data. The
  // page computes the data — including which results, if any,
  // may be carried — because that decision needs the editor and
  // the last translation, which live outside this hook.
  const saveAt = (slotIndex: number, data: CardData) => {
    commit(saveCard(cards, slotIndex, data));
  };

  // Empty one slot.
  const clearAt = (slotIndex: number) => {
    commit(clearCard(cards, slotIndex));
  };

  // Write-back after a successful translation (called by the
  // translation hook through the page): store the fresh texts on
  // the active card — but ONLY when the translation is of that
  // card's own stored sentence. Translating a new sentence while
  // a card is active must never touch that card; an earlier
  // version overwrote the active card's results with the new
  // sentence's results while keeping its old text, silently
  // destroying the stored translation . When the
  // card already held results for the same source, the new texts
  // refresh ONLY the languages already stored ; otherwise they replace them
  // wholesale.
  const writeBack = (
    activeSlot: number | null,
    source: CardSource,
    okTexts: Partial<Record<LanguageCode, string>>,
  ) => {
    if (activeSlot === null) {
      return;
    }
    const card = getCard(cards, activeSlot);
    if (!card || !isSameSource(card, source)) {
      return;
    }
    const sameSource =
      card.translatedSource !== null &&
      isSameSource(card.translatedSource, source);
    // Refresh-only rule (bug fix, ): when the card
    // already holds results for this source, a write-back may
    // refresh the languages the card ALREADY has — it must never
    // ADD a language. Adding was the leak in 
    // card 1 (English + Chinese) was still the active slot while
    // he translated Vietnamese + Portuguese for card 2, and the
    // merge silently gave card 1 all four languages, after which
    // loading it showed three wrong panels and pushed Chinese
    // out. New languages reach a card only through the explicit
    // save dialog, which carries exactly the visible panels.
    const refreshed: Partial<Record<LanguageCode, string>> = {};
    for (const code of Object.keys(okTexts) as LanguageCode[]) {
      if (card.results[code] !== undefined) {
        refreshed[code] = okTexts[code];
      }
    }
    const updated: CardData = {
      ...card,
      results: sameSource ? { ...card.results, ...refreshed } : okTexts,
      translatedSource: source,
    };
    commit(saveCard(cards, activeSlot, updated));
  };

  // Session-delete support: forget every card (the page wipes the
  // underlying storage itself; this resets the in-memory copy).
  const reset = () => {
    setCards(createEmptyCards());
    setStorageError(false);
  };

  return { cards, storageError, ready, saveAt, clearAt, writeBack, reset };
}
