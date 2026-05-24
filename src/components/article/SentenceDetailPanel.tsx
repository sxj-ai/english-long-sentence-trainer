import type { Sentence } from "@/features/article/articleTypes";
import { Badge } from "@/components/common/Badge";
import { formatDifficulty } from "@/lib/text";
import { ChunkTable } from "./ChunkTable";
import { GrammarVisualizer } from "./GrammarVisualizer";
import { KeyPhraseList } from "./KeyPhraseList";
import { KeyWordList } from "./KeyWordList";
import { SentenceOverviewDiagram } from "./SentenceOverviewDiagram";
import { SentencePatternList } from "./SentencePatternList";

interface SentenceDetailPanelProps {
  sentence?: Sentence;
  selectedChunkId: string | null;
  onSelectChunk: (chunkId: string | null) => void;
}

export function SentenceDetailPanel({ sentence, selectedChunkId, onSelectChunk }: SentenceDetailPanelProps) {
  if (!sentence) {
    return (
      <aside className="detail-panel">
        <div className="empty-state">请选择一个句子。</div>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">句子解析</p>
          <h2>{sentence.sentenceId}</h2>
        </div>
        <Badge tone="amber">难度 {formatDifficulty(sentence.difficulty)}</Badge>
      </div>

      <div className="analysis-section">
        <h3>语法标记原句</h3>
        <GrammarVisualizer sentence={sentence} selectedChunkId={selectedChunkId} onSelectChunk={onSelectChunk} />
      </div>

      <div className="analysis-section literal-section">
        <h3>结构直译</h3>
        <p>{sentence.translationLiteral}</p>
      </div>

      <SentenceOverviewDiagram sentence={sentence} selectedChunkId={selectedChunkId} onSelectChunk={onSelectChunk} />

      <SentencePatternList sentence={sentence} />

      <ChunkTable sentence={sentence} selectedChunkId={selectedChunkId} onSelectChunk={onSelectChunk} />

      <div className="side-by-side">
        <KeyWordList sentence={sentence} onSelectChunk={onSelectChunk} />
        <KeyPhraseList sentence={sentence} onSelectChunk={onSelectChunk} />
      </div>
    </aside>
  );
}
