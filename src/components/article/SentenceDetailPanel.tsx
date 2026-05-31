import type { Article, Sentence } from "@/features/article/articleTypes";
import { Badge } from "@/components/common/Badge";
import { formatDifficulty } from "@/lib/text";
import { ChunkTable } from "./ChunkTable";
import { GrammarVisualizer } from "./GrammarVisualizer";
import { KeyPhraseList } from "./KeyPhraseList";
import { KeyWordList } from "./KeyWordList";
import { SentenceBookmarkButton } from "./SentenceBookmarkButton";
import { SentencePatternList } from "./SentencePatternList";

interface SentenceDetailPanelProps {
  article: Article;
  sentence?: Sentence;
  selectedChunkId: string | null;
  onAskAi: () => void;
  onSelectChunk: (chunkId: string | null) => void;
}

export function SentenceDetailPanel({ article, sentence, selectedChunkId, onAskAi, onSelectChunk }: SentenceDetailPanelProps) {
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
        <div className="panel-actions">
          <Badge tone="amber">难度 {formatDifficulty(sentence.difficulty)}</Badge>
          <SentenceBookmarkButton article={article} sentence={sentence} />
          <button className="primary-link button-like" onClick={onAskAi} type="button">
            问 AI 老师
          </button>
        </div>
      </div>

      <div className="analysis-section">
        <h3>语法标记原句</h3>
        <GrammarVisualizer sentence={sentence} selectedChunkId={selectedChunkId} onSelectChunk={onSelectChunk} />
      </div>

      <div className="analysis-section literal-section">
        <h3>结构直译</h3>
        <p>{sentence.translationLiteral}</p>
      </div>

      <SentencePatternList sentence={sentence} />

      <ChunkTable sentence={sentence} selectedChunkId={selectedChunkId} onSelectChunk={onSelectChunk} />

      <div className="side-by-side">
        <KeyWordList sentence={sentence} onSelectChunk={onSelectChunk} />
        <KeyPhraseList sentence={sentence} onSelectChunk={onSelectChunk} />
      </div>
    </aside>
  );
}
