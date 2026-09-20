import { NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/serverSupabase";
import { embedTexts, streamAnswer } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You answer questions about a document using ONLY the context provided.
- Cite the page for every claim like [p. 3].
- If the answer is not in the context, say you could not find it in the document.
- Be concise and do not invent facts.`;

export async function POST(req: Request) {
  const { sb, user } = await supabaseForRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, question } = await req.json();
  if (!documentId || typeof question !== "string" || !question.trim() || question.length > 1000) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const [queryEmbedding] = await embedTexts([question], "RETRIEVAL_QUERY");
    const { data: matches, error } = await sb.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_count: 5,
      doc_id: documentId,
    });
    if (error) throw new Error(error.message);

    const context = (matches ?? [])
      .map((m: { page: number; content: string }) => `[p. ${m.page}]\n${m.content}`)
      .join("\n\n---\n\n");

    const stream = await streamAnswer(SYSTEM, `Context:\n${context}\n\nQuestion: ${question}`);

    const sources = (matches ?? []).map((m: { page: number; content: string; similarity: number }) => ({
      page: m.page,
      snippet: m.content.slice(0, 200),
      score: Number(m.similarity.toFixed(3)),
    }));

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-sources": encodeURIComponent(JSON.stringify(sources)),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
