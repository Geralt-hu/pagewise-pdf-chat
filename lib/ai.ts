const BASE = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY!;
const EMBED_MODEL = process.env.EMBED_MODEL ?? "gemini-embedding-001";
const CHAT_MODEL = process.env.CHAT_MODEL ?? "gemini-3.6-flash";
const CHAT_FALLBACK_MODEL = process.env.CHAT_FALLBACK_MODEL; // optional
export const EMBED_DIM = 768; // must match vector(768) in schema.sql

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retries temporary failures with exponential backoff.
// baseMs is the first delay; it doubles on each retry.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 3,
  baseMs = 800
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || !RETRYABLE.has(res.status) || attempt >= retries) return res;
    await sleep(baseMs * 2 ** attempt + Math.random() * 300);
  }
}

export async function embedTexts(texts: string[], taskType: TaskType): Promise<number[][]> {
  const BATCH = 20; // small batches stay under per-minute token limits
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetchWithRetry(
      `${BASE}/models/${EMBED_MODEL}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          requests: batch.map((t) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: t }] },
            taskType,
            outputDimensionality: EMBED_DIM,
          })),
        }),
      },
      2,
      4000
    );

    if (res.status === 429) {
      throw new Error(
        "AI quota reached. Please wait a few minutes (or until tomorrow if the daily limit is used) and try again."
      );
    }
    if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    out.push(...data.embeddings.map((e: { values: number[] }) => e.values));

    if (i + BATCH < texts.length) await sleep(1200); // pause between batches
  }
  return out;
}

// Streams the model's answer as plain text chunks.
export async function streamAnswer(system: string, prompt: string): Promise<ReadableStream<Uint8Array>> {
  const models = [CHAT_MODEL, CHAT_FALLBACK_MODEL].filter(Boolean) as string[];
  let lastStatus = 0;
  let lastBody = "";

  for (const model of models) {
    const res = await fetchWithRetry(
      `${BASE}/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      },
      2
    );
    if (res.ok && res.body) return toTextStream(res.body);
    lastStatus = res.status;
    lastBody = await res.text();
    if (!RETRYABLE.has(res.status)) break; // e.g. bad key or model name: fallback won't help
  }

  if (lastStatus === 429) {
    throw new Error("AI quota reached. Please wait a few minutes and try again.");
  }
  if (RETRYABLE.has(lastStatus)) {
    throw new Error("The AI model is busy right now. Please try again in a minute.");
  }
  throw new Error(`Chat failed: ${lastStatus} ${lastBody}`);
}

function toTextStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            const text =
              json.candidates?.[0]?.content?.parts
                ?.map((p: { text?: string }) => p.text ?? "")
                .join("") ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            /* ignore partial/invalid lines */
          }
        }
      },
    })
  );
}
