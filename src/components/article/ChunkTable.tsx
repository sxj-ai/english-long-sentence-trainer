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
        {sortChunksForStudy(sentence).map((chunk) => {
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

function sortChunksForStudy(sentence: Sentence) {
  return [...sentence.chunks].sort((a, b) => {
    const groupDiff = getChunkStudyGroup(a) - getChunkStudyGroup(b);
    if (groupDiff !== 0) return groupDiff;

    const roleDiff = getRolePriority(a.role) - getRolePriority(b.role);
    if (roleDiff !== 0) return roleDiff;

    return getOriginalIndex(sentence, a.chunkId) - getOriginalIndex(sentence, b.chunkId);
  });
}

function getChunkStudyGroup(chunk: { role: string; parentId: string | null }) {
  if (!chunk.parentId && isMainRole(chunk.role)) return 0;
  if (!chunk.parentId && isModifierRole(chunk.role)) return 1;
  if (chunk.parentId && isClauseInternalRole(chunk.role)) return 2;
  if (chunk.parentId && isModifierRole(chunk.role)) return 3;
  return 4;
}

function getRolePriority(role: string) {
  if (role.includes("连接")) return 0;
  if (role.includes("主语")) return 1;
  if (role.includes("谓语")) return 2;
  if (role.includes("宾语")) return 3;
  if (role.includes("表语")) return 4;
  if (role.includes("补语")) return 5;
  if (role.includes("从句")) return 6;
  if (role.includes("定语")) return 7;
  if (role.includes("状语")) return 8;
  if (role.includes("插入")) return 9;
  if (role.includes("并列")) return 10;
  return 20;
}

function isMainRole(role: string) {
  if (role.includes("定语") || role.includes("状语") || role.includes("插入") || role.includes("主语核心")) {
    return false;
  }

  return (
    role.includes("连接") ||
    role.includes("主语") ||
    role.includes("谓语") ||
    role.includes("宾语") ||
    role.includes("表语") ||
    role.includes("补语")
  );
}

function isModifierRole(role: string) {
  return role.includes("定语") || role.includes("状语") || role.includes("插入") || role.includes("并列");
}

function isClauseInternalRole(role: string) {
  return role.includes("从句主语") || role.includes("从句谓语") || role.includes("从句宾语") || role.includes("从句表语");
}

function getOriginalIndex(sentence: Sentence, chunkId: string) {
  return sentence.chunks.findIndex((chunk) => chunk.chunkId === chunkId);
}
