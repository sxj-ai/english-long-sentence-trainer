import type { Chunk, Sentence } from "@/features/article/articleTypes";
import type { ReactNode } from "react";
import { getRoleClass, ROLE_LEGEND } from "@/features/article/roleVisuals";
import { matchChunkPositionLoose } from "@/features/highlight/matchChunkPositions";

interface GrammarVisualizerProps {
  sentence: Sentence;
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string | null) => void;
}

interface PositionedChunk {
  chunk: Chunk;
  start: number;
  end: number;
}

export function GrammarVisualizer({ sentence, selectedChunkId, onSelectChunk }: GrammarVisualizerProps) {
  const positioned = getPositionedChunks(sentence);
  const inlineChunks = chooseInlineChunks(positioned);
  const selectedChunk = sentence.chunks.find((chunk) => chunk.chunkId === selectedChunkId);
  const relatedIds = new Set([selectedChunk?.parentId, selectedChunk?.targetId].filter(Boolean));

  return (
    <div className="grammar-visualizer">
      <div className="grammar-toolbar">
        <div className="grammar-legend">
          {ROLE_LEGEND.map((item) => (
            <span className={`legend-item grammar-${item.tone}`} key={item.role}>
              {item.role}
            </span>
          ))}
        </div>
        <button className="text-button" type="button" onClick={() => onSelectChunk(null)}>
          清除标记
        </button>
      </div>

      <div className="syntax-sentence" aria-label="带语法颜色标记的原句">
        {renderAnnotatedSentence(sentence, inlineChunks, selectedChunkId, relatedIds, onSelectChunk)}
      </div>
    </div>
  );
}

function renderAnnotatedSentence(
  sentence: Sentence,
  inlineChunks: PositionedChunk[],
  selectedChunkId: string | null,
  relatedIds: Set<string | null | undefined>,
  onSelectChunk: (chunkId: string) => void
) {
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const item of inlineChunks) {
    if (item.start > cursor) {
      parts.push(<span key={`text-${cursor}`}>{sentence.original.slice(cursor, item.start)}</span>);
    }

    parts.push(
      <button
        className={`syntax-token ${getRoleClass(item.chunk.role)} ${item.chunk.chunkId === selectedChunkId ? "is-active" : ""} ${
          relatedIds.has(item.chunk.chunkId) ? "is-related" : ""
        }`}
        key={item.chunk.chunkId}
        title={`${item.chunk.role}：${item.chunk.chinese}`}
        type="button"
        onClick={() => onSelectChunk(item.chunk.chunkId)}
      >
        {sentence.original.slice(item.start, item.end)}
      </button>
    );

    cursor = item.end;
  }

  if (cursor < sentence.original.length) {
    parts.push(<span key={`text-${cursor}`}>{sentence.original.slice(cursor)}</span>);
  }

  return parts;
}

function getPositionedChunks(sentence: Sentence): PositionedChunk[] {
  return sentence.chunks
    .map((chunk) => {
      const match = matchChunkPositionLoose(sentence.original, chunk);
      return match.confidence === "failed" ? null : { chunk, start: match.start, end: match.end };
    })
    .filter((item): item is PositionedChunk => Boolean(item));
}

function chooseInlineChunks(chunks: PositionedChunk[]) {
  const candidates = chunks
    .filter(({ chunk }) => shouldShowInline(chunk))
    .sort((a, b) => a.start - b.start || priority(b.chunk.role) - priority(a.chunk.role) || b.end - b.start - (a.end - a.start));

  const selected: PositionedChunk[] = [];

  for (const candidate of candidates) {
    if (!selected.some((item) => overlaps(item, candidate))) {
      selected.push(candidate);
    }
  }

  return selected.sort((a, b) => a.start - b.start);
}

function shouldShowInline(chunk: Chunk) {
  if (chunk.role.includes("从句")) return true;
  if (!chunk.parentId && !hasBroadRole(chunk.role)) return true;
  if (!chunk.parentId && chunk.english.length <= 28) return true;
  return (
    chunk.role.includes("主语") ||
    chunk.role.includes("谓语") ||
    chunk.role.includes("宾语") ||
    chunk.role.includes("表语") ||
    chunk.role.includes("定语") ||
    chunk.role.includes("状语") ||
    chunk.role.includes("补语") ||
    chunk.role.includes("插入") ||
    chunk.role.includes("并列")
  );
}

function priority(role: string) {
  if (role.includes("谓语")) return 9;
  if (role.includes("主语")) return 8;
  if (role.includes("宾语")) return 7;
  if (role.includes("表语")) return 7;
  if (role.includes("补语")) return 6;
  if (role.includes("定语")) return 5;
  if (role.includes("状语")) return 5;
  if (role.includes("从句")) return 4;
  return 3;
}

function overlaps(a: PositionedChunk, b: PositionedChunk) {
  return a.start < b.end && b.start < a.end;
}

function isClauseLike(role: string) {
  return role.includes("从句") || role.includes("插入") || role.includes("强调结构");
}

function hasBroadRole(role: string) {
  return role === "主语" || role === "宾语" || role === "表语" || role.includes("从句");
}
