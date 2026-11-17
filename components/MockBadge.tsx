import { ja } from "@/lib/i18n/ja";

// a fixed badge shown whenever the app runs with LLM_MODE=mock,
// so mock output can never be mistaken for a real translation. The root
// layout decides whether to render it; in production the mock mode is
// rejected outright (SEC-12), so the badge never appears there.
export function MockBadge() {
  return (
    <p className="bg-ink px-4 py-1 text-center text-xs font-bold text-white">
      {ja.mockBadge}
    </p>
  );
}
