import type { Chunk, Sentence } from "@/features/article/articleTypes";
import { matchSingleChunk } from "@/features/highlight/matchChunkPositions";

interface HighlightedSentenceProps {
  sentence: Sentence;
  selectedChunk?: Chunk;
}

export function HighlightedSentence({ sentence, selectedChunk }: HighlightedSentenceProps) {
  if (!selectedChunk) {
    return <p className="highlighted-sentence">{sentence.original}</p>;
  }

  const match = matchSingleChunk(sentence.original, selectedChunk.english);

  if (match.confidence === "failed") {
    return (
      <div>
        <p className="highlighted-sentence">{sentence.original}</p>
        <p className="match-warning">当前结构块无法稳定匹配到原句位置，仍可在结构表中查看。</p>
      </div>
    );
  }

  return (
    <p className="highlighted-sentence">
      {sentence.original.slice(0, match.start)}
      <mark>{sentence.original.slice(match.start, match.end)}</mark>
      {sentence.original.slice(match.end)}
    </p>
  );
}
