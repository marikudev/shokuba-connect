import type { LanguageCode } from "@/lib/languages";
import { pickVoice, speechLocale, splitSpeechChunks } from "@/lib/tts";

// Shared browser speech player. One module-level player for
// the whole page, so only one panel can speak at a time: starting a
// panel stops whichever panel was speaking. State is exposed as
// external stores so components subscribe with useSyncExternalStore,
// the same pattern the fullscreen capability uses. Playback is pure
// client behavior — no fetch, no key, no server involvement.

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

// --- Which panel is speaking -------------------------------------------

let speakingCode: LanguageCode | null = null;
// Incremented on every start and stop, so the handlers of an
// utterance that was cancelled or replaced can tell they are stale
// and must not clear a newer session's state.
let session = 0;
const speakingListeners = new Set<() => void>();

function emitSpeaking(): void {
  speakingListeners.forEach((listener) => {
    listener();
  });
}

export function subscribeSpeaking(listener: () => void): () => void {
  speakingListeners.add(listener);
  return () => {
    speakingListeners.delete(listener);
  };
}

export function getSpeakingCode(): LanguageCode | null {
  return speakingCode;
}

export function stopSpeaking(): void {
  session += 1;
  if (speechSupported()) {
    window.speechSynthesis.cancel();
  }
  if (speakingCode !== null) {
    speakingCode = null;
    emitSpeaking();
  }
}

export function speakText(
  code: LanguageCode,
  text: string,
  voices: readonly SpeechSynthesisVoice[],
): boolean {
  if (!speechSupported()) {
    return false;
  }
  const voice = pickVoice(voices, code);
  const chunks = splitSpeechChunks(text);
  if (!voice || chunks.length === 0) {
    return false;
  }
  stopSpeaking();
  const mine = session;
  speakingCode = code;
  emitSpeaking();
  const synth = window.speechSynthesis;
  chunks.forEach((chunk, index) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.voice = voice;
    utterance.lang = speechLocale(code);
    utterance.onerror = () => {
      if (session === mine) {
        // A voice that fails mid-text (a network voice dropping,
        // say) ends the session instead of leaving a stuck "stop"
        // button behind.
        stopSpeaking();
      }
    };
    if (index === chunks.length - 1) {
      utterance.onend = () => {
        if (session === mine && speakingCode === code) {
          speakingCode = null;
          emitSpeaking();
        }
      };
    }
    synth.speak(utterance);
  });
  return true;
}

// --- Installed voices ----------------------------------------------------

// The voice list is empty on first read in most browsers and fills
// in with a "voiceschanged" event, so it is cached behind a
// subscription: subscribing refreshes the cache and arms the event
// listener (once), and every later change re-notifies subscribers.
let voicesCache: SpeechSynthesisVoice[] = [];
let voicesCacheKey = "";
let voicesListenerArmed = false;
const voicesListeners = new Set<() => void>();

function refreshVoices(): void {
  if (!speechSupported()) {
    return;
  }
  const next = window.speechSynthesis.getVoices();
  const key = next.map((voice) => `${voice.name}|${voice.lang}`).join(";");
  if (key !== voicesCacheKey) {
    voicesCache = [...next];
    voicesCacheKey = key;
    voicesListeners.forEach((listener) => {
      listener();
    });
  }
}

export function subscribeVoices(listener: () => void): () => void {
  if (speechSupported()) {
    refreshVoices();
    if (!voicesListenerArmed) {
      voicesListenerArmed = true;
      window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    }
  }
  voicesListeners.add(listener);
  return () => {
    voicesListeners.delete(listener);
  };
}

export function getVoicesSnapshot(): SpeechSynthesisVoice[] {
  return voicesCache;
}
