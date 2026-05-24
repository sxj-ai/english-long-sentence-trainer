export interface ArticleSummary {
  id: string;
  title: string;
  year: number;
  examType: string;
  textId: string;
  sentenceCount: number;
  averageDifficulty: number;
}

export interface Article extends ArticleSummary {
  sourceFile: string;
  sentences: Sentence[];
}

export interface Sentence {
  sentenceId: string;
  year: number;
  examType: string;
  textId: string;
  original: string;
  difficulty: number;
  translationLiteral: string;
  chunks: Chunk[];
  sentencePatterns: SentencePattern[];
  keyWords: KeyWord[];
  keyPhrases: KeyPhrase[];
}

export interface SentencePattern {
  patternName: string;
  patternForm: string;
  explanation: string;
}

export interface Chunk {
  chunkId: string;
  role: string;
  english: string;
  chinese: string;
  parentId: string | null;
  targetId: string | null;
  relation: string | null;
}

export interface KeyWord {
  word: string;
  pos?: string;
  meaning: string;
  chunkId: string;
}

export interface KeyPhrase {
  phrase: string;
  phraseType?: string;
  meaning: string;
  chunkId: string;
}

export interface RawSentence {
  sentence_id: string;
  year: number;
  exam_type: string;
  text_id: string;
  original: string;
  difficulty: number;
  translation_literal: string;
  chunks: RawChunk[];
  sentence_patterns?: RawSentencePattern[];
  key_words: RawKeyWord[];
  key_phrases: RawKeyPhrase[];
}

export interface RawSentencePattern {
  pattern_name: string;
  pattern_form: string;
  explanation: string;
}

export interface RawChunk {
  chunk_id: string;
  role: string;
  english: string;
  chinese: string;
  parent_id: string | null;
  target_id: string | null;
  relation: string | null;
}

export interface RawKeyWord {
  word: string;
  pos?: string;
  meaning: string;
  chunk_id: string;
}

export interface RawKeyPhrase {
  phrase: string;
  phrase_type?: string;
  meaning: string;
  chunk_id: string;
}
