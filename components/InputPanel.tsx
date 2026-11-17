import { ja } from "@/lib/i18n/ja";
import { MAX_TEXT_LENGTH, validateSourceText } from "@/lib/validate";

// Japanese source input, at most 300 characters counted per code
// point, never truncated automatically. The translate button is disabled
// while the input is empty, over the limit, or contains control
// characters. The button runs a real translation request; while
// it runs, the button shows the translating label and a cancel button
// appears next to it (PRD section 6).
// the helper text under the input is always visible.
interface InputPanelProps {
  text: string;
  onTextChange: (value: string) => void;
  onTranslate: () => void;
  onSave: () => void;
  translating?: boolean;
  onCancel?: () => void;
  // when every visible language already has a result for the
  // current input, the page passes the 翻訳済み label and disables the
  // button so no second request can be sent for the same input.
  translateLabel?: string;
  translateDisabled?: boolean;
  // Usage meter, shown at the right end of the header row since
  // the follow-up (the character counter moved next to the
  // label to make room). Null hides it. Label and amount travel
  // separately so the amount can be coloured alone — green for
  // today's usage.
  usageParts?: { label: string; amount: string; green: boolean } | null;
}

export function InputPanel({
  text,
  onTextChange,
  onTranslate,
  onSave,
  translating = false,
  onCancel,
  translateLabel,
  translateDisabled = false,
  usageParts,
}: InputPanelProps) {
  const validation = validateSourceText(text);

  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-mist bg-white p-3">
      <div className="flex items-baseline gap-3">
        <label htmlFor="source-text" className="text-sm font-semibold">
          {ja.sourceLabel}
        </label>
        <span className="text-xs text-neutral-500">
          {validation.charCount} / {MAX_TEXT_LENGTH} {ja.charUnit}
        </span>
        {usageParts ? (
          <span className="ml-auto text-sm font-semibold whitespace-nowrap">
            {usageParts.label}：
            <span className={usageParts.green ? "font-semibold text-green-700" : undefined}>
              {usageParts.amount}
            </span>
          </span>
        ) : null}
      </div>
      <textarea
        id="source-text"
        value={text}
        onChange={(event) => {
          onTextChange(event.target.value);
        }}
        rows={10}
        placeholder={ja.inputPlaceholder}
        className="w-full rounded border border-mist px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-700"
      />
      <p className="text-xs font-semibold text-red-700">{ja.helperText}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!validation.isValid || translating || translateDisabled}
          onClick={onTranslate}
          className="rounded bg-ink px-4 py-1.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {translating
            ? ja.translatingLabel
            : (translateLabel ?? ja.translateButton)}
        </button>
        {translating && onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-ink px-4 py-1.5 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {ja.cancelButton}
          </button>
        ) : null}
        {/* opens the save dialog (slot choice + required title). */}
        <button
          type="button"
          disabled={!validation.isValid}
          onClick={onSave}
          className="rounded border border-ink px-4 py-1.5 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ja.saveButton}
        </button>
      </div>
    </section>
  );
}
