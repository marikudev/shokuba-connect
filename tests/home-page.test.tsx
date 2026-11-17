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
  STORAGE_KEYS,
  createEmptyCards,
  loadSessionDraft,
  loadSessionStart,
  saveCard,
  storeAck,
  storeCards,
  storeSessionDraft,
  storeSessionStart,
  type CardData,
} from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";

const source = { text: "本日はテストです", division: "組立課", topic: "不具合" };

const savedCard: CardData = {
  ...source,
  title: "朝礼1",
  results: {},
  translatedSource: null,
};

function seedAck() {
  storeAck(window.sessionStorage, {
    acknowledgedAt: "T00:00:00.000Z",
  });
}

function seedDraft(activeSlot: number | null) {
  storeSessionDraft(window.sessionStorage, {
    ...EMPTY_SESSION_DRAFT,
    ...source,
    activeSlot,
    // A session in which the operator has already picked a model
    // (since the picker starts unselected; the picker
    // test below reseeds with "" for the fresh-session state).
    model: "google/gemma-4-31b-it",
    // Same for the panels: this session already picked two panels
    // and their languages (since a fresh session starts
    // with two panels and no language chosen).
    panelCount: 2,
    panelLangs: ["id", "my", "pt", ""] as ["id", "my", "pt", ""],
    // Since the industry is a required choice too;
    // this session already picked the one working industry.
    industry: "automotive",
  });
}

// Panel language selects: the industry dropdown, the panel-count
// dropdown and the model picker are also comboboxes and come first
// in the document, so panel selects start at index 3.
function panelSelects(): HTMLElement[] {
  return screen.getAllByRole("combobox").slice(3);
}

// The panel-count dropdown (a select, replacing
// the three toggle buttons): combobox index 1, values "1"|"2"|"3"|"4".
function choosePanelCount(count: string) {
  fireEvent.change(screen.getAllByRole("combobox")[1], {
    target: { value: count },
  });
}

// Since a fresh session starts with no model selected;
// tests that translate from a fresh render pick a model first, the
// way the operator now has to. Combobox order: industry, panel
// count, model, panel selects. Since the model picker
// is a rich listbox (components/ModelPicker.tsx): open it, then
// click the option carrying the model's display name.
function chooseModel(displayName: string) {
  fireEvent.click(screen.getAllByRole("combobox")[2]);
  fireEvent.click(
    screen.getByRole("option", { name: new RegExp(displayName) }),
  );
}

function chooseGemmaModel() {
  chooseModel("Gemma 4 31B");
}

// A fresh session opens with two panels and no language chosen
// (panel default 2; it was one before); tests
// that translate in two languages from scratch
// perform the operator's setup steps: two panels, id + my, and —
// — the now-required division and topic.
function preparePanelsIdMy() {
  // The industry dropdown is the first combobox;
  // a fresh session must pick 自動車 before translation enables.
  fireEvent.change(screen.getAllByRole("combobox")[0], {
    target: { value: "automotive" },
  });
  choosePanelCount("2");
  const selects = screen.getAllByRole("combobox");
  fireEvent.change(selects[3], { target: { value: "id" } });
  fireEvent.change(selects[4], { target: { value: "my" } });
  fireEvent.change(screen.getByPlaceholderText(ja.divisionPlaceholder), {
    target: { value: "組立課" },
  });
  fireEvent.change(screen.getByPlaceholderText(ja.topicPlaceholder), {
    target: { value: "不具合" },
  });
}

// The main translate button lives in the input section; the panels have
// their own per-language translate buttons with the same label.
function inputSection() {
  const section = screen.getByLabelText(ja.sourceLabel).closest("section");
  if (!section) {
    throw new Error("input section not found");
  }
  return within(section);
}

// The page also calls /api/usage once the gate opens and after
// every translation, so translate assertions filter the fetch calls by
// URL instead of counting all of them.
function translateCalls(
  fetchMock: ReturnType<typeof mockTranslateFetch>,
) {
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return calls.filter(([url]) => String(url).includes("/api/translate"));
}

