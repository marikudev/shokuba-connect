import Link from "next/link";

import { ja } from "@/lib/i18n/ja";

// The 面談コネクト product page. Until its own release phase
// (it launches only after 朝礼コネクト is released) this page
// introduces the product and the three principles that govern
// it; the session UI itself is not built yet.
export default function MendanPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto p-4">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          {ja.mendanName}
          <span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">
            {ja.mendanComingLabel}
          </span>
        </h1>
        <p className="leading-relaxed text-coal">{ja.mendanIntro}</p>

        <div className="flex flex-col gap-3">
          {ja.mendanPrinciples.map((principle) => (
            <section
              key={principle.title}
              className="rounded-2xl border border-mist bg-white p-4"
            >
              <h2 className="font-semibold">{principle.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-coal">
                {principle.text}
              </p>
            </section>
          ))}
        </div>

        <Link
          href="/"
          className="text-sm font-semibold text-ink underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {ja.backToTopLabel}
        </Link>
      </main>
    </div>
  );
}
