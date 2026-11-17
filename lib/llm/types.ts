import type { LanguageCode } from "@/lib/languages";

// The LLM layer contract (PRD sections 7 and 8). Routes only ever talk
// to this interface; the OpenRouter and mock implementations live behind
// it and are selected by LLM_MODE in lib/llm/index.ts.

export interface LlmTranslateRequest {
  text: string;
  division: string;
  topic: string;
  langs: readonly LanguageCode[];
  // Glossary prompt lines (PRD section 10), selected by the
  // glossary loader; may be empty.
  glossaryLines: string[];
}

export interface LlmTranslateResult {
  // Only languages whose output passed validation (PRD section 9) are
  // present. The route turns a missing language into a per-language
  // "bad_output" entry.
  translations: Partial<Record<LanguageCode, string>>;
  uncertain: string[];
  // True when the reply as a whole could not be used (unparseable JSON,
  // or a truncated reply with finish_reason "length"). The route then
  // marks every requested language as "bad_output".
  parseFailed: boolean;
}

export interface LlmClient {
  readonly model: string;
  readonly isMock: boolean;
  translate(request: LlmTranslateRequest): Promise<LlmTranslateResult>;
}
