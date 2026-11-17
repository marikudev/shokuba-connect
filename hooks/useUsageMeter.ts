"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ja } from "@/lib/i18n/ja";

// useUsageMeter — the usage meter (本日利用額 / キー残枠).
//
// Extracted from app/page.tsx in the refactor; the
// behaviour is unchanged. The meter asks /api/usage what the
// operator's own OpenRouter key has spent; the browser
// authenticates with the httpOnly session cookie, so no
// credential is ever sent from here.
//
// Failure philosophy: any failure or odd shape simply
// hides the meter — it is a courtesy display, never a blocker.
// The single exception is a 401: the session cookie is gone or
// expired, so the page must end the local session; that is
// reported through the onUnauthorized callback the page supplies.

// Static approximate USD→JPY rate for the meter's yen figure
// . Display only; adjust here when the rate drifts
// far from reality — no live rate is fetched.
const USD_TO_JPY_RATE = 150;

export interface UsageAccount {
  usage: number;
  usageDaily: number | null;
  limit: number | null;
  limitRemaining: number | null;
  // GC-06 layer 1: true when the account has never bought
  // credit (its paid balance is provably $0); null when the
  // upstream field was absent or not a boolean.
  isFreeTier: boolean | null;
}

export interface UsageInfo {
  remaining: number | null;
  limit: number | null;
  used: number | null;
  account: UsageAccount | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// One read of /api/usage, defensively parsed: every field is
// checked before it is trusted, and anything unexpected degrades
// to nulls (which hide the meter) instead of breaking the page.
async function requestUsage(): Promise<UsageInfo | null | "unauthorized"> {
  try {
    const response = await fetch("/api/usage");
    if (response.status === 401) {
      return "unauthorized";
    }
    if (!response.ok) {
      return null;
    }
    const data: unknown = await response.json().catch(() => null);
    if (!isRecord(data) || data.unavailable === true) {
      return null;
    }
    const accountRaw = isRecord(data.account) ? data.account : null;
    const accountUsage = accountRaw ? numberOrNull(accountRaw.usage) : null;
    return {
      remaining: numberOrNull(data.remaining),
      limit: numberOrNull(data.limit),
      used: numberOrNull(data.used),
      account:
        accountRaw && accountUsage !== null
          ? {
              usage: accountUsage,
              usageDaily: numberOrNull(accountRaw.usageDaily),
              limit: numberOrNull(accountRaw.limit),
              limitRemaining: numberOrNull(accountRaw.limitRemaining),
              isFreeTier:
                typeof accountRaw.isFreeTier === "boolean"
                  ? accountRaw.isFreeTier
                  : null,
            }
          : null,
    };
  } catch {
    return null;
  }
}

// GC-06 credit floor: paid models may only be used while the
// operator's account keeps more than $1 of credit, so a balance
// can never run negative mid-use. The only remaining-credit
// figure the key endpoint exposes is the key's own limit
// remainder (null when the key carries no spending limit), so
// the floor is enforced on that figure wherever it exists.
export function isCreditFloorHit(limitRemaining: number | null): boolean {
  return limitRemaining !== null && limitRemaining <= 1;
}

// GC-06, all layers combined: paid models are blocked when ANY
// layer says so — the account is free-tier (layer 1, provably
// $0 paid credit), the capped key's remaining allowance is at
// the $1 floor (layer 2), or a paid call already came back 402
// this session (layer 3, the session lock the translation hook
// owns). Pure and exported so the rule itself is unit-tested;
// the page and the meter both read it through here.
export function paidModelsBlocked(state: {
  isFreeTier: boolean | null;
  limitRemaining: number | null;
  paidLocked: boolean;
}): boolean {
  return (
    state.isFreeTier === true ||
    state.paidLocked ||
    isCreditFloorHit(state.limitRemaining)
  );
}

export function useUsageMeter(
  sessionActive: boolean,
  onUnauthorized: () => void,
) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  // The page's session-expire handler changes identity between
  // renders; the latest-ref pattern lets this hook always call
  // the current one without re-running its effects when it
  // changes.
  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  });

  // One meter refresh. Safe to call at any time: failures hide
  // the meter, and a late answer after unmount is ignored by the
  // caller's cancellation flag where one exists.
  const refreshUsage = useCallback(async (isCancelled?: () => boolean) => {
    const info = await requestUsage();
    if (isCancelled?.()) {
      return;
    }
    if (info === "unauthorized") {
      unauthorizedRef.current();
      return;
    }
    setUsage(info);
  }, []);

  // Load the meter when the gate opens (a session becomes
  // active); translateLangs triggers further refreshes through
  // refreshUsage after every translation. The lint rule against
  // setState in effects is disabled for this block only: the
  // state update happens inside the fetch's promise
  // continuation, not synchronously — the rule cannot see
  // through the callback, but no cascading render is possible
  // here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!sessionActive) {
      return;
    }
    let cancelled = false;
    void refreshUsage(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [sessionActive, refreshUsage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const resetUsage = useCallback(() => {
    setUsage(null);
  }, []);

  // GC-06 layer 1: a free-tier account's key-limit remainder is
  // NOT spendable credit, so it is never displayed as one and
  // never counts toward exhaustion — the free model stays open.
  const freeTierBlocksPaid = usage?.account?.isFreeTier === true;
  const displayLimitRemaining = freeTierBlocksPaid
    ? null
    : (usage?.account?.limitRemaining ?? null);

  // The translate buttons are disabled only when the account
  // limit is truly exhausted — a capped account at $0 remaining.
  const usageExhausted =
    displayLimitRemaining !== null && displayLimitRemaining <= 0;

  // Display format: a capped account
  // shows its remaining credit; an uncapped account shows today's
  // usage; the free-model counters are the fallback. Label and
  // amount travel separately so the amount can be coloured on its
  // own: the today's-usage amount is green (the
  // user's request — money spent today should catch the eye);
  // the remaining-credit variants keep the plain colour.
  // Both money variants pair the dollar figure with the same
  // approximate yen conversion (static rate above), so a capped
  // account's remaining credit reads in yen too, not only in
  // dollars.
  const formatMoney = (usd: number, decimals: number): string =>
    `$${usd.toFixed(decimals)} / ${(usd * USD_TO_JPY_RATE).toFixed(1)}円`;
  const usageParts = usageExhausted
    ? {
        label: ja.usageKeyRemainingLabel,
        amount: formatMoney(0, 2),
        green: true,
      }
    : displayLimitRemaining != null
      ? {
          label: ja.usageKeyRemainingLabel,
          amount: formatMoney(displayLimitRemaining, 2),
          green: true,
        }
      : usage?.account?.usageDaily != null
        ? {
            label: ja.usageTodayLabel,
            // Yen conversion beside the dollar figure: a static
            // approximate rate for display only — the dollar
            // figure stays the real OpenRouter number, the yen is
            // a rough guide for staff who think in yen. One
            // decimal.
            amount: formatMoney(usage.account.usageDaily, 2),
            green: true,
          }
        : usage?.remaining != null && usage?.limit != null
          ? {
              label: ja.usageRemainingLabel,
              amount: `${usage.remaining}/${usage.limit}`,
              green: false,
            }
          : null;

  const creditFloorHit = isCreditFloorHit(
    usage?.account?.limitRemaining ?? null,
  );

  return {
    usage,
    usageParts,
    usageExhausted,
    creditFloorHit,
    freeTierBlocksPaid,
    refreshUsage,
    resetUsage,
  };
}
