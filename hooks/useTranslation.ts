"use client";

import { useRef, useState, type RefObject } from "react";

import type { PanelEntry } from "@/components/OutputPanel";
import {
  isSameSource,
  type CardSource,
} from "@/lib/cards";
import {
  hasNumberMismatch,
  isProhibitionMissing,
} from "@/lib/checks";
import type { ApiErrorCode } from "@/lib/errors";
import { ja } from "@/lib/i18n/ja";
import { LANGUAGE_CODES, type LanguageCode } from "@/lib/languages";
import { getLlmModel, isLlmModelId } from "@/lib/models";

// useTranslation — the translate pipeline: one request, its
// result state, and the rules that protect both.
//
// Extracted from app/page.tsx in the refactor; the
// behaviour is unchanged.
//
// The pipeline in one paragraph: translateLangs sends ONE
// request for a set of languages (the main button asks
// for every chosen panel language at once, a panel button asks
// for just its own). While the request runs, the operator can
// cancel it. When the answer lands, it is applied only if the
// input it belongs to is still the input on screen; successful
// texts are merged into lastResult, handed to the card
// write-back, and the usage meter is refreshed. A 401 means the
// session died — the page is told (onUnauthorized) and ends it.
//
// lastResult also remembers WHICH model produced it:
// the 翻訳済み state holds only while the picker still shows
// that model, so switching models re-arms the translate button
// for a re-translation with the new model.

export interface LastResult {
  source: CardSource;
  entries: Partial<Record<LanguageCode, PanelEntry>>;
  uncertain: string[];
  prohibition: boolean;
  glossarySkipped: number;
  // The model that produced this result. For results loaded
  // from a card this is the model selected at load time (the
  // card itself does not record one). Refreshed by every
  // translate call, so after a mixed sequence it names the
  // latest call's model.
  model: string;
}

// The page wires the pipeline to its neighbours through these
// callbacks. Getters (not plain values) because a translation
// reads them when it starts and when its answer lands — both
// moments need the current state, not a stale render's.
export interface TranslationDeps {
  // True while a gate session is active; translating without
  // one is impossible (the server would 401 anyway).
  isSessionActive: () => boolean;
  // The editor's current source (text + division + topic).
  getSource: () => CardSource;
  // The same source as a live ref, for the stale-input check.
  sourceRef: RefObject<CardSource>;
  // The model the picker currently shows.
  getModel: () => string;
  // The card slot active when the translation started.
  getActiveSlot: () => number | null;
  // Store fresh texts on the active card (useCards.writeBack —
  // it re-checks that the card's sentence is this source).
  onWriteBack: (
    activeSlot: number | null,
    source: CardSource,
    okTexts: Partial<Record<LanguageCode, string>>,
  ) => void;
  // The session ended (a 401 came back): the page expires it.
  onUnauthorized: () => void;
  // A translation settled without ending the session: the page
  // refreshes the usage meter.
  onSettled: () => void;
}

// Turn the server's error code into the Japanese message for
// it; anything unknown falls back to the generic failure.
function messageForErrorCode(code: unknown): string {
  if (
    typeof code === "string" &&
    Object.prototype.hasOwnProperty.call(ja.errors, code)
  ) {
    return ja.errors[code as ApiErrorCode];
  }
  return ja.errors.llm_failed;
}

// Rebuild panel entries from a card's stored plain texts (used
// when a card is loaded — no network involved). Both
// checks are deterministic, so a loaded card can be re-checked
// locally against the source it was translated from (the number check and
// the target-side prohibition check).
export function entriesFromResults(
  results: Partial<Record<LanguageCode, string>>,
  source?: CardSource,
): Partial<Record<LanguageCode, PanelEntry>> {
  const entries: Partial<Record<LanguageCode, PanelEntry>> = {};
  for (const code of LANGUAGE_CODES) {
    const text = results[code];
    if (text !== undefined) {
      entries[code] = {
        ok: true,
        text,
        numberMismatch: source
          ? hasNumberMismatch(source.text, text)
          : undefined,
        prohibitionMissing: source
          ? isProhibitionMissing(source.text, text, code)
          : undefined,
      };
    }
  }
  return entries;
}

