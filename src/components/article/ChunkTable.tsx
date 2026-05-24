import type { Sentence } from "@/features/article/articleTypes";

interface ChunkTableProps {
  sentence: Sentence;
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string | null) => void;
}

export function ChunkTable({ sentence, selectedChunkId, onSelectChunk }: ChunkTableProps) {
  const selectedChunk = sentence.chunks.find((chunk) => chunk.chunkId === selectedChunkId);
  const relatedIds = new Set([selectedChunk?.parentId, selectedChunk?.targetId].filter(Boolean));

  return (
    <div className="analysis-section">
      <div className="section-inline-heading">
        <h3>结构拆解</h3>
        <button className="text-button" type="button" onClick={() => onSelectChunk(null)}>
          清除选择
        </button>
      </div>

      <div className="chunk-table">
        {sentence.chunks.map((chunk) => {
          const isActive = chunk.chunkId === selectedChunkId;
          const isRelated = relatedIds.has(chunk.chunkId);
          return (
            <button
              className={`chunk-row ${isActive ? "is-active" : ""} ${isRelated ? "is-related" : ""}`}
              key={chunk.chunkId}
              onClick={() => onSelectChunk(chunk.chunkId)}
              type="button"
            >
              <span className="chunk-role">{chunk.role}</span>
              <span className="chunk-english">{chunk.english}</span>
              <span className="chunk-chinese">{chunk.chinese}</span>
              <span className="chunk-relation">{chunk.relation ?? relationFallback(sentence, chunk.chunkId)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function relationFallback(sentence: Sentence, chunkId: string) {
  const children = sentence.chunks.filter((chunk) => chunk.parentId === chunkId).length;
  const modifiers = sentence.chunks.filter((chunk) => chunk.targetId === chunkId).length;

  if (children || modifiers) {
    return `包含 ${children} 个下层结构，关联 ${modifiers} 个修饰说明`;
  }

  return "主干或独立结构";
}
