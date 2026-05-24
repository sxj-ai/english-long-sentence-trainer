import type { Sentence } from "@/features/article/articleTypes";

interface KeyWordListProps {
  sentence: Sentence;
  onSelectChunk: (chunkId: string) => void;
}

export function KeyWordList({ sentence, onSelectChunk }: KeyWordListProps) {
  return (
    <div className="analysis-section compact-section">
      <h3>重点词</h3>
      <div className="pill-list">
        {sentence.keyWords.map((word) => {
          const chunk = sentence.chunks.find((item) => item.chunkId === word.chunkId);
          return (
            <button className="meaning-pill" key={`${word.word}-${word.chunkId}`} onClick={() => onSelectChunk(word.chunkId)} type="button">
              <strong>{word.word}</strong>
              <span>{word.pos ? `${word.pos} ${word.meaning}` : word.meaning}</span>
              {chunk ? <small>{chunk.role}</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
