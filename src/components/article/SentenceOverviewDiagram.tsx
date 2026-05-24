import type { Chunk, Sentence } from "@/features/article/articleTypes";
import { getRoleClass } from "@/features/article/roleVisuals";
import { matchChunkPositionLoose } from "@/features/highlight/matchChunkPositions";

interface SentenceOverviewDiagramProps {
  sentence: Sentence;
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string | null) => void;
}

interface FlowNode {
  id: string;
  role: string;
  english: string;
  chunk: Chunk;
  compact?: boolean;
}

export function SentenceOverviewDiagram({ sentence, selectedChunkId, onSelectChunk }: SentenceOverviewDiagramProps) {
  const mainFlow = buildMainFlow(sentence);
  const modifierGroups = groupModifiersByMainTarget(sentence, mainFlow);
  const looseModifiers = getLooseModifiers(sentence, modifierGroups);
  const attachedClauseIds = new Set(Array.from(modifierGroups.values()).flat().filter(isClauseLike).map((chunk) => chunk.chunkId));
  const clauseBlocks = getClauseBlocks(sentence).filter((clause) => !attachedClauseIds.has(clause.chunkId)).slice(0, 2);

  if (mainFlow.length === 0 && looseModifiers.length === 0 && clauseBlocks.length === 0) {
    return null;
  }

  return (
    <section className="overview-diagram analysis-section">
      <h3>句子结构一图看懂</h3>

      {mainFlow.length > 0 ? (
        <div className="syntax-flow">
          <div className="main-flow">
            {mainFlow.map((node, index) => (
              <div className="flow-column" key={node.id}>
                <FlowNodeCard node={node} isActive={node.chunk.chunkId === selectedChunkId} onSelectChunk={onSelectChunk} />
                <BranchStack
                  chunks={modifierGroups.get(node.id) ?? []}
                  selectedChunkId={selectedChunkId}
                  sentence={sentence}
                  onSelectChunk={onSelectChunk}
                />
                {index < mainFlow.length - 1 ? <span className="flow-connector" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
          {isQuestionSentence(sentence) ? <p className="overview-hint">疑问句外壳：按 Does | 主语 | mean | 宾语内容 理解。</p> : null}
        </div>
      ) : null}

      {looseModifiers.length > 0 ? (
        <div className="floating-branches">
          {looseModifiers.map((chunk, index) => (
            <ModifierCard
              badge={String.fromCharCode(65 + index)}
              chunk={chunk}
              isActive={chunk.chunkId === selectedChunkId}
              key={chunk.chunkId}
              onSelectChunk={onSelectChunk}
            />
          ))}
        </div>
      ) : null}

      {clauseBlocks.length > 0 ? (
        <div className="clause-branches">
          {clauseBlocks.map((clause) => (
            <ClauseBranch
              clause={clause}
              key={clause.chunkId}
              selectedChunkId={selectedChunkId}
              sentence={sentence}
              onSelectChunk={onSelectChunk}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FlowNodeCard({
  node,
  isActive,
  onSelectChunk,
  compact = false
}: {
  node: FlowNode;
  isActive: boolean;
  onSelectChunk: (chunkId: string | null) => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`flow-node ${getRoleClass(node.role)} ${compact || node.compact ? "is-compact" : ""} ${isActive ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelectChunk(node.chunk.chunkId)}
      title={node.chunk.relation ?? `${node.role}：${node.chunk.chinese}`}
    >
      <strong>{node.english}</strong>
      <span>{node.role}</span>
    </button>
  );
}

function BranchStack({
  chunks,
  selectedChunkId,
  sentence,
  onSelectChunk
}: {
  chunks: Chunk[];
  selectedChunkId: string | null;
  sentence: Sentence;
  onSelectChunk: (chunkId: string | null) => void;
}) {
  if (chunks.length === 0) {
    return null;
  }

  return (
    <div className="attached-modifiers">
      {chunks.map((chunk) =>
        isClauseLike(chunk) ? (
          <ClauseBranch
            clause={chunk}
            compact
            key={chunk.chunkId}
            selectedChunkId={selectedChunkId}
            sentence={sentence}
            onSelectChunk={onSelectChunk}
          />
        ) : (
          <ModifierCard
            chunk={chunk}
            isActive={chunk.chunkId === selectedChunkId}
            key={chunk.chunkId}
            onSelectChunk={onSelectChunk}
          />
        )
      )}
    </div>
  );
}

function ClauseBranch({
  clause,
  selectedChunkId,
  sentence,
  onSelectChunk,
  compact = false
}: {
  clause: Chunk;
  selectedChunkId: string | null;
  sentence: Sentence;
  onSelectChunk: (chunkId: string | null) => void;
  compact?: boolean;
}) {
  const children = getClauseChildren(sentence, clause);

  return (
    <div className={`clause-branch ${getRoleClass(clause.role)} ${compact ? "is-compact" : ""}`}>
      <button
        className={`clause-branch-title ${clause.chunkId === selectedChunkId ? "is-active" : ""}`}
        type="button"
        onClick={() => onSelectChunk(clause.chunkId)}
        title={clause.relation ?? `${clause.role}：${clause.chinese}`}
      >
        <strong>{clause.english}</strong>
        <span>{clause.role}</span>
      </button>
      {children.length > 0 ? (
        <div className="clause-inner-flow">
          {children.map((child, index) => (
            <div className="clause-inner-column" key={child.chunkId}>
              <FlowNodeCard
                compact
                isActive={child.chunkId === selectedChunkId}
                node={{ id: child.chunkId, role: child.role, english: child.english, chunk: child }}
                onSelectChunk={onSelectChunk}
              />
              {index < children.length - 1 ? <span className="inner-flow-connector" aria-hidden="true" /> : null}
              <BranchStack
                chunks={getChildModifiers(sentence, child).slice(0, 2)}
                selectedChunkId={selectedChunkId}
                sentence={sentence}
                onSelectChunk={onSelectChunk}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModifierCard({
  chunk,
  isActive,
  onSelectChunk,
  badge
}: {
  chunk: Chunk;
  isActive: boolean;
  onSelectChunk: (chunkId: string | null) => void;
  badge?: string;
}) {
  return (
    <button
      className={`modifier-node ${getRoleClass(chunk.role)} ${isActive ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelectChunk(chunk.chunkId)}
      title={chunk.relation ?? `${chunk.role}：${chunk.chinese}`}
    >
      {badge ? <span className="modifier-badge">{badge}</span> : null}
      <span className="modifier-content">
        <strong>{chunk.english}</strong>
        <small>{chunk.role}</small>
        {chunk.relation ? <em>{chunk.relation}</em> : null}
      </span>
    </button>
  );
}

function buildMainFlow(sentence: Sentence): FlowNode[] {
  const chunks = sentence.chunks;
  const topLevel = orderByPosition(
    sentence,
    chunks.filter((chunk) => !chunk.parentId && isMainFlowRole(chunk.role))
  );

  const predicate = topLevel.find((chunk) => chunk.role.includes("谓语"));
  const subject = topLevel.find((chunk) => chunk.role.includes("主语"));
  const objects = topLevel.filter((chunk) => chunk.role.includes("宾语") || chunk.role.includes("表语") || chunk.role.includes("补语"));
  const connectors = topLevel.filter((chunk) => chunk.role.includes("连接"));

  if (predicate && subject && isQuestionSentence(sentence)) {
    const split = splitQuestionPredicate(sentence, predicate);
    if (split) {
      return [
        ...connectors.map(toFlowNode),
        { id: `${predicate.chunkId}-aux`, role: "助动词", english: split.auxiliary, chunk: predicate, compact: true },
        toFlowNode(subject),
        { id: `${predicate.chunkId}-core`, role: "谓语核心", english: split.coreVerb, chunk: predicate, compact: true },
        ...objects.map(toFlowNode)
      ];
    }
  }

  return topLevel.map(toFlowNode).slice(0, 6);
}

function toFlowNode(chunk: Chunk): FlowNode {
  return {
    id: chunk.chunkId,
    role: chunk.role,
    english: chunk.english,
    chunk,
    compact: chunk.english.length <= 8
  };
}

function groupModifiersByMainTarget(sentence: Sentence, mainFlow: FlowNode[]) {
  const groups = new Map<string, Chunk[]>();
  const mainByChunkId = new Map(mainFlow.map((node) => [node.chunk.chunkId, node]));

  for (const modifier of getModifierCandidates(sentence)) {
    const attachNode = findAttachNode(sentence, modifier, mainByChunkId);
    if (!attachNode) continue;
    const current = groups.get(attachNode.id) ?? [];
    current.push(modifier);
    groups.set(attachNode.id, current.slice(0, 3));
  }

  return groups;
}

function getLooseModifiers(sentence: Sentence, grouped: Map<string, Chunk[]>) {
  const used = new Set(Array.from(grouped.values()).flat().map((chunk) => chunk.chunkId));
  return getModifierCandidates(sentence)
    .filter((chunk) => !used.has(chunk.chunkId))
    .slice(0, 4);
}

function findAttachNode(sentence: Sentence, modifier: Chunk, mainByChunkId: Map<string, FlowNode>) {
  let targetId = modifier.targetId;
  const visited = new Set<string>();

  while (targetId && !visited.has(targetId)) {
    visited.add(targetId);
    const direct = mainByChunkId.get(targetId);
    if (direct) return direct;
    const target = sentence.chunks.find((chunk) => chunk.chunkId === targetId);
    targetId = target?.parentId ?? null;
  }

  return null;
}

function getModifierCandidates(sentence: Sentence) {
  return orderByImportance(
    sentence,
    sentence.chunks.filter((chunk) => {
      if (!chunk.targetId) return false;
      if (chunk.role.includes("谓语") || chunk.role.includes("主语核心") || chunk.role.includes("从句主语")) return false;
      return (
        chunk.role.includes("定语") ||
        chunk.role.includes("状语") ||
        chunk.role.includes("补语") ||
        chunk.role.includes("插入") ||
        chunk.role.includes("并列")
      );
    })
  );
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

function getChildModifiers(sentence: Sentence, target: Chunk) {
  return orderByImportance(
    sentence,
    sentence.chunks.filter((chunk) => {
      if (chunk.targetId !== target.chunkId) return false;
      if (chunk.chunkId === target.chunkId) return false;
      return (
        chunk.role.includes("定语") ||
        chunk.role.includes("状语") ||
        chunk.role.includes("补语") ||
        chunk.role.includes("插入")
      );
    })
  );
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

function isMainFlowRole(role: string) {
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

function isQuestionSentence(sentence: Sentence) {
  return sentence.original.trim().endsWith("?");
}

function splitQuestionPredicate(sentence: Sentence, predicate: Chunk) {
  const words = predicate.english.trim().split(/\s+/);
  if (words.length !== 2) return null;
  const [auxiliary, coreVerb] = words;
  const lower = sentence.original.toLowerCase();
  if (!lower.includes(auxiliary.toLowerCase()) || !lower.includes(coreVerb.toLowerCase())) return null;
  return { auxiliary, coreVerb };
}

function isClauseLike(chunk: Chunk) {
  return chunk.role.includes("从句") || chunk.role.includes("强调结构");
}
