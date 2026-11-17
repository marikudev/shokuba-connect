"use client";

import { useEffect, useRef, useState } from "react";

import { ja } from "@/lib/i18n/ja";
import { LLM_MODELS, type LlmModelOption } from "@/lib/models";

// Rich model picker, ):
// replaces the plain <select> with an OpenRouter-style list — each
// model shows its provider's logo, a friendly name (the slug stays
// as small print), and badges （有料/無料， plus 割安 and おすすめ for
// Gemma 4), and GPT-6 Luna carries a one-line note explaining what
// it offers over Gemma 4 for its higher price. The picker is a
// listbox: the button shows the current choice (or the "choose a
// model" prompt while nothing is selected — the standing rule that
// no model is preselected, so no cost can occur by accident), and
// the popup lists the models from lib/models.ts metadata. All
// behaviour downstream (free-model warning strip, blocked
// languages, 翻訳済み re-arming on a model switch) reads the same
// selected id as before; only the choice widget changed.
//
// The provider logos are official SVG files (public/logos/,
// replacing the hand-drawn approximations this component started
// with). File names follow one pattern — <provider>-icon.svg.
function ProviderLogo({ option }: { option: LlmModelOption }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logos/${option.icon ?? option.provider}-icon.svg`}
      alt=""
      aria-hidden="true"
      className="h-6 w-6 shrink-0 object-contain"
    />
  );
}

// The badges for one model: paid/free first, then the value and
// recommended marks from its metadata.
function ModelChips({ option }: { option: LlmModelOption }) {
  return (
    <span className="flex shrink-0 flex-wrap items-center gap-1">
      <span className="rounded-full border border-mist px-1.5 py-px text-[11px] font-semibold text-graphite">
        {option.paid ? ja.modelChipPaid : ja.modelChipFree}
      </span>
      {option.reasoning ? (
        <span className="rounded-full border border-mist px-1.5 py-px text-[11px] font-semibold text-graphite">
          {ja.modelChipReasoning}
        </span>
      ) : null}
      {option.value ? (
        <span className="rounded-full border border-mist px-1.5 py-px text-[11px] font-semibold text-graphite">
          {ja.modelChipValue}
        </span>
      ) : null}
      {option.recommended ? (
        <span className="rounded-full bg-ink px-1.5 py-px text-[11px] font-semibold text-white">
          {ja.modelChipRecommended}
        </span>
      ) : null}
    </span>
  );
}

interface ModelPickerProps {
  id: string;
  value: string;
  onChange: (modelId: string) => void;
  // GC-06: while any credit layer blocks paid models (free-tier
  // account, $1 floor, or the session's 402 lock), paid options
  // render disabled and cannot be chosen by mouse or keyboard.
  // The page owns the state and shows the explaining banner.
  paidDisabled?: boolean;
}

export function ModelPicker({
  id,
  value,
  onChange,
  paidDisabled = false,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  // The keyboard-highlighted option while the list is open.
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = LLM_MODELS.find((option) => option.id === value);
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  // Close on any pointer press outside the picker.
  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open ]);

  // When the list opens, move focus into it for keyboard use.
  useEffect(() => {
    if (open) {
      listRef.current?.focus();
    }
  }, [open ]);

  // Opening the list highlights the current choice (or the first
  // model), so keyboard navigation starts where the operator is.
  const openList = () => {
    const currentIndex = LLM_MODELS.findIndex((option) => option.id === value);
    setActiveIndex(currentIndex >= 0 ? currentIndex : 0);
    setOpen(true);
  };

  const choose = (option: LlmModelOption) => {
    if (paidDisabled && option.paid) {
      return;
    }
    onChange(option.id);
    setOpen(false);
  };

  // Keyboard support for the open list: arrows move the highlight,
  // Enter/Space choose, Escape closes, Tab closes and moves on.
  const handleListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, LLM_MODELS.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(LLM_MODELS[activeIndex]);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openList();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            if (!open) {
              event.preventDefault();
              openList();
            }
          }
        }}
        className="flex w-full items-center gap-2 rounded border border-mist bg-white px-2 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
      >
        {selected ? (
          <>
            <ProviderLogo option={selected} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {selected.displayName}
            </span>
            <ModelChips option={selected} />
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-neutral-500">
            {ja.modelSelectPrompt}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-neutral-500"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ja.llmLabel}
          tabIndex={-1}
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={handleListKeyDown}
          className="absolute right-0 left-0 z-30 mt-1 min-w-[320px] rounded border border-mist bg-white py-1 shadow-lg focus-visible:outline-2 focus-visible:outline-neutral-700"
        >
          {LLM_MODELS.map((option, index) => {
            const note = ja.modelPickerNotes[option.id];
            const optionDisabled = paidDisabled && option.paid;
            return (
              <li
                key={option.id}
                id={optionId(index)}
                role="option"
                aria-selected={option.id === value}
                aria-disabled={optionDisabled || undefined}
                data-value={option.id}
                onClick={() => {
                  choose(option);
                }}
                onMouseEnter={() => {
                  setActiveIndex(index);
                }}
                className={`flex items-start gap-2.5 px-3 py-2 ${
                  optionDisabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                } ${index === activeIndex && !optionDisabled ? "bg-paper" : ""}`}
              >
                <span className="pt-0.5">
                  <ProviderLogo option={option} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{option.displayName}</span>
                    <ModelChips option={option} />
                  </span>
                  {/* Slug, with the model's short note (Luna's
                      price-tier phrase) beside it in the same
                      small size. */}
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-[11px]">
                    <span className="text-neutral-400">{option.id}</span>
                    {note ? (
                      <span className="text-neutral-500">{note}</span>
                    ) : null}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
