# 職場コネクト — Shokuba Connect

Shokuba Connect is one web app with two products that lower the language barrier between Japanese staff and foreign workers:

- **朝礼コネクト (Chourei Connect)** — prepares and translates morning-meeting (朝礼, *chōrei*) announcements and work instructions from Japanese into the languages the team actually speaks: Indonesian, Burmese (Myanmar), Brazilian Portuguese, American English, Vietnamese, Tagalog, and Simplified Chinese.
- **面談コネクト (Mendan Connect)** — a voice-first interpretation companion for one-on-one meetings (performance reviews, personal consultations, retention talks). *In preparation; it launches after Chourei Connect.*

Both products share one gate and one API key: each operator uses **their own OpenRouter API key** (BYOK). The app has no accounts, no database, and stores nothing on its server — work data lives only in the operator's browser.

The full specification is [docs/PRD.md](docs/PRD.md), the single source of truth.

## 朝礼コネクト — how it works

The operator writes a short announcement in Japanese (max 300 characters), fills in the required **industry** （業種）, **division** （部署） and **topic** （話題） so the model has the context, picks a translation model, and translates into 1 to 4 large, readable panels in a single request (four panels form a 2×2 grid). Announcements can be saved to 20 preparation cards kept in the browser, copied, shown fullscreen on the big meeting-room monitor, or read aloud with the browser's built-in voices. The input column can be hidden for display, leaving a narrow card rail beside the panels. A verified safety glossary and automatic number/prohibition checks help the operator review the result before it is shown, and anything the model finds unclear is listed for the operator in Japanese under 「確認が必要な点」.

## Honest limitations (please read)

- This is a **machine-translation aid, not an official translation**, and it produces no audit evidence.
- **No output language has been validated by native speakers**, except individual glossary entries marked `verified`. Always have important content verified by a speaker or translator of that language before acting on it.
- Explanations the model adds for terms that have no equivalent in the target language are written by the model and can be wrong. Only terms in the verified glossary are guaranteed to be used exactly as given.
- **Do not enter personal information or company secrets.** Text is sent to OpenRouter and to the model provider that serves the request (providers can change); for paid models the app always sends `provider.data_collection: "deny"`, but the providers' own data policies still apply.
- Translation costs are charged per request to the owner of the API key used (measured at roughly $0.0001 per translation in model testing). Services can fail or be slow.
- The number check and prohibition check are suspicion signals for a human reviewer, not proof that a translation is right or wrong. There is a residual prompt-injection risk, documented in the PRD.
- **No accuracy is claimed.**

## Current models

The specification never names models — they are reviewed and can be replaced every 2–3 months. This section is the living record of what the app currently offers, updated at each review:

| Role | Model | Notes |
|---|---|---|
| Paid (server default) | Gemma 4 31B (`google/gemma-4-31b-it`) | Sends `provider.data_collection: "deny"` on every request. |
| Paid | GPT-6 Luna (`openai/gpt-6-luna`) | Sends `provider.data_collection: "deny"` on every request. |
| Free | Nemotron 3 Ultra 550B (`nvidia/nemotron-3-ultra-550b-a55b:free`) | Cannot be sent the data-collection denial (its endpoint rejects it); a warning strip is shown in the app while it is active. Burmese and Tagalog are blocked for this model. Reasoning is sent disabled. |

Paid models are usable only while the account keeps more than **$1** of credit: when the remaining credit reaches $1, the app asks the operator to top up or switch to the free model, so a balance never runs negative.

## Privacy and cost model

- The operator's key is checked once, then kept only in an httpOnly cookie in their own browser (24-hour session). The server never stores, logs, or returns it.
- Cards and drafts live in the browser's local storage. The 「セッションを削除」 button wipes the key, the cards, and the input from that browser — use it on shared PCs.
- Usage is measured without any in-app analytics: the hosting dashboard's function-invocation counts are read as approximations — `/api/verify` ≈ sessions started, `/api/translate` ≈ translation actions run (`/api/usage` is ignored; the usage meter calls it).

## Glossary

The only glossary is the safety-and-health glossary at `data/glossary/anzen.json`. It ships **empty**; entries are added only after a native speaker or translator has verified them, and only `verified` entries are ever used.

## Run locally

Requires Node.js 26 (see `.nvmrc`).

```bash
npm install
```

Create `.env.local` with the development mode (mock LLM — no key, no cost):

```text
LLM_MODE=mock
OPENROUTER_MODEL=google/gemma-4-31b-it
```

```bash
npm run dev     # develop
npm run check   # lint + typecheck + tests
npm run build   # production build
```

Real OpenRouter calls happen only in production configuration (`LLM_MODE=openrouter`); the mock mode is refused in production builds. The evaluation script (`npm run eval`) spends real credit, so it is run manually, never in CI.

## Source

The source is published openly so it can be read and studied.
