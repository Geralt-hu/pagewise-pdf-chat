"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase, authHeader } from "@/lib/supabase";
import Brand from "@/components/Brand";

type Source = { page: number; snippet: string; score: number };
type Msg = { role: "user" | "assistant"; text: string; sources?: Source[] };

const SUGGESTIONS = ["Summarize this document", "What are the key points?", "List any important dates or numbers"];

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [page, setPage] = useState(1);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: doc } = await supabase.from("documents").select("name,storage_path").eq("id", id).single();
      if (!doc) return;
      setName(doc.name);
      const { data } = await supabase.storage.from("pdfs").createSignedUrl(doc.storage_path, 3600);
      if (data) setPdfUrl(data.signedUrl);
    })();
  }, [id]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  function goToPage(p: number) {
    if (window.matchMedia("(min-width: 768px)").matches) setPage(p);
    else if (pdfUrl) window.open(`${pdfUrl}#page=${p}`, "_blank");
  }

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput(""); setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "" }]);

    const update = (patch: Partial<Msg>) =>
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ documentId: id, question }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json()).error ?? "Request failed");

      const sources: Source[] = JSON.parse(decodeURIComponent(res.headers.get("x-sources") ?? "[]"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let out = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        out += decoder.decode(value, { stream: true });
        update({ text: out, sources });
      }
    } catch (e) {
      update({ text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  // Turns "[p. 3]" in the answer into clickable citation chips
  function renderWithCitations(text: string) {
    return text.split(/(\[p\.\s*\d+\])/g).map((part, i) => {
      const m = part.match(/^\[p\.\s*(\d+)\]$/);
      if (!m) return <span key={i}>{part}</span>;
      const p = Number(m[1]);
      return (
        <button
          key={i} onClick={() => goToPage(p)}
          className="mx-0.5 rounded-md bg-accent-soft px-1.5 py-0.5 align-baseline text-xs font-medium text-accent transition hover:bg-accent hover:text-accent-ink"
        >
          p. {p}
        </button>
      );
    });
  }

  return (
    <div className="grid h-dvh grid-cols-1 md:grid-cols-2">
      {/* Chat column */}
      <section className="flex min-h-0 flex-col md:border-r md:border-line">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Link href="/" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-line hover:text-ink" aria-label="Back to documents">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </Link>
          <span className="min-w-0 flex-1 truncate font-medium">{name || "Loading…"}</span>
          <span className="hidden lg:block"><Brand /></span>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-6">
          {msgs.length === 0 && (
            <div className="rise mx-auto mt-10 max-w-md text-center">
              <h2 className="font-display text-3xl tracking-tight">Ask this document</h2>
              <p className="mt-2 text-muted">Answers come with page citations you can click.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm transition hover:border-accent hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-paper">{m.text}</div>
              </div>
            ) : (
              <div key={i} className="max-w-[92%] border-l-2 border-accent pl-4">
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.text ? renderWithCitations(m.text) : (
                    <span className="inline-flex items-center gap-1 py-1"><span className="dot" /><span className="dot" /><span className="dot" /></span>
                  )}
                </div>
                {m.sources && m.sources.length > 0 && m.text && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted">Sources</span>
                    {[...new Set(m.sources.map((s) => s.page))].sort((a, b) => a - b).map((p) => (
                      <button
                        key={p} onClick={() => goToPage(p)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                          p === page ? "border-accent bg-accent text-accent-ink" : "border-line bg-card hover:border-accent hover:text-accent"
                        }`}
                      >
                        Page {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          <div ref={bottom} />
        </div>

        <div className="border-t border-line p-3 md:p-4">
          <div className="flex items-center gap-2 rounded-full border border-line bg-card py-1.5 pl-5 pr-1.5 transition focus-within:border-accent">
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent py-1.5 outline-none placeholder:text-muted"
              placeholder="Ask about this document…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button
              onClick={() => send()} disabled={busy || !input.trim()}
              className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-ink transition hover:opacity-90 disabled:opacity-40"
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
            </button>
          </div>
        </div>
      </section>

      {/* PDF column */}
      <section className="hidden min-h-0 flex-col bg-line/40 md:flex">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm text-muted">Page {page}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-line bg-card px-2.5 py-1 text-sm transition hover:border-accent" aria-label="Previous page">−</button>
            <button onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-line bg-card px-2.5 py-1 text-sm transition hover:border-accent" aria-label="Next page">+</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 p-3">
          {pdfUrl ? (
            <iframe key={page} src={`${pdfUrl}#page=${page}`} className="h-full w-full rounded-xl border border-line bg-card" title="PDF viewer" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted">Loading document…</div>
          )}
        </div>
      </section>
    </div>
  );
}
