import type { Article } from "@/features/article/articleTypes";
import { Badge } from "@/components/common/Badge";
import { formatDifficulty } from "@/lib/text";

interface ArticleReaderProps {
  article: Article;
  selectedSentenceId?: string;
  onSelectSentence: (sentenceId: string) => void;
}

export function ArticleReader({ article, selectedSentenceId, onSelectSentence }: ArticleReaderProps) {
  return (
    <div className="reader-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">阅读训练</p>
          <h1>{article.title}</h1>
        </div>
        <Badge tone="green">{article.sentenceCount} 句</Badge>
      </div>

      <div className="sentence-flow">
        {article.sentences.map((sentence, index) => (
          <button
            className={`sentence-button ${sentence.sentenceId === selectedSentenceId ? "is-active" : ""}`}
            key={sentence.sentenceId}
            onClick={() => onSelectSentence(sentence.sentenceId)}
            type="button"
          >
            <span className="sentence-index">{index + 1}</span>
            <span className="sentence-text">{sentence.original}</span>
            <span className="sentence-difficulty">{formatDifficulty(sentence.difficulty)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
