import type { Chunk } from "@/features/article/articleTypes";
import type { ChunkPosition } from "./highlightTypes";

export function matchChunkPositions(original: string, chunks: Chunk[]): ChunkPosition[] {
  const usedRanges: Array<{ start: number; end: number }> = [];

  return chunks.map((chunk) => {
    const exact = findUnusedRange(original, chunk.english, usedRanges);
    if (exact) {
      usedRanges.push(exact);
      return { chunkId: chunk.chunkId, ...exact, confidence: "exact" };
    }

    const normalized = findNormalizedRange(original, chunk.english, usedRanges);
    if (normalized) {
      usedRanges.push(normalized);
      return { chunkId: chunk.chunkId, ...normalized, confidence: "normalized" };
    }

    return { chunkId: chunk.chunkId, start: -1, end: -1, confidence: "failed" };
  });
}

export function matchSingleChunk(original: string, english: string): ChunkPosition {
  const exactIndex = original.indexOf(english);
  if (exactIndex >= 0) {
    return { chunkId: "selected", start: exactIndex, end: exactIndex + english.length, confidence: "exact" };
  }

  const normalized = findNormalizedRange(original, english, []);
  if (normalized) {
    return { chunkId: "selected", ...normalized, confidence: "normalized" };
  }

  return { chunkId: "selected", start: -1, end: -1, confidence: "failed" };
}

export function matchChunkPositionLoose(original: string, chunk: Chunk): ChunkPosition {
  const match = matchSingleChunk(original, chunk.english);
  return { ...match, chunkId: chunk.chunkId };
}

function findUnusedRange(
  original: string,
  needle: string,
  usedRanges: Array<{ start: number; end: number }>
): { start: number; end: number } | null {
  let start = original.indexOf(needle);

  while (start >= 0) {
    const end = start + needle.length;
    if (!overlapsUsedRange(start, end, usedRanges)) {
      return { start, end };
    }

    start = original.indexOf(needle, start + 1);
  }

  return null;
}

function findNormalizedRange(
  original: string,
  needle: string,
  usedRanges: Array<{ start: number; end: number }>
): { start: number; end: number } | null {
  const normalizedNeedle = normalizeText(needle);

  for (let start = 0; start < original.length; start += 1) {
    for (let end = start + 1; end <= original.length; end += 1) {
      if (overlapsUsedRange(start, end, usedRanges)) {
        continue;
      }

      const candidate = original.slice(start, end);
      if (normalizeText(candidate) === normalizedNeedle) {
        return { start, end };
      }

      if (normalizeText(candidate).length > normalizedNeedle.length + 8) {
        break;
      }
    }
  }

  return null;
}

function normalizeText(value: string) {
  return value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:?!])/g, "$1")
    .trim()
    .toLowerCase();
}

function overlapsUsedRange(start: number, end: number, usedRanges: Array<{ start: number; end: number }>) {
  return usedRanges.some((range) => start < range.end && end > range.start);
}
