# Pagewise

A full-stack RAG (retrieval-augmented generation) app for chatting with PDFs. Upload a document, ask questions, and every answer cites the page it came from. Clicking a citation jumps the built-in PDF viewer to that page, so answers can be checked against the source.

**Live demo:** [pagewise-pdf-chat.vercel.app](https://pagewise-pdf-chat.vercel.app/)

## Features

- **Page-aware retrieval.** Text is extracted page by page and chunked so every chunk keeps its page number. Questions are matched against chunks with pgvector cosine similarity.
- **Cited answers.** The model is instructed to answer only from the retrieved context and to cite pages like `[p. 3]`. Citations render as clickable chips.
- **Synced PDF viewer.** Chat on one side, the PDF on the other. Clicking a citation opens the PDF at that page.
- **Streaming responses.** Answers stream token by token from Gemini through a Next.js route handler.
- **Per-user data isolation.** Supabase Auth, row-level security on every table, and private per-user file storage.
- **Document management.** Upload progress with a status for each document (processing, ready, failed), and a remove button that deletes the file, its chunks and its embeddings.
- **Abuse protection.** Per-user rate limiting on the chat and ingest endpoints, plus retry with backoff and an optional fallback model for temporary API errors.

## How it works

```
Browser (Next.js + React)
  |
  |-- Upload PDF --> Supabase Storage (private bucket, one folder per user)
  |        '------> POST /api/ingest
  |                   |- extract text page by page
  |                   |- split into overlapping chunks (page number kept)
  |                   |- embed chunks with Gemini
  |                   '- store vectors in Postgres (pgvector)
  |
  '-- Ask a question --> POST /api/chat
                          |- embed the question
                          |- match_chunks(): top 5 chunks by cosine similarity
                          |- build a prompt from the retrieved chunks
                          '- stream Gemini's answer back with page citations
```

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS |
| API | Next.js route handlers: `/api/ingest` and `/api/chat` |
| Database | Supabase Postgres with the `pgvector` extension |
| Auth and storage | Supabase Auth (email and password), Supabase Storage |
| AI | Google Gemini API (embeddings and answer generation) |
| Hosting | Vercel |

## Design decisions

**Page-level chunking.** Each page is split on its own, so a chunk never spans two pages and always has an exact page number. This is what makes page citations and the viewer jump possible. Chunks are about 2,000 characters with 300 characters of overlap, so a sentence cut at a boundary still appears whole in one chunk.

**Security enforced in the database.** Access control lives in Postgres row-level security instead of only in application code. The API routes forward the user's token, so every query runs as that user and the policies apply to it:

```sql
create policy "own chunks" on chunks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

The `match_chunks` similarity function runs as the calling user, not as a privileged role, so a search can never return another user's vectors. Storage policies restrict each user to their own folder in the `pdfs` bucket.

**Rate limiting in Postgres.** On Vercel each request may run on a different server instance, so an in-memory counter would not work. A Postgres function (`check_rate_limit`) increments a per-user counter atomically with `insert ... on conflict do update`, so concurrent requests cannot slip past the limit. Limits are set in `lib/rateLimit.ts`.

**Resilience against API errors.** Calls to Gemini are retried with exponential backoff on 429 and 5xx errors, embeddings are sent in small batches with pauses to stay under quotas, and a fallback chat model can be configured.

## Known limitations

- Scanned PDFs have no text layer, so they are rejected. They would need an OCR step.
- Ingestion runs inside one serverless request (60-second limit), so uploads are capped at 10 MB and 200 pages. Larger files would need resumable batch ingestion or a background queue.
- Each question is answered on its own, without chat history, so follow-ups like "explain that more" lack context.
- Retrieval uses the top 5 chunks, which suits specific questions better than whole-document tasks such as summaries.
- Citations come from the model and are not verified automatically, so they reduce hallucination but do not eliminate it.

## Getting started

**Prerequisites:** Node.js 20.9 or later (required by Next.js 16), a Supabase project, and a Gemini API key from Google AI Studio.

1. Clone and install:

   ```bash
   git clone https://github.com/Geralt-hu/pagewise-pdf-chat.git
   cd pagewise-pdf-chat
   npm install
   ```

2. In the Supabase dashboard, open the SQL Editor and run `supabase/schema.sql`. It creates the tables, the pgvector index, the `match_chunks` function, the row-level security policies and the private storage bucket. Then run `supabase/rate_limit.sql` for the rate limiter.

3. Create `.env.local` in the project root:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   GEMINI_API_KEY=your-gemini-api-key

   # Optional: model names (check Google's docs for current ones)
   EMBED_MODEL=gemini-embedding-001
   CHAT_MODEL=gemini-3.6-flash
   CHAT_FALLBACK_MODEL=
   ```

   The app does not need the Supabase service role key. Never put it in this project.

4. Start the dev server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Deployment

Push the repository to GitHub, import it into Vercel, and add the same environment variables under **Project Settings, Environment Variables**. After the first deploy, set your Vercel URL as the **Site URL** in Supabase under **Authentication, URL Configuration**.
