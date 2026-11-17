import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

import { SpeakButton } from "@/components/SpeakButton";
import type { PanelLangSelection } from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";
import { LANGUAGES, type LanguageCode } from "@/lib/languages";

// One output panel. The language dropdown starts on
// 言語を選択 (no language chosen, ) and lists the seven
// languages by their Japanese UI names; languages used by other
// visible panels are disabled so visible panels never duplicate.
// Changing the dropdown only changes local state — it never calls the
// API. A panel with no language chosen shows only the hint
// and is never translated. A panel whose language has no result for
// the current input shows 未翻訳 with a button that translates only
// that language; a failed language shows a 再試行 button instead.
export type PanelEntry =
  | {
      ok: true;
      text: string;
      numberMismatch?: boolean;
      prohibitionMissing?: boolean;
    }
  | { ok: false };

// Per-panel translation text sizes (rem) for the A− / A+ buttons
// : each panel is adjusted independently so a
// far reader's language can be enlarged without touching the others.
// The default step matches the fixed text-lg size. In
// fullscreen the clamp() rule in globals.css takes over.
const FONT_SIZE_STEPS_REM = [0.875, 1, 1.125, 1.375, 1.625, 2];
const DEFAULT_FONT_STEP = 2;

interface OutputPanelProps {
  language: PanelLangSelection;
  onLanguageChange: (code: PanelLangSelection) => void;
  disabledLanguages: readonly LanguageCode[];
  entry: PanelEntry | undefined;
  onTranslateLanguage: (code: LanguageCode) => void;
  translating: boolean;
  // when the account limit is exhausted, per-language actions
  // are disabled too (the page shows the reason).
  actionsDisabled?: boolean;
  // languages the currently selected model does not support
  // (the free model: Burmese). Such a language cannot be picked in
  // this panel's dropdown, and a panel already set to it shows the
  // blocking notice instead of any translate action — a stored
  // result from another model may still be displayed.
  unsupportedLanguages?: readonly LanguageCode[];
}

