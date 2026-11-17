import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpeakButton } from "@/components/SpeakButton";
import { stopSpeaking } from "@/components/tts-player";
import { ja } from "@/lib/i18n/ja";

// The speak button borrows the device's own
// voices through the Web Speech API. jsdom has no speech engine, so
// these tests stub a minimal one: a voice list, a speak() that
// records utterances, and a cancel().
class FakeUtterance {
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public text: string) {}
}

interface FakeVoice {
  name: string;
  lang: string;
  localService: boolean;
}

const ID_VOICE: FakeVoice = {
  name: "Google Bahasa Indonesia",
  lang: "id-ID",
  localService: false,
};
const MY_LOCAL_VOICE: FakeVoice = {
  name: "Myanmar Local Voice",
  lang: "my-MM",
  localService: true,
};
const MY_EDGE_VOICE: FakeVoice = {
  name: "Microsoft Nilar Online (Natural) - Burmese (Myanmar)",
  lang: "my-MM",
  localService: false,
};

function stubSpeech(voices: FakeVoice[]) {
  const spoken: FakeUtterance[] = [];
  const cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => voices,
    speak: (utterance: FakeUtterance) => {
      spoken.push(utterance);
    },
    cancel,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { spoken, cancel };
}

describe("SpeakButton", () => {
  afterEach(() => {
    stopSpeaking();
    vi.unstubAllGlobals();
  });

  it("renders nothing when the device has no voice for the language", () => {
    stubSpeech([ID_VOICE]);
    const { container } = render(<SpeakButton code="my" text="မြန်မာ" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("speaks the text in chunks with the best matching voice", () => {
    const { spoken } = stubSpeech([MY_LOCAL_VOICE, MY_EDGE_VOICE]);
    render(
      <SpeakButton code="my" text="ပထမစာကြောင်း။ ဒုတိယစာကြောင်း။" />,
    );

    fireEvent.click(screen.getByRole("button", { name: ja.speakButton }));

    expect(spoken.map((utterance) => utterance.text)).toEqual([
      "ပထမစာကြောင်း။",
      "ဒုတိယစာကြောင်း။",
    ]);
    // The neural Edge voice wins over the plain local one, and the
    // utterance claims the exact locale.
    expect((spoken[0]?.voice as FakeVoice).name).toBe(MY_EDGE_VOICE.name);
    expect(spoken[0]?.lang).toBe("my-MM");
    // While speaking, the button becomes the stop button.
    expect(
      screen.getByRole("button", { name: ja.speakStopButton }),
    ).toBeInTheDocument();
  });

  it("stops on a second press", () => {
    const { cancel } = stubSpeech([ID_VOICE]);
    render(<SpeakButton code="id" text="Selamat pagi." />);

    fireEvent.click(screen.getByRole("button", { name: ja.speakButton }));
    fireEvent.click(
      screen.getByRole("button", { name: ja.speakStopButton }),
    );

    expect(cancel).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: ja.speakButton }),
    ).toBeInTheDocument();
  });

  it("returns to the speak state when the last chunk ends", () => {
    const { spoken } = stubSpeech([ID_VOICE]);
    render(<SpeakButton code="id" text="Satu kalimat saja." />);

    fireEvent.click(screen.getByRole("button", { name: ja.speakButton }));
    expect(spoken).toHaveLength(1);
    act(() => {
      spoken[0]?.onend?.();
    });

    expect(
      screen.getByRole("button", { name: ja.speakButton }),
    ).toBeInTheDocument();
  });
});