export function useTranslation(deps: TranslationDeps) {
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  // GC-06 layer 3: once a PAID call comes back 402, paid models
  // are locked for the rest of this session (in memory only —
  // nothing is stored). The page reads it to block paid models
  // and show the top-up / switch-to-free notice.
  const [paidLocked, setPaidLocked] = useState(false);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  // The in-flight request's abort handle, so the cancel button
  // (and a session delete) can stop it.
  const abortRef = useRef<AbortController | null>(null);

  // One request for the given languages. Used by the
  // main translate button (all chosen visible languages) and by
  // the per-panel buttons (a single language: first translation
  // or retry).
  const translateLangs = async (requestedLangs: LanguageCode[]) => {
    if (
      !deps.isSessionActive() ||
      translating ||
      requestedLangs.length === 0 ||
      !isLlmModelId(deps.getModel())
    ) {
      return;
    }
    // languages the selected model does not support are
    // filtered out here, at the pipeline's single entry point, so
    // no caller (main button, panel button) can send
    // one by accident. The panel itself shows the blocking notice
    // for such a language, and the server rejects it as well — this
    // filter is the middle of three layers, not the only one.
    const modelOption = getLlmModel(deps.getModel());
    const langs = modelOption
      ? requestedLangs.filter(
          (code) => !modelOption.unsupportedLanguages.includes(code),
        )
      : requestedLangs;
    if (langs.length === 0) {
      return;
    }
    // Snapshot everything the completion will need: the world
    // may move on while the request is in flight, and the
    // result must be judged against the input that produced it.
    const source = deps.getSource();
    const model = deps.getModel();
    const slotAtStart = deps.getActiveSlot();
    const controller = new AbortController();
    abortRef.current = controller;
    setTranslating(true);
    setTranslateError(null);
    let returnedToGate = false;
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...source,
          langs,
          model,
        }),
        signal: controller.signal,
      });
      if (response.status === 401) {
        // The session is no longer accepted (expired or
        // cleared): return to the gate with the reason shown.
        deps.onUnauthorized();
        returnedToGate = true;
        return;
      }
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const errorCode =
          typeof data === "object" && data !== null
            ? (data as { error?: unknown }).error
            : undefined;
        // GC-06 layer 3: a 402 on a paid model is the final
        // word on credit — lock paid models for this session.
        if (errorCode === "credits_or_quota" && modelOption?.paid) {
          setPaidLocked(true);
        }
        setTranslateError(messageForErrorCode(errorCode));
        return;
      }
      // if the input changed while the request was
      // running, the results belong to an old input and are
      // discarded.
      if (!isSameSource(deps.sourceRef.current, source)) {
        return;
      }
      const payload = data as {
        results: Record<
          string,
          | {
              ok: boolean;
              text?: string;
              numberMismatch?: boolean;
              prohibitionMissing?: boolean;
            }
          | undefined
        >;
        uncertain?: unknown;
        sourceFlags?: { prohibition?: unknown };
        glossarySkipped?: unknown;
      };
      // Sort the payload into panel entries; a language whose
      // entry is not ok stays visibly failed so its panel offers
      // a retry instead of pretending.
      const newEntries: Partial<Record<LanguageCode, PanelEntry>> = {};
      const okTexts: Partial<Record<LanguageCode, string>> = {};
      for (const code of langs) {
        const entry = payload.results[code];
        if (entry?.ok && typeof entry.text === "string") {
          newEntries[code] = {
            ok: true,
            text: entry.text,
            numberMismatch: entry.numberMismatch === true,
            prohibitionMissing: entry.prohibitionMissing === true,
          };
          okTexts[code] = entry.text;
        } else {
          newEntries[code] = { ok: false };
        }
      }
      const notices = {
        uncertain: Array.isArray(payload.uncertain)
          ? payload.uncertain.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        prohibition: payload.sourceFlags?.prohibition === true,
        glossarySkipped:
          typeof payload.glossarySkipped === "number"
            ? payload.glossarySkipped
            : 0,
      };
      // Merge into the previous result when it belongs to the
      // same source (a per-language retry refreshes one entry
      // and keeps its siblings); otherwise start a fresh result.
      setLastResult((previous) =>
        previous && isSameSource(previous.source, source)
          ? {
              source,
              entries: { ...previous.entries, ...newEntries },
              ...notices,
              model,
            }
          : { source, entries: newEntries, ...notices, model },
      );
      deps.onWriteBack(slotAtStart, source, okTexts);
    } catch {
      // A user cancel (AbortError) stays silent; anything else
      // is a network failure.
      if (!controller.signal.aborted) {
        setTranslateError(ja.networkErrorMessage);
      }
    } finally {
      setTranslating(false);
      abortRef.current = null;
      // the meter numbers refresh after every
      // translation — except when the session just ended, in
      // which case there is nothing left to refresh.
      if (!returnedToGate) {
        deps.onSettled();
      }
    }
  };

  // The cancel button: stop the in-flight request. The catch
  // block above sees the abort and stays silent.
  const cancel = () => {
    abortRef.current?.abort();
  };

  // Session-delete support: forget the result and any error (the page
  // wipes the underlying storage itself).
  const reset = () => {
    setLastResult(null);
    setTranslateError(null);
    setPaidLocked(false);
  };

  return {
    translating,
    translateError,
    paidLocked,
    lastResult,
    setLastResult,
    translateLangs,
    cancel,
    reset,
  };
}