export function OutputPanel({
  language,
  onLanguageChange,
  disabledLanguages,
  entry,
  onTranslateLanguage,
  translating,
  actionsDisabled = false,
  unsupportedLanguages = [],
}: OutputPanelProps) {
  const selectId = useId();
  const panelRef = useRef<HTMLElement | null>(null);
  const [fontStep, setFontStep] = useState(DEFAULT_FONT_STEP);
  // While this panel is the fullscreen element, its button reads
  // 閉じる instead of 全画面 . Tracked via the
  // fullscreenchange event so leaving fullscreen with Esc also
  // restores the label.
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };
    document.addEventListener("fullscreenchange", update);
    update();
    return () => {
      document.removeEventListener("fullscreenchange", update);
    };
  }, []);

  // the fullscreen button only exists when the browser allows
  // fullscreen at all. Read as an external store (client-only
  // capability); the server snapshot keeps it hidden during SSR.
  const fullscreenEnabled = useSyncExternalStore(
    () => () => undefined,
    () => document.fullscreenEnabled === true,
    () => false,
  );

  const languageInfo =
    language === ""
      ? undefined
      : LANGUAGES.find((item) => item.code === language);

  // this panel's language is one the selected model does
  // not support. The blocking notice (with the language's Japanese
  // name filled in) replaces the translate/retry states below; a
  // successful stored entry is still shown, because it was produced
  // by a model that does support the language.
  const languageUnsupported =
    language !== "" && unsupportedLanguages.includes(language);
  const unsupportedNotice = languageInfo
    ? ja.unsupportedLanguageNotice.replace(
        "{language}",
        languageInfo.uiNameJa,
      )
    : "";

  const handleFullscreen = () => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    if (document.fullscreenElement === panel) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void panel.requestFullscreen().catch(() => undefined);
    }
  };

  return (
    <section
      ref={panelRef}
      data-language={language}
      style={
        {
          "--panel-text-size": `${FONT_SIZE_STEPS_REM[fontStep]}rem`,
        } as CSSProperties
      }
      className="output-panel flex min-h-[240px] min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-mist bg-white p-4 lg:min-h-0"
    >
      <div className="-mx-4 -mt-4 flex flex-wrap items-center gap-2 rounded-t-2xl bg-coal px-4 py-2.5 text-white">
        <label htmlFor={selectId} className="sr-only">
          {languageInfo?.uiNameJa ?? ja.panelLangSelectPrompt}
        </label>
        <select
          id={selectId}
          value={language}
          onChange={(event) => {
            onLanguageChange(event.target.value as PanelLangSelection);
          }}
          className="rounded border border-white/40 bg-graphite px-2 py-1 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          <option value="">{ja.panelLangSelectPrompt}</option>
          {LANGUAGES.map((item) => (
            <option
              key={item.code}
              value={item.code}
              disabled={
                disabledLanguages.includes(item.code) ||
                unsupportedLanguages.includes(item.code)
              }
            >
              {item.uiNameJa}
            </option>
          ))}
        </select>
        <h3 className="text-base font-semibold">
          {languageInfo?.panelLabel}
        </h3>
        <div className="ml-auto flex gap-2">
          {/* In fullscreen the header keeps only the 閉じる button
              : the reading view is for the workers, and
              font/copy controls belong to the operator's normal view.
              The fullscreen stylesheet already fixes the text size.
              The speak button is the one deliberate exception:
              listening belongs to the workers' reading view, so it
              stays available in fullscreen too. */}
          {!isFullscreen ? (
            <>
              <button
                type="button"
                aria-label={ja.fontSmallerLabel}
                disabled={fontStep <= 0}
                onClick={() => {
                  setFontStep((step) => Math.max(0, step - 1));
                }}
                className="rounded border border-white/50 px-2 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                A−
              </button>
              <button
                type="button"
                aria-label={ja.fontLargerLabel}
                disabled={fontStep >= FONT_SIZE_STEPS_REM.length - 1}
                onClick={() => {
                  setFontStep((step) =>
                    Math.min(FONT_SIZE_STEPS_REM.length - 1, step + 1),
                  );
                }}
                className="rounded border border-white/50 px-2 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                A+
              </button>
            </>
          ) : null}
          {entry?.ok && language !== "" ? (
            <SpeakButton code={language} text={entry.text} />
          ) : null}
          {fullscreenEnabled ? (
            <button
              type="button"
              onClick={handleFullscreen}
              className="rounded border border-white/50 px-3 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isFullscreen ? ja.closeButton : ja.fullscreenButton}
            </button>
          ) : null}
        </div>
      </div>

      {/* The body has exactly five states, in this order:
          1. no language chosen — the hint, nothing else;
          2. a successful result — the text plus any check
             warnings (number mismatch, prohibition missing);
          3. the panel's language is unsupported by the selected
             model — the blocking notice, replacing the
             translate/retry actions so this combination can never
             produce an official-looking translation;
          4. a failed result — the error plus a retry button;
          5. a language chosen but not yet translated for the
             current input — 未翻訳 plus a translate button that
             asks for this language only. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {language === "" ? (
          <p className="text-sm text-ash">
            {ja.panelSelectLanguageHint}
          </p>
        ) : entry?.ok ? (
          <div className="flex flex-col gap-2">
            <p
              className={`output-text leading-relaxed whitespace-pre-wrap ${
                language === "my" ? "font-output-my" : ""
              }`}
            >
              {entry.text}
            </p>
            {/* a number mismatch is a warning to review, never
                a claim that the translation is wrong. */}
            {entry.numberMismatch ? (
              <p className="text-sm font-semibold text-red-700">
                ⚠ {ja.numberMismatchWarning}
              </p>
            ) : null}
            {/* Target-side prohibition check : the source
                forbade something but this translation carries no
                prohibition marker in its language. */}
            {entry.prohibitionMissing ? (
              <p className="text-sm font-semibold text-red-700">
                ⚠ {ja.prohibitionMissingWarning}
              </p>
            ) : null}
          </div>
        ) : languageUnsupported ? (
          <p className="text-sm font-semibold text-coal">
            ⚠ {unsupportedNotice}
          </p>
        ) : entry ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm font-semibold text-red-700">
              {ja.errors.bad_output}
            </p>
            <button
              type="button"
              disabled={translating || actionsDisabled}
              onClick={() => {
                onTranslateLanguage(language);
              }}
              className="rounded bg-ink px-3 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ja.retryButton}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-ash">
              {ja.untranslatedLabel}
            </p>
            <button
              type="button"
              disabled={translating || actionsDisabled}
              onClick={() => {
                onTranslateLanguage(language);
              }}
              className="rounded bg-ink px-3 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ja.translateButton}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
