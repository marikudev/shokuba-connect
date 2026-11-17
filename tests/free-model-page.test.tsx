import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/chourei/page";
import {
  EMPTY_SESSION_DRAFT,
  storeAck,
  storeSessionDraft,
} from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";

// The free model at page level — its warning
// strip, its picker mark, the Burmese block, and the request filter.
// Sessions are seeded the way the home-page tests seed theirs: an
// acknowledged gate plus a stored draft naming the model and panels.
const FREE_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const PAID_MODEL = "google/gemma-4-31b-it";

function seedSession(model: string) {
  storeAck(window.sessionStorage, {
    acknowledgedAt: "T00:00:00.000Z",
  });
  storeSessionDraft(window.sessionStorage, {
    ...EMPTY_SESSION_DRAFT,
    text: "本日はテストです",
    division: "組立課",
    industry: "automotive",
    topic: "不具合",
    activeSlot: null,
    model,
    panelCount: 2,
    panelLangs: ["id", "my", "", ""] as ["id", "my", "", ""],
  });
}

// One fetch stub for every call the page makes (usage meter
// included); translate assertions filter by URL, as in the
// home-page tests.
function stubFetch() {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          results: {
            id: { ok: true, text: "Hari ini adalah tes." },
            my: { ok: true, text: "ယနေ့ စမ်းသပ်မှု" },
          },
          uncertain: [],
          sourceFlags: { prohibition: false },
          glossarySkipped: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function translateCalls(fetchMock: ReturnType<typeof stubFetch>) {
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return calls.filter(([url]) => String(url).includes("/api/translate"));
}

describe("Free model on the main page", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the warning strip while the free model is selected", async () => {
    seedSession(FREE_MODEL);
    stubFetch();
    render(<HomePage />);

    // The strip is visible — also for a choice restored from the
    // stored draft, which is what this seeded session is.
    expect(
      await screen.findByText(`⚠ ${ja.freeModelWarning}`),
    ).toBeInTheDocument();
    // The picker button shows the free model by its display name
    // (rich listbox).
    const picker = screen.getAllByRole("combobox")[2];
    expect(picker.textContent).toContain("Nemotron 3 Ultra 550B");
    expect(picker.textContent).toContain(ja.modelChipFree);
  });

  it("shows no warning strip for a paid model", async () => {
    seedSession(PAID_MODEL);
    stubFetch();
    render(<HomePage />);

    const picker = await screen.findByRole("combobox", {
      name: new RegExp("Gemma 4 31B"),
    }).catch(() => screen.getAllByRole("combobox")[2]);
    expect(picker.textContent).toContain("Gemma 4 31B");
    expect(screen.queryByText(`⚠ ${ja.freeModelWarning}`)).toBeNull();
  });

  it("blocks the Burmese panel and sends only supported languages", async () => {
    seedSession(FREE_MODEL);
    const fetchMock = stubFetch();
    render(<HomePage />);

    // The Burmese panel shows the blocking notice, not a button.
    const notice = ja.unsupportedLanguageNotice.replace(
      "{language}",
      "ミャンマー語",
    );
    expect(await screen.findByText(`⚠ ${notice}`)).toBeInTheDocument();

    // The MAIN translate button (inside the input section — an
    // untranslated panel has a button of the same name).
    const inputSection = screen
      .getByLabelText(ja.sourceLabel)
      .closest("section");
    if (!inputSection) {
      throw new Error("input section not found");
    }
    fireEvent.click(
      within(inputSection).getByRole("button", { name: ja.translateButton }),
    );

    await waitFor(() => {
      expect(translateCalls(fetchMock)).toHaveLength(1);
    });
    const [, init] = translateCalls(fetchMock)[0] as unknown as [
      string,
      RequestInit,
    ];
    const sent = JSON.parse(init.body as string) as {
      langs: string[];
      model: string;
    };
    expect(sent.model).toBe(FREE_MODEL);
    // Burmese was filtered out of the request entirely.
    expect(sent.langs).toEqual(["id"]);
  });
});