function mockTranslateFetch(
  results: Record<string, { ok: boolean; text?: string }>,
) {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          results,
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

describe("HomePage session behaviour", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    seedAck();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("restores cards and the input draft after a refresh", async () => {
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 2, savedCard),
    );
    seedDraft(2);

    render(<HomePage />);

    // The draft comes back into the editor and the card into the sidebar.
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    expect(screen.getByDisplayValue(source.division)).toBeInTheDocument();
    expect(screen.getByText("朝礼1")).toBeInTheDocument();
    expect(screen.getByText(ja.statusSaved)).toBeInTheDocument();
  });

  it("offers a fourth panel, laid out as a 2x2 grid", async () => {
    seedDraft(null);
    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    choosePanelCount("4");
    // Four panel language dropdowns now stand on screen, and
    // their container lays them out in two columns instead of
    // the vertical stack used at one to three panels.
    expect(panelSelects()).toHaveLength(4);
    expect(
      panelSelects()[0].closest('div[class*="grid-cols-2"]'),
    ).not.toBeNull();
  });

  it("display mode: hiding the input column leaves a card rail that still loads cards", async () => {
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 2, savedCard),
    );
    seedDraft(null);
    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: ja.sidebarHideLabel }),
    );
    // The input column is gone — no source textarea, no model
    // picker — and the toggle now offers the way back. (The
    // per-panel translate buttons stay: they belong to the
    // panels, not the column.)
    expect(screen.queryByDisplayValue(source.text)).toBeNull();
    expect(screen.queryByText(ja.llmLabel)).toBeNull();
    expect(
      screen.getByRole("button", { name: ja.sidebarShowLabel }),
    ).toBeInTheDocument();
    // The rail still lists all twenty slots by number, and the
    // filled slot loads its card from the rail.
    const rail = screen.getByLabelText(ja.cardsTitle);
    expect(within(rail).getAllByRole("button")).toHaveLength(20);
    const slotButton = within(rail).getByRole("button", { name: /03/ });
    expect(slotButton).not.toHaveAttribute("aria-current");
    fireEvent.click(slotButton);
    expect(slotButton).toHaveAttribute("aria-current", "true");
    // Showing the column again restores the full editor.
    fireEvent.click(
      screen.getByRole("button", { name: ja.sidebarShowLabel }),
    );
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    expect(screen.getByText("朝礼1")).toBeInTheDocument();
  });

  it("adopts cards another tab saves, via the storage event ", async () => {
    seedDraft(2);
    render(<HomePage />);
    // Hydration finished (the draft is back in the editor) and this
    // tab's sidebar does not have the card yet.
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    expect(screen.queryByText("朝礼1")).not.toBeInTheDocument();

    // Another tab saves a card; the browser reports the write here.
    const external = saveCard(createEmptyCards(), 0, savedCard);
    fireEvent(
      window,
      new StorageEvent("storage", {
        key: STORAGE_KEYS.cards,
        newValue: JSON.stringify(external),
      }),
    );

    expect(await screen.findByText("朝礼1")).toBeInTheDocument();
  });

  it("re-reads the cards when the tab regains focus ", async () => {
    seedDraft(2);
    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    expect(screen.queryByText("朝礼1")).not.toBeInTheDocument();

    // A write this tab never got an event for (or got before it
    // started listening) is picked up when the tab regains focus.
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 1, savedCard),
    );
    fireEvent(window, new Event("focus"));

    expect(await screen.findByText("朝礼1")).toBeInTheDocument();
  });

  it("asks for the browser leave confirmation while a session is active ", async () => {
    render(<HomePage />);
    expect(
      await screen.findByText(ja.deleteSessionButton),
    ).toBeInTheDocument();

    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("warns during the last hour before the session expires ", async () => {
    // The key was pasted 23.5 hours ago: 30 minutes remain.
    storeSessionStart(
      window.localStorage,
      Date.now() - (24 * 60 - 30) * 60_000,
    );
    render(<HomePage />);

    expect(await screen.findByText(/残り約30分/)).toBeInTheDocument();
  });

  it("shows no expiry warning while plenty of session remains ", async () => {
    storeSessionStart(window.localStorage, Date.now() - 60_000);
    render(<HomePage />);

    expect(
      await screen.findByText(ja.deleteSessionButton),
    ).toBeInTheDocument();
    expect(screen.queryByText(/有効期限まで残り/)).toBeNull();
  });

  it("saves the current input to a slot through the dialog and persists it", async () => {
    render(<HomePage />);
    const textarea = await screen.findByLabelText(ja.sourceLabel);
    fireEvent.change(textarea, { target: { value: "新しい連絡文です" } });

    fireEvent.click(screen.getByRole("button", { name: ja.saveButton }));
    expect(
      screen.getByRole("dialog", { name: ja.saveDialogTitle }),
    ).toBeInTheDocument();
    // Since the title is required: the confirm button
    // stays disabled until one is typed.
    expect(
      screen.getByRole("button", { name: ja.saveConfirmButton }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText(ja.titleLabel), {
      target: { value: "新しい連絡" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: ja.saveConfirmButton }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: ja.saveDialogTitle }),
      ).toBeNull();
    });
    expect(screen.getByText(ja.statusSaved)).toBeInTheDocument();
    const stored = window.localStorage.getItem(STORAGE_KEYS.cards);
    expect(stored).toContain("新しい連絡文です");
  });

  it("delete session removes every chourei key and returns to the gate", async () => {
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 0, savedCard),
    );
    seedDraft(0);

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: ja.deleteSessionButton }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: ja.deleteConfirmButton }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEYS.cards)).toBeNull();
    });
    expect(window.sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEYS.ack)).toBeNull();
    expect(screen.queryByDisplayValue(source.text)).toBeNull();
    expect(screen.queryByText("朝礼1")).toBeNull();
    // with the ack gone, the visitor is back at the start —
    // that is the home screen, whose button leads
    // to the key gate.
    fireEvent.click(
      await screen.findByRole("button", { name: ja.homeStartButton }),
    );
    expect(
      screen.getByRole("button", { name: ja.startButton }),
    ).toBeInTheDocument();
    // Regression : after deleting the session the gate
    // must offer the API-key field again — the logout is awaited
    // before the gate mounts, so the stored-key probe cannot race it
    // and leave the gate stuck on the "key stored" state.
    expect(screen.getByLabelText(ja.apiKeyLabel)).toBeInTheDocument();
    expect(screen.queryByText(ja.storedKeyNote)).toBeNull();
  });
});

