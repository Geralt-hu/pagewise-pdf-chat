export type Chunk = { page: number; content: string };

// Splits each page into overlapping windows of ~`size` characters
// (about 500 tokens at 2000 chars). Keeps the page number for citations.
export function chunkPages(pages: string[], size = 2000, overlap = 300): Chunk[] {
  const chunks: Chunk[] = [];

  pages.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return;

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + size, text.length);
      if (end < text.length) {
        // try to cut at a word boundary instead of mid-word
        const space = text.lastIndexOf(" ", end);
        if (space > start + size * 0.6) end = space;
      }
      const content = text.slice(start, end).trim();
      if (content.length > 50) chunks.push({ page: i + 1, content });
      if (end >= text.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  });

  return chunks;
}
