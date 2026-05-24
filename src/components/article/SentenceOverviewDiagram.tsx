import type { Chunk, Sentence } from "@/features/article/articleTypes";
import type { ReactNode } from "react";
import { getRoleClass } from "@/features/article/roleVisuals";
import { matchChunkPositionLoose } from "@/features/highlight/matchChunkPositions";

interface SentenceOverviewDiagramProps {
  sentence: Sentence;
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string | null) => void;
}

export function SentenceOverviewDiagram({ sentence, selectedChunkId, onSelectChunk }: SentenceOverviewDiagramProps) {
  const mainChunks = getMainFrame(sentence);
  const keyPoints = getKeyPoints(sentence).slice(0, 4);
  const clauseBlocks = getClauseBlocks(sentence).slice(0, 3);
  const order = getStudyOrder(sentence, keyPoints.length, clauseBlocks.length);

  if (mainChunks.length === 0 && keyPoints.length === 0 && clauseBlocks.length === 0) {
    return null;
  }

  return (
    <section className="overview-diagram analysis-section">
      <h3>句子结构一图看懂</h3>

      {mainChunks.length > 0 ? (
        <OverviewBlock index={1} title="主句骨架">
          <div className="main-frame">
            {mainChunks.map((chunk) => (
              <OverviewNode
                chunk={chunk}
                isActive={chunk.chunkId === selectedChunkId}
                key={chunk.chunkId}
                onSelectChunk={onSelectChunk}
              />
            ))}
          </div>
          <p className="overview-hint">先抓主干：这句话的核心意思先由这一层确定。</p>
        </OverviewBlock>
      ) : null}

      {keyPoints.length > 0 ? (
        <OverviewBlock index={2} title={`${keyPoints.length} 个关键修饰`}>
          <div className="key-point-list">
            {keyPoints.map((chunk, index) => {
              const target = sentence.chunks.find((item) => item.chunkId === chunk.targetId);
              return (
                <button
                  className={`key-point ${getRoleClass(chunk.role)} ${chunk.chunkId === selectedChunkId ? "is-active" : ""}`}
                  key={chunk.chunkId}
                  type="button"
                  onClick={() => onSelectChunk(chunk.chunkId)}
                >
                  <span className="point-letter">{String.fromCharCode(65 + index)}</span>
                  <span className="point-content">
                    <strong>{chunk.english}</strong>
                    <small>
                      {chunk.role}
                      {target ? `，说明 ${target.english}` : ""}
                    </small>
                    {chunk.relation ? <em>{chunk.relation}</em> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </OverviewBlock>
      ) : null}

      {clauseBlocks.length > 0 ? (
        <OverviewBlock index={3} title="从句内部">
          <div className="clause-overview-list">
            {clauseBlocks.map((clause) => (
              <div className={`clause-overview ${getRoleClass(clause.role)}`} key={clause.chunkId}>
                <button
                  className={`clause-overview-title ${clause.chunkId === selectedChunkId ? "is-active" : ""}`}
                  type="button"
                  onClick={() => onSelectChunk(clause.chunkId)}
                >
                  <span>{clause.role}</span>
                  <strong>{clause.english}</strong>
                </button>
                <div className="clause-inner-frame">
                  {getClauseChildren(sentence, clause).map((child) => (
                    <OverviewNode
                      chunk={child}
                      compact
                      isActive={child.chunkId === selectedChunkId}
                      key={child.chunkId}
                      onSelectChunk={onSelectChunk}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </OverviewBlock>
      ) : null}

      <div className="study-order">
        <strong>学习顺序</strong>
        {order.map((step, index) => (
          <span key={step}>
            {index > 0 ? <b>→</b> : null}
            {step}
          </span>
        ))}
      </div>
    </section>
  );
}

function OverviewBlock({ index, title, children }: { index: number; title: string; children: ReactNode }) {
  return (
    <div className="overview-block">
      <div className="overview-title">
        <span>{index}</span>
        <h4>{title}</h4>
      </div>
      {children}
    </div>
  );
}

function OverviewNode({
  chunk,
  isActive,
  onSelectChunk,
  compact = false
}: {
  chunk: Chunk;
  isActive: boolean;
  onSelectChunk: (chunkId: string | null) => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`overview-node ${getRoleClass(chunk.role)} ${compact ? "is-compact" : ""} ${isActive ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelectChunk(chunk.chunkId)}
      title={chunk.relation ?? `${chunk.role}：${chunk.chinese}`}
    >
      <strong>{chunk.english}</strong>
      <span>{chunk.role}</span>
    </button>
  );
}

function getMainFrame(sentence: Sentence) {
  return orderByPosition(
    sentence,
    sentence.chunks.filter((chunk) => {
      if (chunk.parentId) return false;
      if (chunk.role.includes("定语") || chunk.role.includes("状语") || chunk.role.includes("插入")) return false;
      return (
        chunk.role.includes("连接") ||
        chunk.role.includes("主语") ||
        chunk.role.includes("谓语") ||
        chunk.role.includes("宾语") ||
        chunk.role.includes("表语") ||
        chunk.role.includes("补语")
      );
    })
  ).slice(0, 5);
}

function getKeyPoints(sentence: Sentence) {
  const candidates = sentence.chunks.filter((chunk) => {
    if (!chunk.targetId) return false;
    return (
      chunk.role.includes("定语") ||
      chunk.role.includes("状语") ||
      chunk.role.includes("补语") ||
      chunk.role.includes("插入") ||
      chunk.role.includes("并列")
    );
  });

  return orderByImportance(sentence, candidates);
}

function getClauseBlocks(sentence: Sentence) {
  const clauses = sentence.chunks.filter((chunk) => chunk.role.includes("从句") || chunk.role.includes("强调结构"));
  return orderByPosition(sentence, clauses);
}

function getClauseChildren(sentence: Sentence, clause: Chunk) {
  const children = sentence.chunks.filter((chunk) => chunk.parentId === clause.chunkId);
  return orderByPosition(
    sentence,
    children.filter((chunk) => {
      return (
        chunk.role.includes("主语") ||
        chunk.role.includes("谓语") ||
        chunk.role.includes("宾语") ||
        chunk.role.includes("表语") ||
        chunk.role.includes("补语") ||
        chunk.role.includes("状语") ||
        chunk.role.includes("定语")
      );
    })
  ).slice(0, 6);
}

function orderByPosition(sentence: Sentence, chunks: Chunk[]) {
  return [...chunks].sort((a, b) => getStart(sentence, a) - getStart(sentence, b));
}

function orderByImportance(sentence: Sentence, chunks: Chunk[]) {
  return [...chunks].sort((a, b) => {
    const scoreDiff = importanceScore(b) - importanceScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return getStart(sentence, a) - getStart(sentence, b);
  });
}

function importanceScore(chunk: Chunk) {
  let score = 0;
  if (chunk.role.includes("从句")) score += 5;
  if (chunk.role.includes("状语")) score += 4;
  if (chunk.role.includes("定语")) score += 4;
  if (chunk.role.includes("补语")) score += 4;
  if (chunk.role.includes("插入")) score += 3;
  if (chunk.english.length > 28) score += 2;
  if (chunk.relation) score += 1;
  return score;
}

function getStart(sentence: Sentence, chunk: Chunk) {
  const match = matchChunkPositionLoose(sentence.original, chunk);
  return match.start >= 0 ? match.start : Number.MAX_SAFE_INTEGER;
}

function getStudyOrder(sentence: Sentence, keyPointCount: number, clauseCount: number) {
  const order = ["先抓主干"];
  if (clauseCount > 0) order.push("再拆从句");
  if (keyPointCount > 0) order.push("最后看修饰");
  if (sentence.sentencePatterns.length > 0) order.push("记住句型");
  return order;
}