describe("HomePage access gate", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the gate instead of the app when no ack is stored", async () => {
    render(<HomePage />);
    // Since a keyless visitor meets the home screen
    // first; its start button leads to the key gate.
    fireEvent.click(
      await screen.findByRole("button", { name: ja.homeStartButton }),
    );
    expect(
      await screen.findByRole("button", { name: ja.startButton }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(ja.sourceLabel)).toBeNull();
  });

  it("does not ask for a leave confirmation at the gate ", async () => {
    render(<HomePage />);
    // Through the home screen to the gate itself.
    fireEvent.click(
      await screen.findByRole("button", { name: ja.homeStartButton }),
    );
    expect(
      await screen.findByRole("button", { name: ja.startButton }),
    ).toBeInTheDocument();

    const event = new Event("beforeunload", { cancelable: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("records the session start when a fresh key is verified ", async () => {
    const fetchMock = vi.fn(
      async (url: unknown, init?: RequestInit) => {
        if (String(url).includes("/api/verify")) {
          return new Response(null, {
            status: init?.method === "POST" ? 204 : 401,
          });
        }
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<HomePage />);
    // Through the home screen to the key form.
    fireEvent.click(
      await screen.findByRole("button", { name: ja.homeStartButton }),
    );
    fireEvent.click(await screen.findByLabelText(ja.consentLabel));
    fireEvent.change(await screen.findByLabelText(ja.apiKeyLabel), {
      target: {
        value:
          "sk-or-v1-testkey0123456789abcdef0123456789abcdef01234567",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: ja.startButton }));

    await waitFor(() => {
      expect(loadSessionStart(window.localStorage)).not.toBeNull();
    });
    expect(loadSessionStart(window.localStorage)).toBeGreaterThan(
      Date.now() - 60_000,
    );
  });
});

describe("HomePage translation", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    seedAck();
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 0, savedCard),
    );
    seedDraft(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the results and marks the active card translated", async () => {
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();

    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );

    expect(await screen.findByText("ID text")).toBeInTheDocument();
    expect(screen.getByText("MY text")).toBeInTheDocument();
    // The active card's status flips to 翻訳済み (the same word also
    // labels the main button, so scope to the card button).
    const cardButton = screen.getByRole("button", { name: /朝礼1/ });
    expect(
      within(cardButton).getByText(ja.statusTranslated),
    ).toBeInTheDocument();

    const stored = window.localStorage.getItem(STORAGE_KEYS.cards);
    expect(stored).toContain("ID text");

    const [, init] = translateCalls(fetchMock)[0] as unknown as [
      string,
      RequestInit,
    ];
    const headers = init.headers as Record<string, string>;
    // The browser authenticates with the httpOnly cookie that holds
    // the user's key (BYOK, ); no key is sent from the page
    // in a header or the body.
    expect(headers["x-api-key"]).toBeUndefined();
    expect(JSON.parse(init.body as string)).toMatchObject({
      text: source.text,
      langs: ["id", "my"],
      // Model restored from the seeded session draft.
      model: "google/gemma-4-31b-it",
    });
  });

  it("returns to the gate when the translate call answers 401", async () => {
    // Only the translate call is unauthorized; the usage probe
    // answers normally (since a 401 from /api/usage ends
    // the session on its own — that path has its own test below).
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        if (String(url).includes("/api/usage")) {
          return new Response(JSON.stringify({ unavailable: true }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        });
      }),
    );

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();

    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );

    expect(
      await screen.findByRole("button", { name: ja.startButton }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(STORAGE_KEYS.ack)).toBeNull();
    expect(screen.getByText(ja.errors.unauthorized)).toBeInTheDocument();
  });

  it("returns to the gate when the stored ack has no live session (usage answers 401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
          }),
      ),
    );

    render(<HomePage />);

    // The mount-time usage probe finds the session cookie gone or
    // expired, so the ack alone no longer opens the app .
    expect(
      await screen.findByRole("button", { name: ja.startButton }),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(STORAGE_KEYS.ack)).toBeNull();
    expect(screen.getByText(ja.errors.unauthorized)).toBeInTheDocument();
  });
});

