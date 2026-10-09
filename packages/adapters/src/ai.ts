import Anthropic from '@anthropic-ai/sdk';
import type { Lang } from '@sp/core';
import { fixtureFor } from './fixtures';

// ------------------------------------------------------------------ Speech to text

export interface TranscribeRequest {
  audio: Buffer;
  mimeType: string;
  languageHint?: Lang;
  /** Trade vocabulary to bias recognition (Whisper `prompt`). */
  vocabulary?: string;
  /** Mock only: selects a fixture transcript. */
  fixtureKey?: string;
}

export interface TranscribeResult {
  text: string;
  language: string;
  confidence: number;
  modelVersion: string;
}

export interface SpeechToText {
  transcribe(req: TranscribeRequest): Promise<TranscribeResult>;
}

export class MockSpeechToText implements SpeechToText {
  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    return { text: fixtureFor(req.fixtureKey).transcript, language: 'en', confidence: 0.93, modelVersion: 'mock-stt/1' };
  }
}

/** OpenAI-compatible Whisper endpoint (`POST {base}/audio/transcriptions`). Base URL, key and model from env. */
export class WhisperSpeechToText implements SpeechToText {
  constructor(private readonly cfg: { baseUrl: string; apiKey?: string; model: string; fetchImpl?: typeof fetch }) {}
  async transcribe(req: TranscribeRequest): Promise<TranscribeResult> {
    const form = new FormData();
    const ext = req.mimeType.includes('ogg') ? 'ogg' : req.mimeType.includes('mpeg') ? 'mp3' : req.mimeType.includes('wav') ? 'wav' : 'm4a';
    form.append('file', new Blob([new Uint8Array(req.audio)], { type: req.mimeType }), `voice.${ext}`);
    form.append('model', this.cfg.model);
    form.append('response_format', 'verbose_json');
    if (req.vocabulary) form.append('prompt', req.vocabulary);
    if (req.languageHint === 'sn') form.append('language', 'sn');
    const res = await (this.cfg.fetchImpl ?? fetch)(`${this.cfg.baseUrl.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {},
      body: form,
    });
    if (!res.ok) throw Object.assign(new Error(`Transcription failed (${res.status})`), { retryable: res.status >= 500 || res.status === 429 });
    const json = (await res.json()) as { text: string; language?: string; segments?: { avg_logprob?: number }[] };
    const logprobs = (json.segments ?? []).map((s) => s.avg_logprob).filter((x): x is number => typeof x === 'number');
    const confidence = logprobs.length ? Math.max(0, Math.min(1, Math.exp(logprobs.reduce((a, b) => a + b, 0) / logprobs.length))) : 0.75;
    return { text: json.text.trim(), language: json.language ?? 'unknown', confidence, modelVersion: `whisper/${this.cfg.model}` };
  }
}

// ------------------------------------------------------------------ LLM

export interface LlmImage {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Reference the model must use in evidence lists, e.g. "photo_after_1". */
  ref: string;
}

export interface LlmJsonRequest {
  promptId: string;
  promptVersion: string;
  system: string;
  user: string;
  images?: LlmImage[];
  jsonSchema: Record<string, unknown>;
  /** Mock only: selects a fixture. */
  fixtureKey?: string;
  /** Mock only: allowed unit codes for this trade. */
  allowedUnits?: string[];
}

export interface LlmJsonResult {
  json: unknown;
  modelVersion: string;
  promptVersion: string;
}

export interface LlmProvider {
  generateJson(req: LlmJsonRequest): Promise<LlmJsonResult>;
}

/** Deterministic fixture JSON in the exact SPEC §12 shape. */
export class MockLlmProvider implements LlmProvider {
  async generateJson(req: LlmJsonRequest): Promise<LlmJsonResult> {
    const f = fixtureFor(req.fixtureKey);
    if (req.promptId === 'image_checks') {
      return {
        json: { quality_ok: true, looks_like_trade_work: true, possible_stock_or_screenshot: false },
        modelVersion: 'mock-llm/1',
        promptVersion: req.promptVersion,
      };
    }
    const allowed = req.allowedUnits ? new Set(req.allowedUnits) : null;
    return {
      json: {
        job_type: req.fixtureKey ?? 'unknown',
        summary: f.summary,
        tasks: f.tasks,
        materials: f.materials,
        safety_measures: f.safety_measures,
        suggested_units: f.suggested_units.filter((u) => !allowed || allowed.has(u.code)),
        image_checks: { quality_ok: true, looks_like_trade_work: true, possible_stock_or_screenshot: false },
      },
      modelVersion: 'mock-llm/1',
      promptVersion: req.promptVersion,
    };
  }
}

export class LlmRefusalError extends Error {
  constructor(public readonly category: string | null) {
    super(`Model declined the request${category ? ` (${category})` : ''}`);
    this.name = 'LlmRefusalError';
  }
}

/**
 * Anthropic Messages API with structured JSON output (output_config.format). Model comes from LLM_MODEL; nothing
 * about the model is hard-coded. Only job evidence and pseudonymous references are sent — never names or phones.
 */
export class AnthropicLlmProvider implements LlmProvider {
  private readonly client: Anthropic;
  constructor(private readonly cfg: { apiKey?: string; baseUrl?: string; model: string }) {
    this.client = new Anthropic({ ...(cfg.apiKey ? { apiKey: cfg.apiKey } : {}), ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}) });
  }

  async generateJson(req: LlmJsonRequest): Promise<LlmJsonResult> {
    const content: Anthropic.ContentBlockParam[] = [];
    for (const img of req.images ?? []) {
      content.push({ type: 'text', text: `Image reference: ${img.ref}` });
      content.push({ type: 'image', source: { type: 'base64', media_type: img.mimeType, data: img.data.toString('base64') } });
    }
    content.push({ type: 'text', text: req.user });
    const params = {
      model: this.cfg.model,
      max_tokens: 16000,
      system: [{ type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user' as const, content }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: req.jsonSchema } },
    };
    const response = await this.client.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming);
    if (response.stop_reason === 'refusal') {
      const details = (response as unknown as { stop_details?: { category?: string | null } }).stop_details;
      throw new LlmRefusalError(details?.category ?? null);
    }
    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { json, modelVersion: response.model, promptVersion: req.promptVersion };
  }
}
