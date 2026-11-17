import { ja } from "@/lib/i18n/ja";

// Shokuba Connect landing, shown before the shared API-key gate
// to visitors who have no stored key yet (AccessGate owns the
// transition and the stored-key skip: a browser that already
// holds a key never sees this screen). It introduces the
// umbrella product and its two products — 朝礼コネクト with its
// established benefit list, and 面談コネクト marked as upcoming
// — over the hero illustration: a fixed full-viewport layer with
// no veil, no blur and no card, the copy transparent at the
// right edge in light text, helped only by a soft dark gradient
// from the right edge. On narrow screens the column takes the
// full width. The bottom row carries the rotating provider
// logos with the AI credit line and the start button.
export function ShokubaLanding({ onStart }: ShokubaLandingProps) {
  return (
    <section className="fixed inset-0 z-40 overflow-y-auto">
      {/* The illustration is decorative; the text carries the meaning.
          A plain img is deliberate: the asset is pre-compressed to
          43 KB, and a decorative background gains nothing from the
          image optimizer's runtime resizing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/home-bg.jpg"
        alt=""
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="fixed inset-0"
        style={{
          background:
            "linear-gradient(to left, rgba(18,18,20,0.68) 0%, rgba(18,18,20,0.52) 40%, rgba(18,18,20,0) 74%)",
        }}
      />
      <div className="relative flex min-h-full">
        <div className="my-auto ml-auto flex w-full flex-col gap-7 px-5 py-10 text-white sm:px-8 lg:w-[44%] lg:px-10">
        <div className="flex flex-col gap-5">
          <h1 className="text-3xl font-bold text-shadow-md sm:text-4xl">
            {ja.shokubaTitle}
          </h1>
          <p className="leading-relaxed text-neutral-100 text-shadow-sm">
            {ja.shokubaLead}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-shadow-sm">{ja.appTitle}</h2>
          <p className="text-sm leading-relaxed text-neutral-200">
            {ja.choureiTagline}
          </p>
          {ja.homeFeatures.map((feature) => (
            <div
              key={feature.title}
              className="border-t border-white/25 py-4 first:border-t-0 first:pt-0"
            >
              <h3 className="font-semibold text-shadow-sm">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-200">
                {feature.text}
              </p>
            </div>
          ))}
          <div className="border-t border-white/25 py-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-shadow-sm">
              {ja.mendanName}
              <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-neutral-900">
                {ja.mendanComingLabel}
              </span>
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-200">
              {ja.mendanTagline}
            </p>
          </div>
        </div>

        {/* Bottom row :
            the AI credit line on the left, the start button on
            the right, on one line. The button pulses gently so a
            first-time visitor's eye lands on it (the animation is
            defined in globals.css and stops for reduced-motion
            users). */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            {/* Vertical logo rotator : the three providers whose models power
                the app — OpenAI, Google, NVIDIA, in that order —
                slide up one at a time, each shown for 1.8 seconds,
                inside a fixed transparent window — no box, no
                border: the wordmarks are the all-white variants
                (public/logos/*-logo.svg fills set to #fff), made
                for this dark page . Pure CSS animation (the
                keyframes live in globals.css; the first logo is
                repeated at the end of the track so the loop wraps
                seamlessly), so this server component needs no
                client JavaScript. The model picker keeps its
                *-icon.svg files. */}
            <div
              aria-hidden="true"
              className="h-9 w-[132px] shrink-0 overflow-hidden"
            >
              <div className="logo-rotator-track flex flex-col">
                {/* Per-logo heights : the three
                    wordmark files pad their letterforms very
                    differently inside their viewBoxes (Google's
                    letters fill only about half its height,
                    NVIDIA's about two thirds), so one shared
                    height made Google and OpenAI look smaller
                    than NVIDIA. Each logo gets the height that
                    puts its LETTERS at the same size. */}
                {[
                  { src: "/logos/openai-logo.svg", cls: "h-[26px]" },
                  { src: "/logos/google-logo.svg", cls: "h-[30px]" },
                  { src: "/logos/nvidia-logo.svg", cls: "h-[22px]" },
                  { src: "/logos/openai-logo.svg", cls: "h-[26px]" },
                ].map((logo, index) => (
                  <div
                    key={`${logo.src}-${index}`}
                    className="flex h-9 items-center justify-center px-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt=""
                      className={`${logo.cls} w-auto max-w-[116px] object-contain`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <span className="text-sm font-semibold text-shadow-sm">
              {ja.homeAiCheckLine}
            </span>
          </div>
          <button
            type="button"
            onClick={onStart}
            className="start-button-pulse ml-auto mr-16 rounded bg-white px-6 py-3 text-base font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {ja.homeStartButton}
          </button>
        </div>
        </div>
      </div>
    </section>
  );
}

interface ShokubaLandingProps {
  onStart: () => void;
}