describe("HomePage panels", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    seedAck();
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 0, savedCard),
    );
    seedDraft(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("after a full translation the main button becomes 翻訳済み and stays disabled until the input changes", async () => {
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();

    const doneButton = inputSection().getByRole("button", {
      name: ja.translatedButton,
    });
    expect(doneButton).toBeDisabled();
    expect(translateCalls(fetchMock)).toHaveLength(1);

    fireEvent.change(screen.getByLabelText(ja.sourceLabel), {
      target: { value: "別の連絡文です" },
    });
    expect(
      inputSection().getByRole("button", { name: ja.translateButton }),
    ).toBeEnabled();
  });

  it("switching the model after 翻訳済み re-arms 翻訳する for the new model ", async () => {
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(
      await inputSection().findByRole("button", {
        name: ja.translatedButton,
      }),
    ).toBeDisabled();
    expect(translateCalls(fetchMock)).toHaveLength(1);

    // Change the model: the same input may now be translated again,
    // with the new model.
    chooseModel("GPT-6 Luna");
    const rearmed = inputSection().getByRole("button", {
      name: ja.translateButton,
    });
    expect(rearmed).toBeEnabled();
    fireEvent.click(rearmed);
    await waitFor(() => {
      expect(translateCalls(fetchMock)).toHaveLength(2);
    });
    const [, init] = translateCalls(fetchMock)[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).model).toBe(
      "openai/gpt-6-luna",
    );
    expect(
      await inputSection().findByRole("button", {
        name: ja.translatedButton,
      }),
    ).toBeDisabled();
  });

  it("industry, division and topic are required: translation stays disabled until all are set (industry added )", async () => {
    mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    const translateButton = () =>
      inputSection().getByRole("button", { name: ja.translateButton });
    expect(translateButton()).toBeEnabled();

    // Clear the division: no translation, even though text, model,
    // and panel languages are all set.
    const divisionInput = screen.getByDisplayValue(source.division);
    fireEvent.change(divisionInput, { target: { value: "" } });
    expect(translateButton()).toBeDisabled();
    // Whitespace alone does not count as filled.
    fireEvent.change(divisionInput, { target: { value: " " } });
    expect(translateButton()).toBeDisabled();
    fireEvent.change(divisionInput, { target: { value: "組立課" } });
    expect(translateButton()).toBeEnabled();

    // Same for the topic.
    fireEvent.change(screen.getByDisplayValue(source.topic), {
      target: { value: "" },
    });
    expect(translateButton()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(ja.topicPlaceholder), {
      target: { value: source.topic },
    });
    expect(translateButton()).toBeEnabled();

    // And for the industry : back on the 業種を選択
    // prompt, no translation; picking 自動車 re-enables it.
    const industrySelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(industrySelect, { target: { value: "" } });
    expect(translateButton()).toBeDisabled();
    fireEvent.change(industrySelect, {
      target: { value: "automotive" },
    });
    expect(translateButton()).toBeEnabled();
  });

  it("switching to three panels requests all three visible languages in one call", async () => {
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
      pt: { ok: true, text: "PT text" },
    });

    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();

    choosePanelCount("3");
    expect(panelSelects()).toHaveLength(3);
    // The panel choice is part of the persisted session draft.
    await waitFor(() => {
      expect(
        loadSessionDraft(window.sessionStorage)?.panelCount,
      ).toBe(3);
    });

    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("PT text")).toBeInTheDocument();
    expect(translateCalls(fetchMock)).toHaveLength(1);
    const [, init] = translateCalls(fetchMock)[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).langs).toEqual([
      "id",
      "my",
      "pt",
    ]);
  });

  it("changing a panel language never calls the API; the panel button translates only that language", async () => {
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
      vi: { ok: true, text: "VI text" },
    });

    const { container } = render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();
    expect(translateCalls(fetchMock)).toHaveLength(1);

    const selects = panelSelects();
    fireEvent.change(selects[1], { target: { value: "vi" } });
    const viPanel = container.querySelector('[data-language="vi"]');
    if (!viPanel) {
      throw new Error("vi panel not found");
    }
    expect(
      within(viPanel as HTMLElement).getByText(ja.untranslatedLabel),
    ).toBeInTheDocument();
    expect(translateCalls(fetchMock)).toHaveLength(1);

    fireEvent.click(
      within(viPanel as HTMLElement).getByRole("button", {
        name: ja.translateButton,
      }),
    );
    expect(
      await within(viPanel as HTMLElement).findByText("VI text"),
    ).toBeInTheDocument();
    expect(translateCalls(fetchMock)).toHaveLength(2);
    const [, init] = translateCalls(fetchMock)[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).langs).toEqual(["vi"]);
  });

  it("loading a card points the panels at the languages it has results for", async () => {
    const translatedCard: CardData = {
      ...source,
      title: "翻訳済みカード",
      results: { id: "ID text", vi: "VI text" },
      translatedSource: { ...source },
    };
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 1, translatedCard),
    );
    seedDraft(null);

    render(<HomePage />);
    expect(
      await screen.findByRole("button", { name: /翻訳済みカード/ }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /翻訳済みカード/ }),
    );

    const selects = panelSelects();
    expect(selects).toHaveLength(2);
    expect((selects[0] as HTMLSelectElement).value).toBe("id");
    expect((selects[1] as HTMLSelectElement).value).toBe("vi");
    expect(screen.getByText("VI text")).toBeInTheDocument();
  });

  it("warns on a loaded card whose stored translation lost the prohibition ", async () => {
    const dangerSource = {
      text: "手を入れないでください",
      division: "",
      topic: "",
    };
    const dangerCard: CardData = {
      ...dangerSource,
      title: "危険カード",
      results: { id: "Harap berhati-hati saat memasukkan tangan" },
      translatedSource: { ...dangerSource },
    };
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 3, dangerCard),
    );
    seedDraft(null);

    render(<HomePage />);
    fireEvent.click(
      await screen.findByRole("button", { name: /危険カード/ }),
    );

    // The stored Indonesian text carries no prohibition marker, so
    // the panel warns — recomputed locally, no request involved.
    expect(
      await screen.findByText(`⚠ ${ja.prohibitionMissingWarning}`),
    ).toBeInTheDocument();
  });

  it("model picker: starts unselected, gates translation until a model is chosen, then persists and sends the choice ", async () => {
    // Reseed without a model choice, as a fresh session starts.
    storeSessionDraft(window.sessionStorage, {
      ...EMPTY_SESSION_DRAFT,
      ...source,
      activeSlot: 0,
      model: "",
    });
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });
    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();

    // Combobox order: industry dropdown, panel-count dropdown,
    // model picker, panel selects. Since the picker is
    // a rich listbox: closed, it shows the prompt; opened, it
    // lists logo + friendly name + badges.
    const modelPicker = screen.getAllByRole("combobox")[2];
    expect(modelPicker.textContent).toContain(ja.modelSelectPrompt);
    fireEvent.click(modelPicker);
    // Other selects on the page contribute their own <option>s;
    // the picker's options are the ones carrying a model id.
    const options = screen
      .getAllByRole("option")
      .filter((option) => option.dataset.value !== undefined);
    // Picker order: free model, Gemma 4, Luna.
    expect(options.map((option) => option.dataset.value)).toEqual([
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "google/gemma-4-31b-it",
      "openai/gpt-6-luna",
    ]);
    expect(options[0].textContent).toContain("Nemotron 3 Ultra 550B");
    expect(options[0].textContent).toContain(ja.modelChipFree);
    expect(options[1].textContent).toContain("Gemma 4 31B");
    expect(options[1].textContent).toContain(ja.modelChipValue);
    // Gemma does not wear the おすすめ badge (GPT-6 Luna does).
    expect(options[1].textContent).not.toContain(ja.modelChipRecommended);
    expect(options[2].textContent).toContain("GPT-6 Luna");
    expect(options[2].textContent).toContain(ja.modelChipRecommended);
    expect(options[2].textContent).toContain(
      ja.modelPickerNotes["openai/gpt-6-luna"],
    );

    // No model chosen: the translate button is disabled and no
    // request can leave, so no tokens can be spent by accident.
    const translateButton = inputSection().getByRole("button", {
      name: ja.translateButton,
    });
    expect(translateButton).toBeDisabled();
    fireEvent.click(translateButton);
    expect(translateCalls(fetchMock)).toHaveLength(0);

    fireEvent.click(options[2]);
    await waitFor(() => {
      expect(loadSessionDraft(window.sessionStorage)?.model).toBe(
        "openai/gpt-6-luna",
      );
    });
    // Since a panel language must also be chosen before
    // anything can be translated (fresh sessions start unselected).
    preparePanelsIdMy();
    expect(
      inputSection().getByRole("button", { name: ja.translateButton }),
    ).not.toBeDisabled();

    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();
    const [, init] = translateCalls(fetchMock)[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).model).toBe(
      "openai/gpt-6-luna",
    );
  });
});

