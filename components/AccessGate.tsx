"use client";

import { useEffect, useState } from "react";

import { ShokubaLanding } from "@/components/ShokubaLanding";
import { ja } from "@/lib/i18n/ja";

// The API-key gate. The app runs on the operator's own
// OpenRouter API key: the gate explains that, links to OpenRouter's
// key page, and takes the pasted key. POST /api/verify checks the key
// once and stores it in the httpOnly session cookie — the key itself
// never leaves this component's transient state and is never shown
// again. When this browser already holds a key cookie (this tab is
// new but the session is alive), the gate offers to continue with
// the stored key instead of asking for a paste; the consent checkbox
// is required either way.
//
// Since the home screen was added, this
// component first shows ShokubaLanding to visitors WITHOUT a stored
// key — lay users meet an explanation of the app before the key
// form. The stored-key probe doubles as the skip: a 204 means this
// browser already holds a key, so the gate appears directly and the
// landing is never shown. An initialError (a session that ended
// mid-use) also goes straight to the gate so the message is seen.
//
// Layout : the
// gate is two columns on wide screens — the usage steps and the
// BYOK note are the LEFT
// column here (below the form on narrow screens), and the notices,
// the key form and its buttons form the RIGHT column. Since
//  the page itself never scrolls: the right column's
// guide, data-handling text and consent share ONE internally
// scrolling box, and the left column scrolls internally too.
const OPENROUTER_KEYS_URL = "https://openrouter.ai/ja";

interface AccessGateProps {
  initialError?: string | null;
  // freshKey tells the page whether this verification pasted a new
  // key (true — the server just issued the session cookie) or
  // resumed the key already stored in this browser (false — the
  // cookie, and its expiry, date from the original paste).
  onVerified: (freshKey: boolean) => void;
}

export function AccessGate({ initialError, onVerified }: AccessGateProps) {
  const [stage, setStage] = useState<"landing" | "gate">(
    initialError ? "gate" : "landing",
  );
  const [apiKey, setApiKey] = useState("");
  // Show/hide toggle for the key field: a long key is easy to mistype
  // blind. Switching the input type works in every browser, unlike
  // the built-in reveal some browsers add.
  const [keyVisible, setKeyVisible] = useState(false);
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);
  // null while the probe is in flight; true when a key cookie is
  // already stored in this browser.
  const [storedKey, setStoredKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/verify", { method: "GET" });
        if (!cancelled) {
          setStoredKey(response.status === 204);
          // A stored key means a returning user: skip the landing.
          if (response.status === 204) {
            setStage("gate");
          }
        }
      } catch {
        if (!cancelled) {
          setStoredKey(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (stage === "landing") {
    return (
      <ShokubaLanding
        onStart={() => {
          setStage("gate");
        }}
      />
    );
  }

  const canStart =
    consented &&
    !submitting &&
    storedKey !== null &&
    (storedKey || apiKey.trim() !== "");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canStart) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storedKey ? {} : { apiKey: apiKey.trim() }),
      });
      if (response.status === 204) {
        onVerified(!storedKey);
        return;
      }
      if (response.status === 401) {
        setError(ja.errors.unauthorized);
        // A rejected resume means the stored key is gone after all.
        if (storedKey) {
          setStoredKey(false);
        }
        return;
      }
      setError(ja.gateServiceError);
    } catch {
      setError(ja.networkErrorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-lg font-bold">{ja.gateTitle}</h1>
      <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-2">
        {/* Left column: the usage steps and the BYOK note, which
            live here rather than on the home screen. On narrow
            screens they follow the form. */}
        <div className="order-2 flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 lg:order-1">
          <h2 className="text-sm font-semibold tracking-widest text-neutral-500">
            {ja.homeStepsTitle}
          </h2>
          <ol className="flex flex-col gap-2.5">
            {ja.homeSteps.map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-neutral-500">{ja.homeNote}</p>
        </div>
        {/* Right column: the guide box, the key form and the
            buttons under it . */}
        <div className="order-1 flex min-h-0 w-full max-w-md flex-col gap-4 lg:order-2 lg:ml-auto">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-3">
        {/* ONE merged notices box : the guide and the data-handling explanation
            share a single
            bordered box that scrolls internally (height-capped so
            everything below it rises up the page), while the
            consent sits in its own fixed box under it — the gate
            page itself never scrolls. */}
        <div className="flex max-h-[36vh] shrink-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-mist bg-white px-4 py-3">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{ja.gateGuideTitle}</h2>
            <ul className="flex list-disc flex-col gap-1 px-4 text-sm">
              {ja.gateGuide.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">{ja.gatePrivacyTitle}</h2>
            <ul className="flex list-disc flex-col gap-1 px-4 text-sm">
              {ja.gatePrivacyNotes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
        {/* The consent is FIXED below the scrolling notices
            : it must never
            scroll away, because checking it is what enables the
            start button. */}
        <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-mist bg-white px-4 py-3">
          <p className="text-sm font-semibold text-red-700">
            {ja.gatePrivacyWarning}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => {
                setConsented(event.target.checked);
              }}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{ja.consentLabel}</span>
          </label>
        </div>
        {storedKey ? (
          <p className="text-sm">{ja.storedKeyNote}</p>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor="api-key" className="text-sm font-semibold">
              {ja.apiKeyLabel}
            </label>
            <div className="relative">
              <input
                id="api-key"
                type={keyVisible ? "text" : "password"}
                autoComplete="off"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                }}
                placeholder={ja.apiKeyPlaceholder}
                className="w-full rounded border border-mist px-3 py-2 pr-16 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
              />
              <button
                type="button"
                aria-pressed={keyVisible}
                aria-controls="api-key"
                onClick={() => {
                  setKeyVisible((visible) => !visible);
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-ash px-2 py-0.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
              >
                {keyVisible ? ja.apiKeyHide : ja.apiKeyShow}
              </button>
            </div>
          </div>
        )}
        {error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={!canStart}
          className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ja.startButton}
        </button>
        {/* Consent hint : while
            the box above is unchecked the button stays disabled;
            say why, right under it. */}
        {!consented ? (
          <p className="text-xs text-neutral-500">{ja.startConsentHint}</p>
        ) : null}
      </form>
      <p className="text-center text-sm text-neutral-500">{ja.gateOrText}</p>
      <a
        href={OPENROUTER_KEYS_URL}
        target="_blank"
        rel="noreferrer"
        className="rounded bg-ink px-4 py-2 text-center text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {ja.getKeyButton}
      </a>
        </div>
      </div>
    </section>
  );
}
