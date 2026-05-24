import type { Sentence } from "@/features/article/articleTypes";

interface KeyPhraseListProps {
  sentence: Sentence;
  onSelectChunk: (chunkId: string) => void;
}

export function KeyPhraseList({ sentence, onSelectChunk }: KeyPhraseListProps) {
  return (
    <div className="analysis-section compact-section">
      <h3>重点短语</h3>
      <div className="pill-list">
        {sentence.keyPhrases.map((phrase) => {
          const chunk = sentence.chunks.find((item) => item.chunkId === phrase.chunkId);
          return (
            <button
              className="meaning-pill"
              key={`${phrase.phrase}-${phrase.chunkId}`}
              onClick={() => onSelectChunk(phrase.chunkId)}
              type="button"
            >
              <strong>{phrase.phrase}</strong>
              <span>{phrase.phraseType ? `${phrase.phraseType} ${phrase.meaning}` : phrase.meaning}</span>
              {chunk ? <small>{chunk.role}</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
