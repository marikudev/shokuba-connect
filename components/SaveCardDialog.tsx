"use client";

import { useEffect, useState } from "react";

import {
  deriveCardStatus,
  MAX_CARD_TITLE_LENGTH,
  type CardSlots,
} from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";

// the save dialog. The user picks one of the twenty slots and
// a title (max 20 characters, enforced with maxLength; REQUIRED since
//  — with twenty cards an untitled save is too hard to tell
// apart from the others). Saving over a filled slot needs an explicit
// overwrite confirmation step, and a filled slot can also be emptied
// (Kosongkan) after a confirmation step. This component is only
// mounted while the dialog is open, so its state starts fresh on
// every open.
interface SaveCardDialogProps {
  cards: CardSlots;
  defaultSlot: number;
  defaultTitle: string;
  onSave: (slotIndex: number, title: string) => void;
  onClearSlot: (slotIndex: number) => void;
  onClose: () => void;
}

// The dialog footer is a small state machine: normally it shows
// the action buttons; choosing overwrite or clear swaps in a
// confirmation step first, so a destructive action never fires
// on the first click. Picking a different slot resets the state
// to normal (see selectSlot below).
type Confirmation = "overwrite" | "clear" | null;

export function SaveCardDialog({
  cards,
  defaultSlot,
  defaultTitle,
  onSave,
  onClearSlot,
  onClose,
}: SaveCardDialogProps) {
  const [selectedSlot, setSelectedSlot] = useState(defaultSlot);
  // The initial title belongs to the initially selected slot: a
  // filled slot's own title, or blank for an empty one — the same
  // rule selectSlot applies on every later click .
  const [title, setTitle] = useState(() =>
    cards[defaultSlot] ? cards[defaultSlot].title : defaultTitle,
  );
  const [confirmation, setConfirmation] = useState<Confirmation>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const selectedCard = cards[selectedSlot] ?? null;
  const isOccupied = selectedCard !== null;
  // : no save without a title (whitespace alone does not
  // count). Both save paths — the empty-slot button and the overwrite
  // confirmation — are gated on this.
  const titleMissing = title.trim() === "";

  const selectSlot = (slotIndex: number) => {
    setSelectedSlot(slotIndex);
    setConfirmation(null);
    const card = cards[slotIndex];
    if (card) {
      // A filled slot, opened to edit it: prefill that card's
      // title when the field is empty, so the required field does
      // not force retyping what is already there.
      if (title.trim() === "") {
        setTitle(card.title);
      }
    } else {
      // An empty slot is a NEW card: its title field starts blank.
      // A title typed or prefilled for another slot must never
      // leak into it (user report, : card 1's title was
      // still sitting in the field after he clicked empty card 2).
      setTitle("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ja.saveDialogTitle}
        className="w-full max-w-md rounded-2xl border border-mist bg-white p-4 shadow-xl"
      >
        <h2 className="text-base font-semibold">{ja.saveDialogTitle}</h2>

        <ol className="mt-3 grid grid-cols-5 gap-1">
          {cards.map((card, slotIndex) => {
            const status = deriveCardStatus(card);
            const isSelected = slotIndex === selectedSlot;
            return (
              <li key={slotIndex}>
                <button
                  type="button"
                  onClick={() => {
                    selectSlot(slotIndex);
                  }}
                  aria-pressed={isSelected}
                  className={`w-full rounded px-1 py-2 text-center text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700 ${
                    isSelected
                      ? "bg-ink text-white"
                      : "border border-mist bg-white text-coal"
                  }`}
                >
                  <span className="block font-mono">
                    {String(slotIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="block">
                    {status === "empty"
                      ? ja.statusEmpty
                      : (card?.title ?? ja.statusSaved)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <label className="mt-4 flex flex-col gap-1 text-sm">
          {ja.titleLabel}
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            maxLength={MAX_CARD_TITLE_LENGTH}
            className="rounded border border-mist px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
          />
        </label>

        {confirmation === "overwrite" ? (
          <div className="mt-4 rounded border border-mist bg-paper p-3 text-sm text-ink">
            <p>{ja.overwriteWarning}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={titleMissing}
                onClick={() => {
                  onSave(selectedSlot, title);
                }}
                className="rounded bg-ink px-3 py-1 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ja.overwriteButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                }}
                className="rounded border border-neutral-400 px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
              >
                {ja.cancelButton}
              </button>
            </div>
          </div>
        ) : confirmation === "clear" ? (
          <div className="mt-4 rounded border border-mist bg-paper p-3 text-sm text-ink">
            <p>{ja.clearConfirmMessage}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onClearSlot(selectedSlot);
                }}
                className="rounded bg-red-700 px-3 py-1 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                {ja.clearButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmation(null);
                }}
                className="rounded border border-neutral-400 px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
              >
                {ja.cancelButton}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            {isOccupied ? (
              <>
                <button
                  type="button"
                  disabled={titleMissing}
                  onClick={() => {
                    setConfirmation("overwrite");
                  }}
                  className="rounded bg-ink px-3 py-1 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {ja.overwriteButton}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmation("clear");
                  }}
                  className="rounded border border-red-700 px-3 py-1 text-sm text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  {ja.clearButton}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={titleMissing}
                onClick={() => {
                  onSave(selectedSlot, title);
                }}
                className="rounded bg-ink px-3 py-1 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ja.saveConfirmButton}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-400 px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
            >
              {ja.cancelButton}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
