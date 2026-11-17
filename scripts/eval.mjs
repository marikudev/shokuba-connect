// Evaluation runner. Translates the sample sentences in
// tests/fixtures/sentences.json through the RUNNING app's
// /api/translate endpoint — the real pipeline, including the
// glossary and the number/prohibition checks.
//
// THIS SPENDS REAL OPENROUTER CREDIT — the runner's own key is used
// (BYOK, : the app has no shared key anymore). It is a
// manual tool only: never wire it into CI, a cron, or a build step,
// and only run it when the operator has explicitly decided to spend
// the credit (PRD section 16, M6). Cost is roughly US$0.0001 per
// request with the paid Gemma model.
//
// Usage (PowerShell, from the project folder):
//   $env:OPENROUTER_API_KEY = "<your own OpenRouter API key>"
//   npm.cmd run eval -- --limit 5
// or, loading .env.local automatically (Node's built-in env file):
//   node --env-file=.env.local scripts/eval.mjs
//
// Environment:
//   OPENROUTER_API_KEY required — YOUR key; it is sent as the
//                  x-api-key header, exactly like the browser's key
//                  cookie but without the gate.
//   EVAL_BASE_URL default http://localhost:3000 — a local dev server
//                  or the production URL.
//   EVAL_MODEL default google/gemma-4-31b-it (the default paid
//                  model). openai/gpt-6-luna (paid, second
//                  choice) also works.
//
// Options:
//   --limit N evaluate at most N sentences (default: all)
//   --offset N skip the first N sentences (default: 0)
//
// Requests rotate through all seven languages, four per request (the
// app's panel maximum), and
// pause at least 4 seconds between calls. Credit is checked first
// through /api/usage; the run aborts when the account limit is
// already exhausted.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ALL_LANGS = ["id", "my", "pt", "en", "vi", "fil", "zh"];
const PAUSE_MS = 4000;
const REQUEST_TIMEOUT_MS = 120_000;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = (process.env.EVAL_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const model = process.env.EVAL_MODEL ?? "google/gemma-4-31b-it";
const apiKey = process.env.OPENROUTER_API_KEY ?? "";

function parseArgs(argv) {
  let limit = Number.POSITIVE_INFINITY;
  let offset = 0;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--limit") {
      limit = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 1;
    } else if (argv[i] === "--offset") {
      offset = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 1;
    }
  }
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : Number.POSITIVE_INFINITY,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}

function loadSentences() {
  const path = join(root, "tests", "fixtures", "sentences.json");
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(
      `Missing ${path}.\nCopy tests/fixtures/sentences.example.json to sentences.json and fill it with 20-30 sample chourei sentences of your own (never real factory text).`,
    );
    process.exit(2);
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.error("sentences.json must be a JSON array.");
    process.exit(2);
  }
  return parsed
    .map((item) =>
      typeof item === "string"
        ? { text: item, division: "", topic: "" }
        : {
            text: String(item?.text ?? ""),
            division: String(item?.division ?? ""),
            topic: String(item?.topic ?? ""),
          },
    )
    .filter((item) => item.text.length > 0);
}

async function checkCreditFirst() {
  const response = await fetch(`${baseUrl}/api/usage`, {
    headers: { "x-api-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) {
    console.error(
      "API key rejected by /api/usage (401). Set OPENROUTER_API_KEY to a valid OpenRouter API key.",
    );
    process.exit(2);
  }
  const usage = await response.json().catch(() => null);
  if (!usage || usage.unavailable) {
    console.warn(
      "Usage data unavailable; continuing without a credit pre-check.",
    );
    return;
  }
  const remaining = usage.account?.limitRemaining;
  if (typeof remaining === "number") {
    console.log(`Account credit remaining: $${remaining.toFixed(2)}`);
    if (remaining <= 0) {
      console.error("Credit limit exhausted; aborting before any request.");
      process.exit(2);
    }
  } else if (typeof usage.account?.usageDaily === "number") {
    console.log(
      `Account usage today: $${usage.account.usageDaily.toFixed(4)} (uncapped account)`,
    );
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!apiKey) {
    console.error(
      "OPENROUTER_API_KEY is not set. See the header of scripts/eval.mjs for how to provide it.",
    );
    process.exit(2);
  }
  const { limit, offset } = parseArgs(process.argv.slice(2));
  const sentences = loadSentences().slice(offset, offset + limit);
  if (sentences.length === 0) {
    console.error("No sentences selected (check sentences.json, --limit, --offset).");
    process.exit(2);
  }

  console.log(
    `Evaluating ${sentences.length} sentence(s) via ${baseUrl} with model ${model}.`,
  );
  await checkCreditFirst();

  let failures = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const langs = [0, 1, 2, 3].map((k) => ALL_LANGS[(offset + i + k) % ALL_LANGS.length]);
    const label = `#${offset + i + 1} [${langs.join(",")}] ${sentence.text.slice(0, 40)}`;
    try {
      const response = await fetch(`${baseUrl}/api/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ ...sentence, langs, model }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        failures += 1;
        console.log(`${label}\n  REQUEST FAILED ${response.status} ${body.error ?? ""}`);
      } else {
        const body = await response.json();
        const parts = langs.map((code) => {
          const entry = body.results?.[code];
          if (!entry?.ok) {
            return `${code}: bad_output`;
          }
          return `${code}: ok${entry.numberMismatch ? " (number mismatch!)" : ""}`;
        });
        const failed = langs.some((code) => !body.results?.[code]?.ok);
        if (failed) {
          failures += 1;
        }
        console.log(
          `${label}\n  ${parts.join(" | ")}` +
            `${body.sourceFlags?.prohibition ? " | prohibition flag" : ""}` +
            `${body.glossarySkipped ? ` | glossarySkipped ${body.glossarySkipped}` : ""}` +
            `${body.uncertain?.length ? `\n  uncertain: ${body.uncertain.join(" / ")}` : ""}`,
        );
      }
    } catch (error) {
      failures += 1;
      console.log(`${label}\n  REQUEST ERROR ${error?.name ?? "unknown"}`);
    }
    if (i < sentences.length - 1) {
      await sleep(PAUSE_MS);
    }
  }

  console.log(
    `\nDone: ${sentences.length} request(s), ${failures} with failures.`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

await main();
