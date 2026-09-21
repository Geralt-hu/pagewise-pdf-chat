"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase, authHeader } from "@/lib/supabase";
import Brand from "@/components/Brand";

type Doc = { id: string; name: string; status: string; error: string | null; created_at: string };

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  return session ? <Dashboard userId={session.user.id} /> : <AuthForm />;
}

/* ---------------------------- Auth ---------------------------- */

const FEATURES = [
  {
    title: "Upload any PDF",
    text: "Notes, papers, syllabi or reports, up to 10 MB.",
    icon: (
      <>
        <path d="M12 16V4M7 9l5-5 5 5" />
        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
      </>
    ),
  },
  {
    title: "Answers with citations",
    text: "Every answer names the page it came from, so you can check it.",
    icon: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 14l2 2 4-4" />
      </>
    ),
  },
  {
    title: "Private by default",
    text: "Your files and chats are visible only to your account.",
    icon: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
];

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) setMsg({ text: error.message, ok: false });
    else if (mode === "up") setMsg({ text: "Account created. If email confirmation is on, check your inbox, then sign in.", ok: true });
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      {/* Left half: what Pagewise is */}
      <aside className="hero-bg relative hidden flex-col justify-between gap-12 overflow-hidden p-10 md:flex lg:p-14">
        <Brand />

        <div className="rise max-w-lg">
          <p className="mb-5 inline-block rounded-full border border-line px-3 py-1 text-xs uppercase tracking-widest text-muted">
            PDF Q&amp;A with citations
          </p>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight lg:text-5xl">
            Ask your documents anything.
          </h1>
          <p className="mt-5 text-lg text-muted">
            Upload a PDF and chat with it. Pagewise finds the relevant passages and answers from them, with the exact page cited.
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-card/60 text-accent">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {f.icon}
                  </svg>
                </span>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-muted">Built with Next.js, Supabase and pgvector.</p>
      </aside>

      {/* Right half: login */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="rise w-full max-w-sm">
          <div className="mb-10 md:hidden">
            <Brand />
            <p className="mt-3 text-sm text-muted">Upload a PDF and ask it questions. Every answer cites its page.</p>
          </div>

          <h2 className="font-display text-3xl tracking-tight">
            {mode === "in" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-muted">
            {mode === "in" ? "Sign in to see your documents." : "It takes a few seconds."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Email</span>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink outline-none transition focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Password</span>
              <input
                type="password" required minLength={6}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink outline-none transition focus:border-accent"
              />
            </label>
            <button
              type="submit" disabled={loading}
              className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-ink transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>

          {msg && (
            <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"}`}>
              {msg.text}
            </p>
          )}

          <p className="mt-8 text-sm text-muted">
            {mode === "in" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-accent underline underline-offset-4"
              onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}
            >
              {mode === "in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

/* --------------------------- Dashboard --------------------------- */

function StatusPill({ status }: { status: string }) {
  if (status === "ready")
    return <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">Ready</span>;
  if (status === "failed")
    return <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">Failed</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
      <span className="dot" style={{ background: "currentColor", width: 5, height: 5 }} />
      Processing
    </span>
  );
}

function Dashboard({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("documents").select("id,name,status,error,created_at")
      .order("created_at", { ascending: false });
    setDocs(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function removeDoc(id: string) {
    setError("");
    setDeletingId(id);
    try {
      const { data: doc, error: fetchErr } = await supabase
        .from("documents").select("storage_path").eq("id", id).single();
      if (fetchErr || !doc) throw new Error("Document not found");

      // 1. delete the file, 2. delete the row (chunks are removed automatically)
      const { error: storageErr } = await supabase.storage.from("pdfs").remove([doc.storage_path]);
      if (storageErr) throw new Error(storageErr.message);

      const { error: delErr } = await supabase.from("documents").delete().eq("id", id);
      if (delErr) throw new Error(delErr.message);

      setDocs((d) => d.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the document");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function handleFile(file: File) {
    if (busy) return;
    if (file.type !== "application/pdf") return setError("Please choose a PDF file.");
    if (file.size > 10 * 1024 * 1024) return setError("File is larger than 10 MB.");

    setError(""); setBusy(true);
    try {
      const path = `${userId}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from("pdfs").upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw new Error(up.error.message);

      const ins = await supabase.from("documents").insert({ name: file.name, storage_path: path }).select("id").single();
      if (ins.error) throw new Error(ins.error.message);
      await load();

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ documentId: ins.data.id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Processing failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      load();
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Brand />
          <button className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rise">
          <h1 className="font-display text-4xl tracking-tight">Your documents</h1>
          <p className="mt-2 text-muted">Upload a PDF, then ask it questions. Answers cite their pages.</p>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={`mt-8 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
            drag ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-accent"
          } ${busy ? "pointer-events-none opacity-70" : ""}`}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
            <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <span className="font-medium">
            {busy ? "Processing… this can take up to a minute" : "Drop a PDF here, or click to browse"}
          </span>
          <span className="text-sm text-muted">PDF only, up to 10 MB</span>
          <input type="file" accept="application/pdf" className="hidden" onChange={onPick} disabled={busy} />
        </label>

        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <ul className="mt-8 space-y-3">
          {docs.map((d) => (
            <li key={d.id} className="rise flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {new Date(d.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {d.status === "failed" && d.error && <p className="mt-1 text-xs text-danger">{d.error}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusPill status={d.status} />
                {d.status === "ready" && (
                  <Link href={`/chat/${d.id}`} className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-ink transition hover:opacity-90">
                    Open chat
                  </Link>
                )}
                {confirmId === d.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    <button
                      disabled={deletingId === d.id}
                      onClick={() => removeDoc(d.id)}
                      className="rounded-lg bg-danger px-3 py-1.5 font-medium text-paper transition hover:opacity-90 disabled:opacity-60"
                    >
                      {deletingId === d.id ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-muted hover:text-ink">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(d.id)}
                    className="text-sm text-muted transition hover:text-danger"
                    aria-label={`Remove ${d.name}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
          {docs.length === 0 && (
            <li className="rounded-2xl border border-line px-5 py-8 text-center text-sm text-muted">
              No documents yet. Upload your first PDF above.
            </li>
          )}
        </ul>
      </main>
    </div>
  );
}