describe("HomePage card storage ", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    seedAck();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function saveViaDialog(slotLabel: string | null) {
    fireEvent.click(screen.getByRole("button", { name: ja.saveButton }));
    const dialog = await screen.findByRole("dialog", {
      name: ja.saveDialogTitle,
    });
    if (slotLabel !== null) {
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: new RegExp(slotLabel),
        }),
      );
    }
    // The title is required.
    fireEvent.change(within(dialog).getByLabelText(ja.titleLabel), {
      target: { value: `タイトル${slotLabel ?? ""}` },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: ja.saveConfirmButton }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: ja.saveDialogTitle }),
      ).toBeNull();
    });
  }

  it("save dialog: clicking an empty slot clears a title left over from another card ", async () => {
    mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });
    render(<HomePage />);
    const textarea = await screen.findByLabelText(ja.sourceLabel);
    chooseGemmaModel();
    preparePanelsIdMy();

    // Save a translation to card 1 with a title.
    fireEvent.change(textarea, {
      target: { value: "昨日、不具合が出ました" },
    });
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();
    await saveViaDialog(null);

    // Reopen the dialog: card 1 is the active slot, its title is
    // shown. Clicking empty card 2 must blank the field — the
    // previous card's title may not leak into the new card.
    fireEvent.click(screen.getByRole("button", { name: ja.saveButton }));
    const dialog = await screen.findByRole("dialog", {
      name: ja.saveDialogTitle,
    });
    const titleInput = within(dialog).getByLabelText(
      ja.titleLabel,
    ) as HTMLInputElement;
    expect(titleInput.value).not.toBe("");
    fireEvent.click(within(dialog).getByRole("button", { name: /02/ }));
    expect(titleInput.value).toBe("");
  });

  it("two panel sets saved to two cards stay separate: loading card 1 shows exactly its two languages ", async () => {
    const fetchMock = mockTranslateFetch({
      en: { ok: true, text: "EN text" },
      zh: { ok: true, text: "ZH text" },
      vi: { ok: true, text: "VI text" },
      pt: { ok: true, text: "PT text" },
    });
    render(<HomePage />);
    const textarea = await screen.findByLabelText(ja.sourceLabel);
    chooseGemmaModel();
    // Industry + context (the panel count already defaults to 2).
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "automotive" },
    });
    fireEvent.change(screen.getByPlaceholderText(ja.divisionPlaceholder), {
      target: { value: "組立課" },
    });
    fireEvent.change(screen.getByPlaceholderText(ja.topicPlaceholder), {
      target: { value: "不具合" },
    });
    fireEvent.change(textarea, {
      target: { value: "昨日、不具合が出ました" },
    });
    const sidebar = screen.getByRole("complementary");

    // Round 1: English + Chinese, saved to card 1.
    fireEvent.change(panelSelects()[0], { target: { value: "en" } });
    fireEvent.change(panelSelects()[1], { target: { value: "zh" } });
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("EN text")).toBeInTheDocument();
    expect(await screen.findByText("ZH text")).toBeInTheDocument();
    await saveViaDialog(null);

    // Round 2: Vietnamese + Portuguese, saved to card 2. Card 1 is
    // still the active slot during this round — round 2's
    // languages must not leak into it here.
    fireEvent.change(panelSelects()[0], { target: { value: "vi" } });
    fireEvent.change(panelSelects()[1], { target: { value: "pt" } });
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("VI text")).toBeInTheDocument();
    expect(await screen.findByText("PT text")).toBeInTheDocument();
    await saveViaDialog("02");

    // Load card 1: exactly two panels, English and Chinese, with
    // card 1's own results — no third panel, no missing Chinese.
    fireEvent.click(within(sidebar).getByRole("button", { name: /01/ }));
    expect(panelSelects()).toHaveLength(2);
    expect((panelSelects()[0] as HTMLSelectElement).value).toBe("en");
    expect((panelSelects()[1] as HTMLSelectElement).value).toBe("zh");
    expect(screen.getByText("EN text")).toBeInTheDocument();
    expect(screen.getByText("ZH text")).toBeInTheDocument();
    // The panel-count dropdown follows the loaded card.
    expect(
      (screen.getAllByRole("combobox")[1] as HTMLSelectElement).value,
    ).toBe("2");
    expect(fetchMock).toBeDefined();
  });

  it("two sentences saved to two cards keep both translations; loading a card needs no new request", async () => {
    const fetchMock = mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });
    render(<HomePage />);
    const textarea = await screen.findByLabelText(ja.sourceLabel);
    chooseGemmaModel();
    preparePanelsIdMy();
    // Card badges are queried inside the sidebar: the main button
    // shares the 翻訳済み wording.
    const sidebar = screen.getByRole("complementary");

    // Sentence 1: translate and save to card 1.
    fireEvent.change(textarea, {
      target: { value: "昨日、不具合が出ました" },
    });
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();
    await saveViaDialog(null);
    expect(within(sidebar).getByText(ja.statusTranslated)).toBeInTheDocument();

    // Typing sentence 2 must not disturb card 1's stored check mark.
    fireEvent.change(textarea, { target: { value: "明日は大雨です" } });
    expect(within(sidebar).getByText(ja.statusTranslated)).toBeInTheDocument();
    expect(within(sidebar).queryByText(ja.statusStale)).toBeNull();

    // Sentence 2: translate and save to card 2.
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();
    await saveViaDialog("02");
    expect(within(sidebar).getAllByText(ja.statusTranslated)).toHaveLength(2);
    expect(translateCalls(fetchMock)).toHaveLength(2);

    // Loading card 1 shows its sentence and its stored translation
    // again — with no third translation request.
    fireEvent.click(
      within(sidebar).getByRole("button", { name: /01/ }),
    );
    expect((textarea as HTMLTextAreaElement).value).toBe(
      "昨日、不具合が出ました",
    );
    expect(screen.getByText("ID text")).toBeInTheDocument();
    expect(translateCalls(fetchMock)).toHaveLength(2);
  });

  it("saving after a context edit stores the text without the old results", async () => {
    mockTranslateFetch({
      id: { ok: true, text: "ID text" },
      my: { ok: true, text: "MY text" },
    });
    render(<HomePage />);
    const textarea = await screen.findByLabelText(ja.sourceLabel);
    chooseGemmaModel();
    preparePanelsIdMy();
    fireEvent.change(textarea, {
      target: { value: "昨日、不具合が出ました" },
    });
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(await screen.findByText("ID text")).toBeInTheDocument();

    // The operator sharpens the topic after translating, then saves:
    // the results belong to the previous context, so the card must be
    // stored text-only instead of pairing them with the new context.
    fireEvent.change(screen.getByPlaceholderText(ja.topicPlaceholder), {
      target: { value: "安全" },
    });
    await saveViaDialog(null);

    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByText(ja.statusSaved)).toBeInTheDocument();
    expect(within(sidebar).queryByText(ja.statusTranslated)).toBeNull();
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.cards) ?? "[]",
    ) as { results: unknown; translatedSource: unknown }[];
    expect(stored[0].results).toEqual({});
    expect(stored[0].translatedSource).toBeNull();
  });
});

