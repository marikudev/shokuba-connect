import { useEffect, useSyncExternalStore } from "react";

import { ja } from "@/lib/i18n/ja";
import type { LanguageCode } from "@/lib/languages";
import { pickVoice } from "@/lib/tts";
import {
  getSpeakingCode,
  getVoicesSnapshot,
  speakText,
  speechSupported,
  stopSpeaking,
  subscribeSpeaking,
  subscribeVoices,
} from "@/components/tts-player";

// The per-panel speak button. Honest by construction: it
// renders nothing at all unless the browser supports speech AND an
// installed voice matches this panel's language — a panel whose
// language has no voice on this device simply has no button, never
// a button that reads the text with the wrong voice. Pressing it
// while this panel speaks stops the speech; pressing another
// panel's button takes over (the player is shared).
const NO_VOICES: SpeechSynthesisVoice[] = [];

export function SpeakButton({
  code,
  text,
}: {
  code: LanguageCode;
  text: string;
}) {
  const voices = useSyncExternalStore(
    subscribeVoices,
    getVoicesSnapshot,
    () => NO_VOICES,
  );
  const speaking = useSyncExternalStore(
    subscribeSpeaking,
    getSpeakingCode,
    () => null,
  );

  // When this panel's content is replaced (a new translation, a
  // different card loaded) or the panel leaves the screen, its
  // speech must not keep reading the old text.
  useEffect(() => {
    return () => {
      if (getSpeakingCode() === code) {
        stopSpeaking();
      }
    };
  }, [code, text]);

  if (!speechSupported() || pickVoice(voices, code) === null) {
    return null;
  }
  const isSpeaking = speaking === code;
  return (
    <button
      type="button"
      aria-label={isSpeaking ? ja.speakStopButton : ja.speakButton}
      onClick={() => {
        if (isSpeaking) {
          stopSpeaking();
        } else {
          speakText(code, text, voices);
        }
      }}
      className="rounded border border-white/50 px-3 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {isSpeaking ? `⏹ ${ja.speakStopButton}` : `🔊 ${ja.speakButton}`}
    </button>
  );
}
