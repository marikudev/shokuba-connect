import {
  deriveCardStatus,
  type CardSlots,
  type CardStatus,
} from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";

// The card slots (twenty; the list
// scrolls when they overflow). Clicking a filled card loads it
// without any network call. The status is derived from the card's own
// stored data and shown as an icon plus text, never by colour alone.
const STATUS_PRESENTATION: Record<CardStatus, { icon: string; label: string }> = {
  empty: { icon: "○", label: ja.statusEmpty },
  saved: { icon: "●", label: ja.statusSaved },
  translated: { icon: "✓", label: ja.statusTranslated },
  stale: { icon: "⚠", label: ja.statusStale },
};

interface CardSidebarProps {
  cards: CardSlots;
  activeSlot: number | null;
  onLoadCard: (slotIndex: number) => void;
  // "rail": the narrow number-only strip shown while the input
  // column is hidden (display mode) — the operator can still
  // load any card by its number, which is all that mode needs.
  variant?: "full" | "rail";
}

export function CardSidebar({
  cards,
  activeSlot,
  onLoadCard,
  variant = "full",
}: CardSidebarProps) {
  if (variant === "rail") {
    return (
      <aside
        aria-label={ja.cardsTitle}
        className="flex min-h-0 w-16 shrink-0 flex-col"
      >
        <ol className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
          {cards.map((card, slotIndex) => {
            const status = deriveCardStatus(card);
            const presentation = STATUS_PRESENTATION[status];
            const isActive = slotIndex === activeSlot;
            const number = String(slotIndex + 1).padStart(2, "0");
            return (
              <li key={slotIndex}>
                <button
                  type="button"
                  disabled={!card}
                  onClick={() => {
                    onLoadCard(slotIndex);
                  }}
                  aria-current={isActive ? "true" : undefined}
                  aria-label={`${number} ${presentation.label}${
                    card?.title ? ` ${card.title}` : ""
                  }`}
                  title={card?.title ?? undefined}
                  className={`flex w-full flex-col items-center gap-0.5 rounded px-1 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700 ${
                    isActive
                      ? "bg-ink text-white"
                      : "border border-mist bg-white text-coal"
                  } ${!card ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span className="font-mono">{number}</span>
                  <span aria-hidden="true">{presentation.icon}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    );
  }

  return (
    // No visible heading since the follow-up (the slots
    // need the room); the aside keeps the name for assistive tech.
    // This list is the only part of the fixed page that scrolls.
    <aside
      aria-label={ja.cardsTitle}
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      {/* Guidance line above the slots : results are
          saved into the cards below via the 保存 button. */}
      <p className="pb-2 text-sm font-bold text-graphite">{ja.cardsGuideText}</p>
      {/* Two-column grid: the sidebar sits under the input
          in the left column, so the slots pair up side by side. */}
      <ol className="grid min-h-0 flex-1 grid-cols-2 content-start gap-1 overflow-y-auto pr-1">
        {cards.map((card, slotIndex) => {
          // The status is judged from this card's OWN stored
          // fields only (lib/cards deriveCardStatus) — never from
          // what the editor currently shows. An empty slot
          // renders as a disabled button: there is nothing to
          // load from it.
          const status = deriveCardStatus(card);
          const presentation = STATUS_PRESENTATION[status];
          const isActive = slotIndex === activeSlot;
          return (
            <li key={slotIndex}>
              <button
                type="button"
                disabled={!card}
                onClick={() => {
                  onLoadCard(slotIndex);
                }}
                aria-current={isActive ? "true" : undefined}
                className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700 ${
                  isActive
                    ? "bg-ink text-white"
                    : "border border-mist bg-white text-coal"
                } ${!card ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span className="font-mono">
                  {String(slotIndex + 1).padStart(2, "0")}
                </span>
                <span aria-hidden="true">{presentation.icon}</span>
                <span className="min-w-0">
                  <span className="block">{presentation.label}</span>
                  {card?.title ? (
                    <span className="block truncate">{card.title}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
