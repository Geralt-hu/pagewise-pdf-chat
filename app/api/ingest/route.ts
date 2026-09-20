import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { supabaseForRequest } from "@/lib/serverSupabase";
import { chunkPages } from "@/lib/chunk";
import { embedTexts } from "@/lib/ai";
import { enforceRateLimit, INGEST_RULES } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAGES = 200;

export async function POST(req: Request) {
  const { sb, user } = await supabaseForRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await enforceRateLimit(sb, INGEST_RULES);
  if (limited) return limited;

  const { documentId } = await req.json();
  const { data: doc, error: docErr } = await sb
    .from("documents").select("*").eq("id", documentId).single();
  if (docErr || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  if (doc.status !== "processing") {
    return NextResponse.json({ error: "Document was already processed" }, { status: 409 });
  }

  try {
    const { data: file, error: dlErr } = await sb.storage.from("pdfs").download(doc.storage_path);
    if (dlErr || !file) throw new Error("Could not download file");

    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    if (pages.length > MAX_PAGES) throw new Error(`PDF has too many pages (max ${MAX_PAGES})`);

    const chunks = chunkPages(pages);
    if (chunks.length === 0) throw new Error("No readable text found (is this a scanned PDF?)");

    const embeddings = await embedTexts(chunks.map((c) => c.content), "RETRIEVAL_DOCUMENT");

    const rows = chunks.map((c, i) => ({
      document_id: doc.id,
      user_id: user.id,
      page: c.page,
      content: c.content,
      embedding: embeddings[i],
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await sb.from("chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(error.message);
    }

    await sb.from("documents").update({ status: "ready", page_count: pages.length, error: null }).eq("id", doc.id);
    return NextResponse.json({ ok: true, chunks: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    await sb.from("documents").update({ status: "failed", error: message }).eq("id", doc.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
