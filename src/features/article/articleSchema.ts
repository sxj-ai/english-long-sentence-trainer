import { z } from "zod";

export const rawChunkSchema = z.object({
  chunk_id: z.string().min(1),
  role: z.string().min(1),
  english: z.string().min(1),
  chinese: z.string().min(1),
  parent_id: z.string().nullable(),
  target_id: z.string().nullable(),
  relation: z.string().nullable()
});

export const rawKeyWordSchema = z.object({
  word: z.string().min(1),
  pos: z.string().optional(),
  meaning: z.string().min(1),
  chunk_id: z.string().min(1)
});

export const rawKeyPhraseSchema = z.object({
  phrase: z.string().min(1),
  phrase_type: z.string().optional(),
  meaning: z.string().min(1),
  chunk_id: z.string().min(1)
});

export const rawSentencePatternSchema = z.object({
  pattern_name: z.string().min(1),
  pattern_form: z.string().min(1),
  explanation: z.string().min(1)
});

export const rawSentenceSchema = z.object({
  sentence_id: z.string().min(1),
  year: z.number(),
  exam_type: z.string().min(1),
  text_id: z.string().min(1),
  original: z.string().min(1),
  difficulty: z.number().min(1).max(5),
  translation_literal: z.string().min(1),
  chunks: z.array(rawChunkSchema).min(1),
  sentence_patterns: z.array(rawSentencePatternSchema).optional().default([]),
  key_words: z.array(rawKeyWordSchema),
  key_phrases: z.array(rawKeyPhraseSchema)
});

export const rawSentenceArraySchema = z.array(rawSentenceSchema).min(1);

export function validateSentenceRelations(sentences: z.infer<typeof rawSentenceArraySchema>) {
  const warnings: string[] = [];

  for (const sentence of sentences) {
    const chunkIds = new Set(sentence.chunks.map((chunk) => chunk.chunk_id));

    if (chunkIds.size !== sentence.chunks.length) {
      warnings.push(`${sentence.sentence_id}: chunk_id 存在重复`);
    }

    for (const chunk of sentence.chunks) {
      if (chunk.parent_id && !chunkIds.has(chunk.parent_id)) {
        warnings.push(`${sentence.sentence_id}: ${chunk.chunk_id}.parent_id 指向不存在的 chunk ${chunk.parent_id}`);
      }

      if (chunk.target_id && !chunkIds.has(chunk.target_id)) {
        warnings.push(`${sentence.sentence_id}: ${chunk.chunk_id}.target_id 指向不存在的 chunk ${chunk.target_id}`);
      }
    }

    for (const word of sentence.key_words) {
      if (!chunkIds.has(word.chunk_id)) {
        warnings.push(`${sentence.sentence_id}: key_word "${word.word}" 指向不存在的 chunk ${word.chunk_id}`);
      }
    }

    for (const phrase of sentence.key_phrases) {
      if (!chunkIds.has(phrase.chunk_id)) {
        warnings.push(`${sentence.sentence_id}: key_phrase "${phrase.phrase}" 指向不存在的 chunk ${phrase.chunk_id}`);
      }
    }
  }

  return warnings;
}
