"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AccessGate } from "@/components/AccessGate";
import { CardSidebar } from "@/components/CardSidebar";
import { ContextBar } from "@/components/ContextBar";
import { InputPanel } from "@/components/InputPanel";
import { ModelPicker } from "@/components/ModelPicker";
import { OutputPanel } from "@/components/OutputPanel";
import { SaveCardDialog } from "@/components/SaveCardDialog";
import { useCards } from "@/hooks/useCards";
import { useEditorDraft } from "@/hooks/useEditorDraft";
import { useGateSession } from "@/hooks/useGateSession";
import { useTranslation, entriesFromResults } from "@/hooks/useTranslation";
import { useUsageMeter } from "@/hooks/useUsageMeter";
import {
  clearAllChoureiData,
  getCard,
  isSameSource,
  type CardData,
  type CardSource,
  type PanelCount,
  type PanelLangSelection,
} from "@/lib/cards";
import { hasProhibition } from "@/lib/checks";
import { ja } from "@/lib/i18n/ja";
import { LANGUAGE_CODES, type LanguageCode } from "@/lib/languages";
import { paidModelsBlocked } from "@/hooks/useUsageMeter";
import { getLlmModel, isLlmModelId } from "@/lib/models";

// The 朝礼コネクト workspace (route /chourei), as a composition.
//
// The state and logic live in focused hooks under hooks/,
// each documented at its top; this component wires them
// together and renders:
//
//   useGateSession — the gate/session state: consent ack, the
//                     expiry reminder, session end and resume.
//   useUsageMeter — the usage meter (its data + format).
//   useCards — the 20 cards: load, cross-tab sync, the
//                     guarded write-back of fresh translations.
//   useEditorDraft — the input draft and panel choices, with
//                     their per-tab sessionStorage persistence.
//   useTranslation — the translate pipeline and its result.
//
// What remains here is only what genuinely spans several of
// those concerns: ending or deleting a session (it touches
// all of them), loading/saving/clearing a card (cards + draft
// + result move together), and the layout itself.
//
// Feature map for readers: selectable output panels
// (1–4, with a 2x2 grid at four), a collapsible input column
// that leaves a card rail in display mode, per-language translation and retry
// from the panels, the 翻訳済み rule on the main
// translate button, card loading that points the panels at the
// languages the card actually has results for, the
// response notices, and the usage meter.

