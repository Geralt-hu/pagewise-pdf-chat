# Pagewise PDF Chat

A production-grade, full-stack RAG (Retrieval-Augmented Generation) platform enabling conversational interactions with multi-page PDF documents. Features page-level chunking, vector similarity search via `pgvector`, streaming LLM responses, and an integrated PDF viewer with synchronized citation jumping.

🌐 **Live Demo:** [pagewise-pdf-chat.vercel.app](https://pagewise-pdf-chat.vercel.app/)  
📂 **Repository:** [github.com/Geralt-hu/pagewise-pdf-chat](https://github.com/Geralt-hu/pagewise-pdf-chat)

---

## Architecture Overview
[User Browser]
│
├── (Upload PDF) ───────► Next.js /api/ingest
│                             │
│                             ├──► Supabase Storage (Private bucket)
│                             ├──► PDF Parsing & Page-aware Chunking
│                             ├──► Google Gemini API (Text Embeddings)
│                             └──► Supabase Postgres (pgvector embeddings + metadata)
│
└── (Streaming Query) ──► Next.js /api/chat
│
├──► Supabase Postgres (Cosine Similarity Match via pgvector)
├──► Context-injected Prompt Construction
└──► Google Gemini API (Streamed Completion + Page Citations)

---

## Key Features

- **Asynchronous Ingestion Pipeline:** Uploads documents directly to secure cloud storage, extracts structured text per page, chunks content, generates vector embeddings, and tracks indexing status in real time.
- **Page-Level Vector Retrieval:** Queries are matched against document segments using `pgvector` cosine similarity, preserving original page numbers for precise source attribution.
- **Synchronized PDF Viewer:** Side-by-side split screen interface where clicking on inline source citations automatically jumps the built-in PDF viewer to the exact cited page.
- **Real-Time Response Streaming:** Low-latency conversational feedback using Next.js streaming API routes and Gemini generative AI streaming tokens.
- **Multi-Tenant Security:** Strict multi-user data isolation enforced at the database level using Supabase Row-Level Security (RLS) and isolated Supabase Storage buckets.

---

## System Stack & Layer Breakdown

| Layer | Technologies & Implementation |
| :--- | :--- |
| **Frontend** | **Next.js (App Router), React, TypeScript, Tailwind CSS**<br>• Supabase Auth UI integration<br>• Asynchronous upload manager with indexing status indicators<br>• Real-time SSE/ReadableStream chat interface<br>• Embedded PDF reader with programmatic page-jump controls |
| **Backend & APIs** | **Next.js Route Handlers**<br>• `/api/ingest`: Handles PDF extraction, chunking heuristics, embedding dispatch, and vector storage<br>• `/api/chat`: Performs vector similarity queries, dynamic prompt assembly, and token streaming |
| **Database & Vector Store** | **Supabase Postgres + `pgvector`**<br>• Relational schemas for users, documents, and chunk metadata<br>• `vector` data types for high-dimensional vector search using cosine distance (`<=>`) |
| **Security & Auth** | **Supabase Auth & Storage**<br>• Email/password authentication flow<br>• Database-level **Row-Level Security (RLS)** ensuring users only query their own documents<br>• Authenticated per-user private file storage policies |
| **AI & Embeddings** | **Google Gemini API**<br>• Vector embeddings for document chunks and user queries<br>• Conversational model for streaming generative synthesis with citations |
| **Deployment** | **Vercel** (Edge / Serverless infrastructure) |

---

## Engineering Design Decisions

### 1. Document Chunking Strategy
Instead of generic naive character splitting, the ingestion pipeline splits text while strictly maintaining page-level metadata. This guarantees that every retrieved chunk retains its exact page origin, eliminating source hallucination and enabling direct document-viewer synchronization.

### 2. Database-Level Isolation (RLS)
Security is enforced at the database engine level using Postgres Row-Level Security rather than solely relying on application middleware:
```sql
-- Example RLS Policy pattern used on document chunks
CREATE POLICY "Users can only query their own document vectors"
ON document_chunks
FOR SELECT
USING (auth.uid() = user_id);
```
Even if a vector search query executes across the entire table, Postgres enforces that the user cannot retrieve or calculate similarity against another tenant's vector embeddings.

3. Streaming Retrieval-Augmented Generation
To minimize Time to First Token (TTFT), the /api/chat route pipes streaming tokens directly back over HTTP as they are yielded from the Gemini model, reducing perceptible latency compared to traditional blocking responses.

Getting Started
Prerequisites
Node.js: v18.0.0 or later

Package Manager: npm, pnpm, or yarn

Supabase Account: Configured project with pgvector extension enabled

Google Gemini API Key: Access to Gemini models and embedding endpoints

Environment Setup
Create a .env.local file in the project root:

Code snippet
# Next.js / Public
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend Secrets
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_google_gemini_api_key
Installation & Local Run
Clone the repository:

Bash
git clone [https://github.com/Geralt-hu/pagewise-pdf-chat.git](https://github.com/Geralt-hu/pagewise-pdf-chat.git)
cd pagewise-pdf-chat
Install dependencies:

Bash
npm install
Start the local development server:

Bash
npm run dev
Navigate to http://localhost:3000 to access the app.

Deployment
Vercel
Push your repository to GitHub.

Import the project in the Vercel Dashboard.

Configure all variables defined in .env.local under Project Settings > Environment Variables.

Deploy the application.

License
Distributed under the MIT License.


---

### Update It on GitHub

Replace your local `README.md` contents with the above text and run:

```bash
git add README.md
git commit -m "docs: document full-stack architecture, RAG pipeline, and technical specs"
git push origin main
