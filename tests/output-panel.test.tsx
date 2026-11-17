import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OutputPanel } from "@/components/OutputPanel";
import { ja } from "@/lib/i18n/ja";
import { LANGUAGES } from "@/lib/languages";

const noop = () => undefined;

describe("OutputPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the prohibition-missing warning only when flagged ", () => {
    const { unmount } = render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "Harap berhati-hati", prohibitionMissing: true }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.getByText(`⚠ ${ja.prohibitionMissingWarning}`),
    ).toBeInTheDocument();
    unmount();

    render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "Jangan menyentuh" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.queryByText(`⚠ ${ja.prohibitionMissingWarning}`),
    ).not.toBeInTheDocument();
  });

  it("A− / A+ buttons resize this panel's text only, within bounds", () => {
    const { container } = render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "Hasil" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    const section = container.querySelector("section") as HTMLElement;
    const size = () =>
      section.style.getPropertyValue("--panel-text-size");
    expect(size()).toBe("1.125rem");

    fireEvent.click(
      screen.getByRole("button", { name: ja.fontLargerLabel }),
    );
    expect(size()).toBe("1.375rem");
    // The ladder's maximum is 2rem (an extension to 4rem was
    // tried and reverted): the extra clicks prove the size caps
    // there instead of overshooting.
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(
        screen.getByRole("button", { name: ja.fontLargerLabel }),
      );
    }
    expect(size()).toBe("2rem");
    expect(
      screen.getByRole("button", { name: ja.fontLargerLabel }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: ja.fontSmallerLabel }),
    );
    expect(size()).toBe("1.625rem");
  });

  it("an unselected panel shows the language prompt and no translate action ", () => {
    render(
      <OutputPanel
        language=""
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={undefined}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(
      screen.getByRole("option", { name: ja.panelLangSelectPrompt }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(ja.panelSelectLanguageHint),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ja.translateButton }),
    ).not.toBeInTheDocument();
  });

  it("shows no machine-translation labels", () => {
    render(
      <OutputPanel
        language="my"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={undefined}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.queryByText("機械翻訳（未検証）"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("ミャンマー語は未検証です。ネイティブ確認が必要です。"),
    ).not.toBeInTheDocument();
  });

  it("lists all seven languages by Japanese name and disables the ones used by other panels", () => {
    render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={["my"]}
        entry={undefined}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    const select = screen.getByRole("combobox");
    const options = [...select.querySelectorAll("option")];
    // Since the 言語を選択 prompt option leads the list.
    expect(options.map((option) => option.textContent)).toEqual([
      ja.panelLangSelectPrompt,
      ...LANGUAGES.map((language) => language.uiNameJa),
    ]);
    expect(
      options.find((option) => option.value === "my")?.disabled,
    ).toBe(true);
    expect(
      options.find((option) => option.value === "pt")?.disabled,
    ).toBe(false);
  });

  it("changing the dropdown only reports the change (never a translation call)", () => {
    const onLanguageChange = vi.fn();
    const onTranslateLanguage = vi.fn();
    render(
      <OutputPanel
        language="id"
        onLanguageChange={onLanguageChange}
        disabledLanguages={[]}
        entry={undefined}
        onTranslateLanguage={onTranslateLanguage}
        translating={false}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "vi" },
    });
    expect(onLanguageChange).toHaveBeenCalledWith("vi");
    expect(onTranslateLanguage).not.toHaveBeenCalled();
  });

  it("shows 未翻訳 with a single-language translate button when there is no result", () => {
    const onTranslateLanguage = vi.fn();
    render(
      <OutputPanel
        language="vi"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={undefined}
        onTranslateLanguage={onTranslateLanguage}
        translating={false}
      />,
    );
    expect(screen.getByText(ja.untranslatedLabel)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: ja.translateButton }),
    );
    expect(onTranslateLanguage).toHaveBeenCalledWith("vi");
  });

  it("shows the number-mismatch warning under the result", () => {
    render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "Jam 7 lewat 45", numberMismatch: true }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.getByText(`⚠ ${ja.numberMismatchWarning}`),
    ).toBeInTheDocument();
  });

  it("shows a retry button for a failed language", () => {
    const onTranslateLanguage = vi.fn();
    render(
      <OutputPanel
        language="pt"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: false }}
        onTranslateLanguage={onTranslateLanguage}
        translating={false}
      />,
    );
    expect(screen.getByText(ja.errors.bad_output)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ja.retryButton }));
    expect(onTranslateLanguage).toHaveBeenCalledWith("pt");
  });

  it("hides the fullscreen button when fullscreen is unavailable, and requests it on the panel when available", async () => {
    const { unmount } = render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "teks" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: ja.fullscreenButton }),
    ).not.toBeInTheDocument();
    unmount();

    Object.defineProperty(document, "fullscreenEnabled", {
      value: true,
      configurable: true,
    });
    const requestFullscreen = vi.fn(async () => undefined);
    Element.prototype.requestFullscreen =
      requestFullscreen as typeof Element.prototype.requestFullscreen;
    render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "teks" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    const button = await screen.findByRole("button", {
      name: ja.fullscreenButton,
    });
    fireEvent.click(button);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    // The fullscreen target is the panel container itself.
    const panel = document.querySelector('[data-language="id"]');
    expect(requestFullscreen.mock.instances[0]).toBe(panel);
    delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
  });

  it("renames the fullscreen button to 閉じる while the panel is fullscreen ", async () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      value: true,
      configurable: true,
    });
    Element.prototype.requestFullscreen = vi.fn(
      async () => undefined,
    ) as typeof Element.prototype.requestFullscreen;
    const exitFullscreen = vi.fn(async () => undefined);
    Object.defineProperty(document, "exitFullscreen", {
      value: exitFullscreen,
      configurable: true,
    });
    const { container } = render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "teks" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    await screen.findByRole("button", { name: ja.fullscreenButton });
    const panel = container.querySelector("section");

    // The browser grants fullscreen: the label becomes 閉じる.
    Object.defineProperty(document, "fullscreenElement", {
      value: panel,
      configurable: true,
    });
    fireEvent(document, new Event("fullscreenchange"));
    const closeButton = await screen.findByRole("button", {
      name: ja.closeButton,
    });

    // In fullscreen the font-size buttons are gone; only
    // 閉じる remains in the header .
    expect(
      screen.queryByRole("button", { name: ja.fontSmallerLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ja.fontLargerLabel }),
    ).not.toBeInTheDocument();

    // Clicking it asks the browser to leave fullscreen...
    fireEvent.click(closeButton);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);

    // ...and once the browser has left, the label is 全画面 again.
    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
    });
    fireEvent(document, new Event("fullscreenchange"));
    expect(
      await screen.findByRole("button", { name: ja.fullscreenButton }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ja.fontLargerLabel }),
    ).toBeInTheDocument();

    delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    delete (document as { fullscreenElement?: unknown }).fullscreenElement;
  });

  it("shows the speak button only when the device has a voice for the panel language", () => {
    // jsdom has no speech engine at all: no button.
    const { unmount } = render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "Selamat pagi" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: ja.speakButton }),
    ).toBeNull();
    unmount();

    // With a matching installed voice, the button appears.
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [
        { name: "Google Bahasa Indonesia", lang: "id-ID", localService: false },
      ],
      speak: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "Selamat pagi" }}
        onTranslateLanguage={noop}
        translating={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: ja.speakButton }),
    ).toBeInTheDocument();
  });

  it("blocks a language the selected model does not support", () => {
    const notice = ja.unsupportedLanguageNotice.replace(
      "{language}",
      "ミャンマー語",
    );
    // No entry yet: the notice replaces the translate action.
    const { unmount } = render(
      <OutputPanel
        language="my"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={undefined}
        onTranslateLanguage={noop}
        translating={false}
        unsupportedLanguages={["my"]}
      />,
    );
    expect(screen.getByText(`⚠ ${notice}`)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ja.translateButton }),
    ).toBeNull();
    unmount();

    // A stored result from a supporting model still displays.
    render(
      <OutputPanel
        language="my"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={{ ok: true, text: "မင်္ဂလာပါ" }}
        onTranslateLanguage={noop}
        translating={false}
        unsupportedLanguages={["my"]}
      />,
    );
    expect(screen.getByText("မင်္ဂလာပါ")).toBeInTheDocument();
    expect(screen.queryByText(`⚠ ${notice}`)).toBeNull();
  });

  it("disables unsupported languages in the panel dropdown", () => {
    render(
      <OutputPanel
        language="id"
        onLanguageChange={noop}
        disabledLanguages={[]}
        entry={undefined}
        onTranslateLanguage={noop}
        translating={false}
        unsupportedLanguages={["my"]}
      />,
    );
    const burmese = screen.getByRole("option", { name: "ミャンマー語" });
    expect(burmese).toBeDisabled();
    expect(screen.getByRole("option", { name: "ベトナム語" })).toBeEnabled();
  });
});
