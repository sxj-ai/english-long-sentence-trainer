import type { Article, ArticleSummary, Chunk, RawSentence, Sentence } from "./articleTypes";

export function adaptRawSentencesToArticle(sourceFile: string, rawSentences: RawSentence[]): Article {
  const first = rawSentences[0];
  const sentences = rawSentences.map(adaptRawSentence);
  const id = buildArticleId(first.year, first.exam_type, first.text_id);
  const averageDifficulty =
    sentences.reduce((sum, sentence) => sum + sentence.difficulty, 0) / Math.max(sentences.length, 1);

  return {
    id,
    title: `${first.year} ${first.exam_type} ${first.text_id}`,
    year: first.year,
    examType: first.exam_type,
    textId: first.text_id,
    sentenceCount: sentences.length,
    averageDifficulty,
    sourceFile,
    sentences
  };
}

export function toArticleSummary(article: Article): ArticleSummary {
  return {
    id: article.id,
    title: article.title,
    year: article.year,
    examType: article.examType,
    textId: article.textId,
    sentenceCount: article.sentenceCount,
    averageDifficulty: article.averageDifficulty
  };
}

function adaptRawSentence(raw: RawSentence): Sentence {
  return {
    sentenceId: raw.sentence_id,
    year: raw.year,
    examType: raw.exam_type,
    textId: raw.text_id,
    original: raw.original,
    difficulty: raw.difficulty,
    translationLiteral: raw.translation_literal,
    chunks: raw.chunks.map((chunk): Chunk => ({
      chunkId: chunk.chunk_id,
      role: chunk.role,
      english: chunk.english,
      chinese: chunk.chinese,
      parentId: chunk.parent_id,
      targetId: chunk.target_id,
      relation: chunk.relation
    })),
    sentencePatterns: (raw.sentence_patterns ?? []).map((pattern) => ({
      patternName: pattern.pattern_name,
      patternForm: pattern.pattern_form,
      explanation: pattern.explanation
    })),
    keyWords: raw.key_words.map((word) => ({
      word: word.word,
      pos: word.pos,
      meaning: word.meaning,
      chunkId: word.chunk_id
    })),
    keyPhrases: raw.key_phrases.map((phrase) => ({
      phrase: phrase.phrase,
      phraseType: phrase.phrase_type,
      meaning: phrase.meaning,
      chunkId: phrase.chunk_id
    }))
  };
}

function buildArticleId(year: number, examType: string, textId: string) {
  const exam = examType === "英语一" ? "english1" : examType === "英语二" ? "english2" : normalizeId(examType);
  return `kaoyan-${year}-${exam}-${normalizeId(textId)}`;
}

function normalizeId(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
