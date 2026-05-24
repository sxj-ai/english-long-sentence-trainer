import type { Sentence } from "@/features/article/articleTypes";

export function SentencePatternList({ sentence }: { sentence: Sentence }) {
  if (sentence.sentencePatterns.length === 0) {
    return null;
  }

  return (
    <div className="analysis-section pattern-section">
      <h3>句型提示</h3>
      <div className="pattern-list">
        {sentence.sentencePatterns.map((pattern) => (
          <article className="pattern-card" key={`${pattern.patternName}-${pattern.patternForm}`}>
            <div>
              <strong>{pattern.patternName}</strong>
              <code>{pattern.patternForm}</code>
            </div>
            <p>{pattern.explanation}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