export default function ChoureiPage() {
  const session = useGateSession();
  const cardsState = useCards();
  const draft = useEditorDraft();

  // Session end has two parents: the session hook owns the ack
  // side, the meter owns the usage side, and the meter needs the
  // combined handler before it exists. The ref trampoline
  // breaks that circle: both consumers call through the ref,
  // which this effect keeps pointing at the current handler.
  const expireRef = useRef<() => void>(() => {});
  const meter = useUsageMeter(session.ack !== null, () => {
    expireRef.current();
  });
  // Ends the local session and returns to the gate with the
  // reason shown. Used whenever an API call answers 401.
  const expireSession = () => {
    session.expire();
    meter.resetUsage();
  };
  useEffect(() => {
    expireRef.current = expireSession;
  });

  const translation = useTranslation({
    isSessionActive: () => session.ack !== null,
    getSource: () => ({
      text: draft.text,
      division: draft.division,
      topic: draft.topic,
    }),
    sourceRef: draft.sourceRef,
    getModel: () => draft.model,
    getActiveSlot: () => draft.activeSlotRef.current,
    onWriteBack: cardsState.writeBack,
    onUnauthorized: expireSession,
    onSettled: () => {
      void meter.refreshUsage();
    },
  });

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const modelSelectId = useId();

  // remove every chourei:* key and reset all state. The
  // logout call is AWAITED before the gate is shown: a
  // fire-and-forget call would let the gate's
  // stored-key probe race the logout, see the cookie that
  // was about to be cleared, and offer "continue" with no key
  // field — while the session was in fact already over. The
  // local reset stands even if the call fails.
  const handleDeleteSession = async () => {
    translation.cancel();
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // No fetch available or the call failed; nothing more to
      // clear server-side — the local wipe below still applies.
    }
    clearAllChoureiData(window.sessionStorage);
    // The cards live in localStorage; deleting
    // the session must remove them too — leaving prepared cards
    // behind on a shared computer is exactly what session
    // deletion exists to prevent.
    clearAllChoureiData(window.localStorage);
    // The draft hook's state resets would immediately re-store
    // an empty draft; suppress exactly that one write.
    draft.suppressNextStore();
    cardsState.reset();
    draft.reset();
    session.clear();
    translation.reset();
    meter.resetUsage();
    setSaveDialogOpen(false);
    // A deliberate delete ends the whole visit, not just the
    // workspace session: navigate to the umbrella home (/) so
    // the operator restarts there — after passing the gate
    // again they land on the product choice, not straight back
    // in this workspace. A full navigation is used so no
    // workspace state can survive the jump.
    window.location.assign("/");
  };

  // Loading a card never calls the network: the editor
  // takes the card's text and context, and its stored results —
  // when they belong to the card's current sentence — are shown
  // again exactly as they were saved.
  const handleLoadCard = (slotIndex: number) => {
    const card = getCard(cardsState.cards, slotIndex);
    if (!card) {
      return;
    }
    draft.setText(card.text);
    draft.setDivision(card.division);
    draft.setTopic(card.topic);
    draft.setActiveSlot(slotIndex);
    // Stored results belong to the card's sentence; a card
    // whose context fields drifted from translatedSource still
    // shows them as long as the sentence itself is the one that
    // was translated.
    const showResults =
      card.translatedSource !== null &&
      card.translatedSource.text === card.text &&
      Object.keys(card.results).length > 0;
    translation.setLastResult(
      showResults
        ? {
            source: {
              text: card.text,
              division: card.division,
              topic: card.topic,
            },
            entries: entriesFromResults(
              card.results,
              card.translatedSource ?? undefined,
            ),
            uncertain: [],
            prohibition: hasProhibition(card.text),
            glossarySkipped: 0,
            // A card records no model; its results count as
            // produced by the model selected at load time.
            model: draft.model,
          }
        : null,
    );
    // point the panels at the languages this card has
    // results for (at most as many as there are panels) and
    // show exactly that many panels; the remaining slots stay
    // unselected .
    const resultLangs = LANGUAGE_CODES.filter(
      (code) => card.results[code] !== undefined,
    );
    if (resultLangs.length > 0) {
      const assignment: PanelLangSelection[] = [...resultLangs.slice(0, 4)];
      while (assignment.length < 4) {
        assignment.push("");
      }
      draft.setPanelLangs([
        assignment[0],
        assignment[1],
        assignment[2],
        assignment[3],
      ]);
      draft.setPanelCount(
        (resultLangs.length >= 4 ? 4 : resultLangs.length) as PanelCount,
      );
    }
  };

  const handleSaveCard = (slotIndex: number, title: string) => {
    // Translation results follow the editor content — but ONLY
    // when they were produced for exactly the source being
    // saved. Carrying results across an edit (even a
    // division/topic tweak after translating) would store a
    // card whose translatedSource disagrees with its own text,
    // which later reads as a lost translation .
    // A mismatched save stores the text alone.
    const current: CardSource = {
      text: draft.text,
      division: draft.division,
      topic: draft.topic,
    };
    const lastResult = translation.lastResult;
    // Carry exactly the languages of the panels currently on
    // screen (bug fix, ): lastResult.entries accumulates
    // every language translated for this sentence along the way
    // (that accumulation is what the panels need), but a card must
    // hold only the panel set the operator is looking at when he
    // saves — otherwise a card saved after a second translation
    // round silently inherits the first round's languages too.
    const visibleChosen = draft.panelLangs
      .slice(0, draft.panelCount)
      .filter((code): code is LanguageCode => code !== "");
    const carried =
      lastResult && isSameSource(lastResult.source, current)
        ? {
            results: Object.fromEntries(
              Object.entries(lastResult.entries)
                .filter(
                  (entry) =>
                    entry[1].ok &&
                    visibleChosen.includes(entry[0] as LanguageCode),
                )
                .map((entry) => [
                  entry[0],
                  (entry[1] as { ok: true; text: string }).text,
                ]),
            ) as Partial<Record<LanguageCode, string>>,
            translatedSource: lastResult.source,
          }
        : { results: {}, translatedSource: null };
    const data: CardData = { ...current, title, ...carried };
    cardsState.saveAt(slotIndex, data);
    draft.setActiveSlot(slotIndex);
    setSaveDialogOpen(false);
  };

  const handleClearSlot = (slotIndex: number) => {
    cardsState.clearAt(slotIndex);
    if (draft.activeSlot === slotIndex) {
      draft.setActiveSlot(null);
      translation.setLastResult(null);
    }
    setSaveDialogOpen(false);
  };

  // Until every storage read has finished, render nothing:
  // showing the gate for a moment to an already-verified user
  // would be a confusing flash.
  const hydrated = session.ready && cardsState.ready && draft.ready;
  if (!hydrated) {
    return <div className="flex flex-1 flex-col" />;
  }

  if (!session.ack) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AccessGate
          initialError={session.gateError}
          onVerified={session.handleVerified}
        />
      </div>
    );
  }

  const firstEmptySlot = cardsState.cards.findIndex((card) => card === null);
  const defaultSaveSlot =
    draft.activeSlot ?? (firstEmptySlot >= 0 ? firstEmptySlot : 0);
  const activeCard =
    draft.activeSlot !== null
      ? getCard(cardsState.cards, draft.activeSlot)
      : null;

  const currentSource: CardSource = {
    text: draft.text,
    division: draft.division,
    topic: draft.topic,
  };
  // the selected model's metadata drives two things on this
  // screen — the always-visible data-use warning while a model that
  // does not send "deny" is active (the free model; the warning
  // must also appear when the choice was restored from a stored
  // draft, which this render-level derivation guarantees), and the
  // set of languages the panels must block for it.
  const activeModelOption = isLlmModelId(draft.model)
    ? getLlmModel(draft.model)
    : undefined;
  const freeModelActive = activeModelOption?.dataCollection === "allow";
  // GC-06 credit floor: while the account's remaining credit is
  // at the $1 floor, paid models are blocked (the operator tops
  // up or switches to the free model, which stays available);
  // the notice below says so. At $0 the usageExhausted block
  // above already stops everything.
  const paidModelSelected = activeModelOption?.paid ?? false;
  // GC-06, all three layers combined in one predicate: the
  // free-tier gate (layer 1), the $1 floor on a capped key
  // (layer 2), and the session's 402 lock (layer 3).
  const paidBlocked = paidModelsBlocked({
    isFreeTier: meter.usage?.account?.isFreeTier ?? null,
    limitRemaining: meter.usage?.account?.limitRemaining ?? null,
    paidLocked: translation.paidLocked,
  });
  const floorBlocksPaid = paidBlocked && paidModelSelected;
  const unsupportedLanguages = activeModelOption?.unsupportedLanguages ?? [];

  const visibleLangs = draft.panelLangs.slice(0, draft.panelCount);
  // The panels whose language the operator actually chose
  // : only these are ever translated — an
  // unselected panel costs no tokens. With none chosen, every
  // translate action stays disabled.
  const selectedVisibleLangs = visibleLangs.filter(
    (code): code is LanguageCode => code !== "",
  );
  // Results only apply to the exact source they were produced
  // for; anything else leaves the panel untranslated.
  const applicableResult =
    translation.lastResult &&
    isSameSource(translation.lastResult.source, currentSource)
      ? translation.lastResult
      : null;
  // when every CHOSEN visible language already has a
  // result for the current input, the main button becomes
  // 翻訳済み and cannot send a second request for the same
  // input. Since the result must also come from the
  // currently selected model: after switching models the
  // button returns to 翻訳する so the operator can
  // re-translate with the new model.
  const allVisibleCovered =
    applicableResult !== null &&
    applicableResult.model === draft.model &&
    selectedVisibleLangs.length > 0 &&
    selectedVisibleLangs.every(
      (code) => applicableResult.entries[code]?.ok === true,
    );

  // 部署 and 話題 are required, and the 業種 choice joined
  // them. Every translate action — main button and
  // per-panel buttons alike — stays disabled until all three are
  // set. Saving cards is not gated: a draft card may be prepared
  // first.
  const contextMissing =
    draft.industry === "" ||
    draft.division.trim() === "" ||
    draft.topic.trim() === "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ContextBar
        industry={draft.industry}
        onIndustryChange={draft.setIndustry}
        division={draft.division}
        topic={draft.topic}
        onDivisionChange={draft.setDivision}
        onTopicChange={draft.setTopic}
        onDeleteSession={handleDeleteSession}
        panelCount={draft.panelCount}
        onPanelCountChange={draft.setPanelCount}
        sidebarHidden={draft.sidebarHidden}
        onToggleSidebar={() => {
          draft.setSidebarHidden(!draft.sidebarHidden);
        }}
        sessionWarning={session.sessionWarning}
      />
      {freeModelActive ? (
        <p className="bg-coal px-4 py-2 text-sm font-semibold text-white">
          ⚠ {ja.freeModelWarning}
        </p>
      ) : null}
      {cardsState.storageError ? (
        <p className="bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
          {ja.storageErrorMessage}
        </p>
      ) : null}
      {translation.translateError ? (
        <p className="bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
          {translation.translateError}
        </p>
      ) : null}
      {meter.usageExhausted ? (
        <p className="bg-red-100 px-4 py-2 text-sm font-semibold text-red-800">
          {ja.errors.credits_or_quota}
        </p>
      ) : null}
      {meter.freeTierBlocksPaid ? (
        <p className="bg-coal px-4 py-2 text-sm font-semibold text-white">
          ⚠ {ja.freeTierNotice}
        </p>
      ) : (meter.creditFloorHit || translation.paidLocked) &&
        !freeModelActive ? (
        <p className="bg-coal px-4 py-2 text-sm font-semibold text-white">
          ⚠ {ja.creditFloorNotice}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
        {/* Left column : model picker, then
            the input (with the usage meter in its header row),
            then the cards — so on the big chourei monitor the
            translations get the whole right side, stacked
            full-width. In display mode (sidebarHidden) the whole
            column gives way to the narrow card rail: the panels
            take the freed width and any card can still be loaded
            by number. */}
        {draft.sidebarHidden ? (
          <CardSidebar
            variant="rail"
            cards={cardsState.cards}
            activeSlot={draft.activeSlot}
            onLoadCard={handleLoadCard}
          />
        ) : (
          <div className="flex shrink-0 flex-col gap-4 lg:min-h-0 lg:w-[400px]">
          <div className="flex items-start gap-2">
            <label
              htmlFor={modelSelectId}
              className="pt-2 text-sm font-semibold"
            >
              {ja.llmLabel}
            </label>
            {/* Rich listbox picker:
                provider logo, friendly name, badges. */}
            <ModelPicker
              id={modelSelectId}
              value={draft.model}
              onChange={draft.setModel}
              paidDisabled={paidBlocked}
            />
          </div>

          <InputPanel
            text={draft.text}
            onTextChange={draft.setText}
            onTranslate={() => {
              void translation.translateLangs([...selectedVisibleLangs]);
            }}
            onSave={() => {
              setSaveDialogOpen(true);
            }}
            translating={translation.translating}
            onCancel={translation.cancel}
            translateLabel={
              allVisibleCovered ? ja.translatedButton : undefined
            }
            translateDisabled={
              allVisibleCovered ||
              meter.usageExhausted ||
              floorBlocksPaid ||
              !isLlmModelId(draft.model) ||
              selectedVisibleLangs.length === 0 ||
              contextMissing
            }
            usageParts={meter.usageParts}
          />

            <CardSidebar
              cards={cardsState.cards}
              activeSlot={draft.activeSlot}
              onLoadCard={handleLoadCard}
            />
          </div>
        )}

        <section className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0">
          {/* The model's uncertainty list sits ABOVE the
              panels, level with the model picker in the input
              column: the operator is meant to notice it first and
              complete the Japanese source text, so the finished
              context reaches the workers — below the panels it was
              too easy to read past. Warning styling: bold red with
              the ⚠ mark, boxed — a red border on a translucent red
              background. */}
          {applicableResult && applicableResult.uncertain.length > 0 ? (
            <div className="rounded border-2 border-red-300 bg-red-50 px-4 py-3">
              <h3 className="text-sm font-bold text-red-700">
                <span aria-hidden="true">⚠ </span>
                {ja.uncertainTitle}
              </h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-red-900">
                {applicableResult.uncertain.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Panels stack vertically at one to three; at four
              they form a 2x2 grid, spending the width a hidden
              input column frees instead of quartering each
              panel's height. */}
          <div
            className={
              draft.panelCount === 4
                ? "grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2"
                : "flex flex-col gap-4 lg:min-h-0 lg:flex-1"
            }
          >
            {visibleLangs.map((code, index) => (
              <OutputPanel
                key={`${index}-${code}`}
                language={code}
                onLanguageChange={(nextCode) => {
                  draft.handlePanelLanguageChange(index, nextCode);
                }}
                disabledLanguages={selectedVisibleLangs.filter(
                  (other) => other !== code,
                )}
                entry={
                  code === "" ? undefined : applicableResult?.entries[code]
                }
                onTranslateLanguage={(target) => {
                  void translation.translateLangs([target]);
                }}
                translating={translation.translating}
                actionsDisabled={
                  meter.usageExhausted ||
                  floorBlocksPaid ||
                  !isLlmModelId(draft.model) ||
                  contextMissing
                }
                unsupportedLanguages={unsupportedLanguages}
              />
            ))}
          </div>

          {/* Remaining notices for the current result, under
              the panels: prohibition flag and glossary
              notice. The uncertainty list renders
              above the panels instead — see the top of this
              section. */}
          {applicableResult?.prohibition ? (
            <p className="text-sm font-semibold text-red-700">
              ⚠ {ja.prohibitionWarning}
            </p>
          ) : null}
          {applicableResult && applicableResult.glossarySkipped > 0 ? (
            <p className="text-sm text-neutral-600">
              {ja.glossarySkippedNotice}
            </p>
          ) : null}
        </section>
      </div>

      {saveDialogOpen ? (
        <SaveCardDialog
          cards={cardsState.cards}
          defaultSlot={defaultSaveSlot}
          defaultTitle={activeCard?.title ?? ""}
          onSave={handleSaveCard}
          onClearSlot={handleClearSlot}
          onClose={() => {
            setSaveDialogOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
