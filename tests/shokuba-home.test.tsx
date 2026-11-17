import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ShokubaHomePage from "@/app/page";
import { storeAck } from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";

// The Shokuba Connect home: one shared gate for both products.
// With a consent record in this tab the gate is already passed
// and the home offers the product choice; without one, the gate
// (with its landing) is what renders.
describe("ShokubaHomePage — product choice after the shared gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("offers both products once the gate is passed", async () => {
    storeAck(window.sessionStorage, {
      acknowledgedAt: "2025-06-01T00:00:00.000Z",
    });
    render(<ShokubaHomePage />);

    expect(
      await screen.findByRole("heading", { name: ja.shokubaTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(ja.productHomeLead)).toBeInTheDocument();

    const openLinks = screen.getAllByRole("link", { name: ja.openButton });
    expect(openLinks).toHaveLength(2);
    expect(openLinks[0]).toHaveAttribute("href", "/chourei");
    expect(openLinks[1]).toHaveAttribute("href", "/mendan");
    expect(screen.getByText(ja.choureiTagline)).toBeInTheDocument();

    expect(screen.getByText(ja.mendanName)).toBeInTheDocument();
    expect(screen.getByText(ja.mendanComingLabel)).toBeInTheDocument();
    expect(screen.getByText(ja.mendanTagline)).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: ja.deleteSessionButton }),
    ).toBeInTheDocument();
  });

  it("shows the gate (not the product choice) without a consent record", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 401 })),
    );
    render(<ShokubaHomePage />);
    // The landing's start button is the gate flow's first step.
    expect(
      await screen.findByRole("button", { name: ja.homeStartButton }),
    ).toBeInTheDocument();
    expect(screen.queryByText(ja.productHomeLead)).toBeNull();
  });
});
