import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardSidebar } from "@/components/CardSidebar";
import { createEmptyCards, saveCard, type CardData } from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";

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
  results: { id: "Hari ini adalah tes" },
  translatedSource: { ...source },
};

describe("CardSidebar", () => {
  it("shows each status as icon plus text, never colour alone", () => {
    let cards = saveCard(createEmptyCards(), 0, savedCard);
    cards = saveCard(cards, 1, translatedCard);
    cards = saveCard(cards, 2, {
      ...translatedCard,
      text: "編集された文",
    });

    render(
      <CardSidebar
        cards={cards}
        activeSlot={null}
        onLoadCard={() => undefined}
      />,
    );

    expect(screen.getAllByText(ja.statusEmpty).length).toBeGreaterThan(0);
    expect(screen.getByText(ja.statusSaved)).toBeInTheDocument();
    expect(screen.getByText(ja.statusTranslated)).toBeInTheDocument();
    expect(screen.getByText(ja.statusStale)).toBeInTheDocument();
    expect(screen.getByText("朝礼1")).toBeInTheDocument();
  });

  it("a stored translated card keeps its check mark even as the active slot", () => {
    // The badge describes what is stored on the card ;
    // nothing about the editor can change it.
    const cards = saveCard(createEmptyCards(), 0, translatedCard);
    render(
      <CardSidebar
        cards={cards}
        activeSlot={0}
        onLoadCard={() => undefined}
      />,
    );
    expect(screen.getByText(ja.statusTranslated)).toBeInTheDocument();
    expect(screen.queryByText(ja.statusStale)).toBeNull();
  });

  it("loads a filled card on click and keeps empty slots disabled", () => {
    const onLoadCard = vi.fn();
    const cards = saveCard(createEmptyCards(), 4, savedCard);
    render(
      <CardSidebar
        cards={cards}
        activeSlot={null}
        onLoadCard={onLoadCard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /朝礼1/ }));
    expect(onLoadCard).toHaveBeenCalledWith(4);

    const emptyButton = screen.getByRole("button", { name: /01/ });
    expect(emptyButton).toBeDisabled();
  });
});
