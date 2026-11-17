"use client";

import { useState } from "react";

// The context bar across the top of the main screen. It holds
// three things: the industry display, the two required context
// fields （部署 and 話題 — translation stays disabled until both
// are filled, so the model always knows what is being discussed),
// and, at the right end, the panel-count dropdown, the session
// expiry warning, and the delete-session button. Since the
// required marks became small red asterisks the
// whole bar fits on one line at desktop widths.

import type { PanelCount } from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";
import { MAX_DIVISION_LENGTH, MAX_TOPIC_LENGTH } from "@/lib/validate";

// the industry is automotive. Since //  it is presented as a dropdown to leave room for more
// industries later, and the extra entries are disabled "coming
// soon" placeholders — automotive remains the only working
// industry. Since the choice is REQUIRED: the dropdown
// opens on 業種を選択 and the page reads the value to keep every
// translate action disabled until a real industry is chosen (the
// value itself still changes nothing else — automotive is the only
// industry the app serves). division (max 50 characters) and
// topic (max 100 characters) are optional free-text fields. The limits
// are enforced with the maxLength attribute.
// the delete-session button sits at the right end of this bar
// and needs a two-step confirmation before anything is deleted.
interface ContextBarProps {
  // The industry choice : a controlled value owned by
  // the page (through the draft hook) — "" while the operator has
  // not chosen, which keeps every translate action disabled.
  industry: string;
  onIndustryChange: (value: string) => void;
  division: string;
  topic: string;
  onDivisionChange: (value: string) => void;
  onTopicChange: (value: string) => void;
  onDeleteSession: () => void;
  // The panel-count toggle lives in this bar.
  panelCount: PanelCount;
  onPanelCountChange: (count: PanelCount) => void;
  // The input-column show/hide toggle: it lives in this bar so
  // it stays visible and in the same place in BOTH modes —
  // hiding the column it controls must never hide the way back.
  sidebarHidden: boolean;
  onToggleSidebar: () => void;
  // Expiry reminder text : shown only during the last
  // hour of the session; null hides it.
  sessionWarning?: string | null;
}

export function ContextBar({
  industry,
  onIndustryChange,
  division,
  topic,
  onDivisionChange,
  onTopicChange,
  onDeleteSession,
  panelCount,
  onPanelCountChange,
  sidebarHidden,
  onToggleSidebar,
  sessionWarning,
}: ContextBarProps) {
  const [deleteArmed, setDeleteArmed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-mist bg-white px-4 py-3">
      {/* The input-column show/hide toggle sits at the far
          left of the bar, beside the industry field: a
          black block (the output panels' header colour) with
          white bold text on two stacked lines; its accessible
          name stays the full label. */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-pressed={sidebarHidden}
        aria-label={sidebarHidden ? ja.sidebarShowLabel : ja.sidebarHideLabel}
        className="flex flex-col items-center rounded-lg bg-coal px-3 py-1.5 leading-tight text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
      >
        <span className="text-xs font-bold">{ja.sidebarToggleLine1}</span>
        <span className="text-xs font-bold">
          {sidebarHidden ? ja.sidebarShowLine2 : ja.sidebarHideLine2}
        </span>
      </button>
      <label className="flex items-center gap-2 text-sm">
        <span className="font-bold">
          {ja.industryLabel}
          {/* Required: same small red asterisk as
              division and topic. */}
          <sup aria-hidden="true" className="ml-0.5 font-bold text-red-600">
            *
          </sup>
        </span>
        <select
          aria-required="true"
          value={industry}
          onChange={(event) => {
            onIndustryChange(event.target.value);
          }}
          className="rounded border border-mist px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
        >
          <option value="">{ja.industryPlaceholder}</option>
          <option value="automotive">{ja.industryValue}</option>
          {/* Coming-soon industries, in display order:
              manufacturing, construction, food processing,
              others — all disabled placeholders. */}
          <option value="manufacturing" disabled>
            {ja.industryManufacturingSoon}
          </option>
          <option value="construction" disabled>
            {ja.industryConstructionSoon}
          </option>
          <option value="food-processing" disabled>
            {ja.industryFoodProcessingSoon}
          </option>
          <option value="others" disabled>
            {ja.industryOthersSoon}
          </option>
        </select>
      </label>
      {/* Labels sit beside their inputs on one line  so the bar takes one row of height. */}
      <label className="flex items-center gap-2 text-sm">
        <span className="font-bold">
          {ja.divisionLabel}
          {/* Required marker: a small red superscript asterisk
              — it replaced the （必須） suffix so this bar,
              delete-session button included, fits on one line. */}
          <sup aria-hidden="true" className="ml-0.5 font-bold text-red-600">
            *
          </sup>
        </span>
        <input
          type="text"
          aria-required="true"
          value={division}
          onChange={(event) => {
            onDivisionChange(event.target.value);
          }}
          maxLength={MAX_DIVISION_LENGTH}
          placeholder={ja.divisionPlaceholder}
          className="w-48 rounded border border-mist px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="font-bold">
          {ja.topicLabel}
          <sup aria-hidden="true" className="ml-0.5 font-bold text-red-600">
            *
          </sup>
        </span>
        <input
          type="text"
          aria-required="true"
          value={topic}
          onChange={(event) => {
            onTopicChange(event.target.value);
          }}
          maxLength={MAX_TOPIC_LENGTH}
          placeholder={ja.topicPlaceholder}
          className="w-48 rounded border border-mist px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
        />
      </label>
      <div className="ml-auto flex items-center gap-2">
        {/* Panel count : a
            dropdown instead of the three toggle buttons, fully
            controlled by the page's panelCount — so when loading
            a card resizes the panel area, this dropdown follows
            (the first version kept its own local state and could
            show 2枚 while three panels stood on screen). It has
            no unselected option: a fresh session starts on 2枚. */}
        <label className="flex items-center gap-2 text-sm">
          <span className="font-bold">{ja.displayLabel}</span>
          <select
            aria-label={ja.displayLabel}
            value={String(panelCount)}
            onChange={(event) => {
              onPanelCountChange(
                Number(event.target.value) as PanelCount,
              );
            }}
            className="rounded border border-mist px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
          >
            <option value="1">{ja.panelCount1}</option>
            <option value="2">{ja.panelCount2}</option>
            <option value="3">{ja.panelCount3}</option>
            <option value="4">{ja.panelCount4}</option>
          </select>
        </label>
      </div>
      {sessionWarning ? (
        <p role="status" className="text-sm font-semibold text-coal">
          {sessionWarning}
        </p>
      ) : null}
      <div>
        {deleteArmed ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-red-700">
              {ja.deleteSessionConfirmMessage}
            </span>
            <button
              type="button"
              onClick={() => {
                setDeleteArmed(false);
                onDeleteSession();
              }}
              className="rounded bg-red-700 px-3 py-1 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              {ja.deleteConfirmButton}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteArmed(false);
              }}
              className="rounded border border-neutral-400 px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
            >
              {ja.cancelButton}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDeleteArmed(true);
            }}
            className="rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            {ja.deleteSessionButton}
          </button>
        )}
      </div>
    </div>
  );
}
