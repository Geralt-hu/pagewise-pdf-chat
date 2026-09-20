const BASE = "https://generativelanguage.googleapis.com/v1beta";
const KEY = process.env.GEMINI_API_KEY!;
const EMBED_MODEL = process.env.EMBED_MODEL ?? "gemini-embedding-001";
const CHAT_MODEL = process.env.CHAT_MODEL ?? "gemini-2.5-flash";
export const EMBED_DIM = 768; // must match vector(768) in schema.sql

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function embedTexts(texts: string[], taskType: TaskType): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 50) {
    const batch = texts.slice(i, i + 50);
    const res = await fetch(`${BASE}/models/${EMBED_MODEL}:batchEmbedContents`, {
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
    });
    if (!res.ok) throw new Error(`Embedding failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    out.push(...data.embeddings.map((e: { values: number[] }) => e.values));
  }
  return out;
}

// Streams the model's answer as plain text chunks.
export async function streamAnswer(system: string, prompt: string): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${BASE}/models/${CHAT_MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Chat failed: ${res.status} ${await res.text()}`);

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const json = JSON.parse(line.slice(5).trim());
            const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            /* ignore partial/invalid lines */
          }
        }
      },
    })
  );
}