describe("HomePage usage meter and notices", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    seedAck();
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 0, savedCard),
    );
    seedDraft(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(usageBody: unknown, translateBody?: unknown) {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/usage")) {
        return new Response(JSON.stringify(usageBody), { status: 200 });
      }
      return new Response(
        JSON.stringify(
          translateBody ?? {
            results: {
              id: { ok: true, text: "ID text", numberMismatch: false },
              my: { ok: true, text: "MY text", numberMismatch: false },
            },
            uncertain: [],
            sourceFlags: { prohibition: false },
            glossarySkipped: 0,
          },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("shows the remaining/limit meter from /api/usage", async () => {
    stubFetch({ remaining: 42, limit: 50, used: 8 });
    render(<HomePage />);
    // Since the meter renders label and amount as
    // separate nodes (the amount is coloured on its own in the
    // today's-usage variant), so they are asserted separately.
    expect(await screen.findByText(`42/50`)).toBeInTheDocument();
    expect(screen.getByText(/残り：/)).toBeInTheDocument();
  });

  it("a capped account's remaining credit carries the yen conversion too", async () => {
    stubFetch({
      account: {
        usage: 5.5,
        usageDaily: 1.5,
        limit: 10,
        limitRemaining: 4.5,
      },
    });
    render(<HomePage />);
    expect(await screen.findByText(`$4.50 / 675.0円`)).toBeInTheDocument();
    // GC-06 layer 4: the capped figure is labelled as the KEY's
    // remaining allowance, not as an account balance.
    expect(screen.getByText(/キー残枠：/)).toBeInTheDocument();
  });

  it("hides the meter silently when usage is unavailable", async () => {
    stubFetch({ unavailable: true });
    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    expect(screen.queryByText(/残り：/)).not.toBeInTheDocument();
    expect(screen.queryByText(/本日利用額/)).not.toBeInTheDocument();
  });

  it("renders the number warning, prohibition notice, glossary notice, and uncertain list", async () => {
    stubFetch(
      { unavailable: true },
      {
        results: {
          id: { ok: true, text: "Jam 7 lewat 45", numberMismatch: true },
          my: { ok: true, text: "MY text", numberMismatch: false },
        },
        uncertain: ["点検の範囲が不明です"],
        sourceFlags: { prohibition: true },
        glossarySkipped: 2,
      },
    );
    render(<HomePage />);
    expect(await screen.findByDisplayValue(source.text)).toBeInTheDocument();
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );

    expect(
      await screen.findByText(`⚠ ${ja.numberMismatchWarning}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`⚠ ${ja.prohibitionWarning}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(ja.glossarySkippedNotice),
    ).toBeInTheDocument();
    expect(screen.getByText("点検の範囲が不明です")).toBeInTheDocument();
    // The uncertainty box renders ABOVE the output panels (level
    // with the model picker), so the operator notices it before
    // reading any translation: its title must precede the first
    // panel's translated text in document order.
    const uncertainTitle = screen.getByText(ja.uncertainTitle);
    const firstPanelText = screen.getByText("Jam 7 lewat 45");
    expect(
      uncertainTitle.compareDocumentPosition(firstPanelText) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it("an exhausted account limit disables translation with a clear message", async () => {
    stubFetch({
      account: {
        usage: 10,
        usageDaily: 1.5,
        limit: 10,
        limitRemaining: 0,
      },
    });
    render(<HomePage />);
    expect(
      await screen.findByText(ja.errors.credits_or_quota),
    ).toBeInTheDocument();
    expect(screen.getByText(`$0.00 / 0.0円`)).toBeInTheDocument();
    expect(screen.getByText(/キー残枠：/)).toBeInTheDocument();
    expect(
      inputSection().getByRole("button", { name: ja.translateButton }),
    ).toBeDisabled();
  });
});

describe("HomePage GC-06 credit layers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    seedAck();
    storeCards(
      window.localStorage,
      saveCard(createEmptyCards(), 0, savedCard),
    );
    seedDraft(0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("free-tier account: paid models disabled in the picker, no invented remaining, free model usable", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/api/usage")) {
        return new Response(
          JSON.stringify({
            account: {
              usage: 0,
              usageDaily: 0,
              limit: 50,
              limitRemaining: 50,
              isFreeTier: true,
            },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          results: {
            id: { ok: true, text: "ID text", numberMismatch: false },
          },
          uncertain: [],
          sourceFlags: { prohibition: false },
          glossarySkipped: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<HomePage />);

    // The notice explains the block, and the $50 key limit is
    // never displayed as spendable credit.
    expect(
      await screen.findByText(/このアカウントにはクレジットがありません/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\$50\.00/)).toBeNull();

    // Paid options are disabled in the picker; the free one is not.
    fireEvent.click(screen.getAllByRole("combobox")[2]);
    const gemma = screen.getByRole("option", { name: /Gemma 4 31B/ });
    expect(gemma).toHaveAttribute("aria-disabled", "true");
    const free = screen.getByRole("option", {
      name: /Nemotron 3 Ultra 550B/,
    });
    expect(free).not.toHaveAttribute("aria-disabled", "true");

    // Choosing the free model and preparing one panel enables
    // translation.
    fireEvent.click(free);
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "automotive" },
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[3], { target: { value: "id" } });
    fireEvent.change(screen.getByPlaceholderText(ja.divisionPlaceholder), {
      target: { value: "組立課" },
    });
    fireEvent.change(screen.getByPlaceholderText(ja.topicPlaceholder), {
      target: { value: "不具合" },
    });
    expect(
      inputSection().getByRole("button", { name: ja.translateButton }),
    ).toBeEnabled();
  });

  it("a paid 402 locks paid models for the session; the free model keeps working", async () => {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("/api/usage")) {
        return new Response(JSON.stringify({ unavailable: true }), {
          status: 200,
        });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        model?: string;
      };
      if (body.model?.includes("gemma")) {
        return new Response(JSON.stringify({ error: "credits_or_quota" }), {
          status: 402,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          results: {
            id: { ok: true, text: "ID text", numberMismatch: false },
            en: { ok: true, text: "EN text", numberMismatch: false },
          },
          uncertain: [],
          sourceFlags: { prohibition: false },
          glossarySkipped: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<HomePage />);

    chooseGemmaModel();
    preparePanelsIdMy();
    fireEvent.click(
      inputSection().getByRole("button", { name: ja.translateButton }),
    );
    expect(
      await screen.findByText(ja.errors.credits_or_quota),
    ).toBeInTheDocument();

    // Paid options are now disabled in the picker and the main
    // button is blocked while the paid model stays selected.
    fireEvent.click(screen.getAllByRole("combobox")[2]);
    expect(
      screen.getByRole("option", { name: /Gemma 4 31B/ }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(
      screen.getByRole("option", { name: /Nemotron 3 Ultra 550B/ }),
    );
    // Switch the Burmese panel (unsupported on the free model)
    // to English, then translation runs again.
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[4], { target: { value: "en" } });
    const button = inputSection().getByRole("button", {
      name: ja.translateButton,
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByText("ID text")).toBeInTheDocument();
    expect(await screen.findByText("EN text")).toBeInTheDocument();
  });
});
