"use client";

import { useEffect, useState } from "react";

import {
  loadAck,
  loadSessionStart,
  sessionRemainingMs,
  storeAck,
  storeSessionStart,
  STORAGE_KEYS,
  type AckData,
} from "@/lib/cards";
import { ja } from "@/lib/i18n/ja";
import { SESSION_TTL_MS } from "@/lib/session";

// useGateSession — everything about "is this browser inside a
// verified session, and how long does it have left".
//
// Extracted from app/page.tsx in the refactor so the
// page only composes; the behaviour is unchanged.
//
// What this hook owns:
//   - ack: the consent record. Non-null means the operator passed
//     the API-key gate in this tab; the page shows the app instead
//     of the gate. The API key itself is NEVER here — it lives in
//     the httpOnly cookie the server set at verification.
//   - gateError: the message the gate shows when a session ends
//     mid-use (e.g. the cookie expired), so the operator learns why
//     they are back at the gate.
//   - sessionStart / nowMs: the raw material of the expiry
//     reminder. sessionStart is when the key was freshly verified
//     in this browser (a resume keeps the original moment);
//     nowMs is a clock that ticks every 30 seconds while a session
//     is active; together they produce sessionWarning.
//   - ready: false until the stored ack has been read once, so the
//     page can render nothing instead of flashing the gate at a
//     user who is already verified.
//
// What it must never do: store, read, or log the API key itself.
export function useGateSession() {
  const [ack, setAck] = useState<AckData | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  // Starts at 0 (Next.js forbids reading the clock during render);
  // the clock effect below fills it in as soon as a session is on.
  const [nowMs, setNowMs] = useState(0);
  const [ready, setReady] = useState(false);

  // Read the stored consent and session start once, on mount
  //. Reading web storage is an external-system sync, which
  // is why the setState-in-effect lint rule is disabled for this
  // block only — the same pattern the other storage hooks use.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storage = window.sessionStorage;
    const loadedAck = loadAck(storage);
    setAck(loadedAck);
    if (loadedAck) {
      // Re-store the parsed ack, so the stored shape is the
      // current one (unknown fields are dropped).
      storeAck(storage, loadedAck);
    }
    setSessionStart(loadSessionStart(window.localStorage));
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Tab-close reminder : while a session is
  // active, closing or refreshing the tab asks for the browser's
  // own leave confirmation, so the operator pauses and remembers
  // that this browser still holds their API-key session and their
  // cards. Browsers do not let a page show a custom dialog — or
  // custom text, or its own choice buttons — at this point; the
  // standard prompt is all any site may request. Nothing is
  // deleted by it: the session and cards stay exactly as they were
  // either way.
  useEffect(() => {
    if (!ack) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [ack]);

  // Expiry reminder clock : tick every 30
  // seconds while a session is active so the last-hour warning in
  // the context bar appears on time. Reading the clock into state
  // is the same external-system sync as the storage reads above.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!ack) {
      return;
    }
    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => {
      clearInterval(timer);
    };
  }, [ack]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Called by the gate after /api/verify accepted the key.
  // freshKey tells apart the two ways in: the operator pasted a
  // key just now (true — the server issued the cookie at this
  // moment, so the 24-hour session clock starts now), or the tab
  // resumed the key already stored in this browser (false — the
  // cookie and its expiry date from the original paste, so the
  // recorded start is simply re-read).
  const handleVerified = (freshKey: boolean) => {
    // Only the consent timestamp is stored — never any credential.
    const data: AckData = {
      acknowledgedAt: new Date().toISOString(),
    };
    storeAck(window.sessionStorage, data);
    setAck(data);
    setGateError(null);
    if (freshKey) {
      const now = Date.now();
      storeSessionStart(window.localStorage, now);
      setSessionStart(now);
    } else {
      setSessionStart(loadSessionStart(window.localStorage));
    }
  };

  // Ends the local session because the server stopped accepting
  // it (an API call answered 401 — the cookie expired or was
  // cleared): the stored ack is dropped and the reason travels to
  // the gate in gateError. The page pairs this with a usage-meter
  // reset; everything else (cards, draft) is deliberately left
  // alone — an expired session loses no prepared work.
  const expire = () => {
    window.sessionStorage.removeItem(STORAGE_KEYS.ack);
    window.localStorage.removeItem(STORAGE_KEYS.sessionStart);
    setAck(null);
    setSessionStart(null);
    setGateError(ja.errors.unauthorized);
  };

  // Plain state reset for the deliberate セッションを削除 path:
  // the page wipes the storages itself (session deletion removes every
  // chourei:* key), so here only the in-memory state is cleared.
  const clear = () => {
    setAck(null);
    setSessionStart(null);
    setGateError(null);
  };

  // Expiry reminder : during the last hour of the
  // session the context bar warns how many minutes are left, so
  // the morning shift is never surprised by a dead session. Hidden
  // whenever the session start is unknown in this browser.
  const sessionRemaining = sessionRemainingMs(
    sessionStart,
    nowMs,
    SESSION_TTL_MS,
  );
  const sessionWarning =
    sessionRemaining !== null && sessionRemaining <= 60 * 60 * 1000
      ? ja.sessionExpiryWarning.replace(
          "{minutes}",
          String(Math.max(1, Math.ceil(sessionRemaining / 60_000))),
        )
      : null;

  return {
    ack,
    gateError,
    ready,
    sessionWarning,
    handleVerified,
    expire,
    clear,
  };
}
