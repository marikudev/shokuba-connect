import Link from "next/link";

import { ja } from "@/lib/i18n/ja";

// ProductHome — the Shokuba Connect home shown after the shared
// gate: the operator picks which product to open. 朝礼コネクト
// leads to its workspace; 面談コネクト leads to its product
// page and is marked as upcoming until its own release phase.
// The delete-session button lives here as well as in the
// workspace, so a session can be ended from the home too.
export function ProductHome({
  onDeleteSession,
  sessionWarning,
}: {
  onDeleteSession: () => void;
  sessionWarning: string | null;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-mist bg-white px-4 py-3">
        <h1 className="text-lg font-bold">{ja.shokubaTitle}</h1>
        {sessionWarning ? (
          <p className="text-sm font-semibold text-coal">
            {sessionWarning}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(ja.deleteSessionConfirmMessage)) {
              onDeleteSession();
            }
          }}
          className="ml-auto rounded bg-red-600 px-3 py-1.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
        >
          {ja.deleteSessionButton}
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-4">
        <p className="text-sm text-graphite">{ja.productHomeLead}</p>

        <section className="rounded-2xl bg-ink p-5 text-white">
          <h2 className="text-base font-bold">{ja.appTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-mist">
            {ja.choureiTagline}
          </p>
          <Link
            href="/chourei"
            className="mt-3 inline-block rounded bg-white px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ja.openButton}
          </Link>
        </section>

        <section className="rounded-2xl border border-mist bg-white p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            {ja.mendanName}
            <span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">
              {ja.mendanComingLabel}
            </span>
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-coal">
            {ja.mendanTagline}
          </p>
          <Link
            href="/mendan"
            className="mt-3 inline-block rounded border border-ink px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {ja.openButton}
          </Link>
        </section>
      </main>
    </div>
  );
}
