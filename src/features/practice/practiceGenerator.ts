import type { Article, Chunk, Sentence } from "@/features/article/articleTypes";
import type { PracticeItem } from "./practiceTypes";

export function generatePracticeItems(article: Article): PracticeItem[] {
  const items: PracticeItem[] = [];

  for (const sentence of article.sentences) {
    const predicate = sentence.chunks.find((chunk) => chunk.role === "谓语" || chunk.role === "并列谓语");
    if (predicate) {
      items.push(makeRoleChoice(article.id, sentence, "谓语", predicate));
    }

    const subject = sentence.chunks.find((chunk) => chunk.role === "主语");
    if (subject) {
      items.push(makeRoleChoice(article.id, sentence, "主语", subject));
    }

    const translatable = sentence.chunks.find((chunk) => chunk.role !== "连接成分" && chunk.english.length > 3);
    if (translatable) {
      items.push(makeChunkTranslationChoice(article.id, sentence, translatable));
    }

    const word = sentence.keyWords[0];
    if (word) {
      items.push({
        id: `${sentence.sentenceId}-vocab-${word.word}`,
        type: "vocab_choice",
        articleId: article.id,
        sentenceId: sentence.sentenceId,
        prompt: `"${word.word}" 在本句中的意思是？`,
        options: buildOptions(word.meaning, collectWordMeanings(article)),
        answer: word.meaning,
        explanation: `这个词属于 ${describeChunk(sentence, word.chunkId)}。`
      });
    }

    const phrase = sentence.keyPhrases[0];
    if (phrase) {
      items.push({
        id: `${sentence.sentenceId}-phrase-${phrase.phrase}`,
        type: "phrase_choice",
        articleId: article.id,
        sentenceId: sentence.sentenceId,
        prompt: `"${phrase.phrase}" 在本句中的意思是？`,
        options: buildOptions(phrase.meaning, collectPhraseMeanings(article)),
        answer: phrase.meaning,
        explanation: `这个短语属于 ${describeChunk(sentence, phrase.chunkId)}。`
      });
    }

    const relationChunk = sentence.chunks.find((chunk) => chunk.targetId && chunk.relation);
    if (relationChunk?.targetId) {
      const target = sentence.chunks.find((chunk) => chunk.chunkId === relationChunk.targetId);
      if (target) {
        items.push({
          id: `${sentence.sentenceId}-relation-${relationChunk.chunkId}`,
          type: "relation_choice",
          articleId: article.id,
          sentenceId: sentence.sentenceId,
          prompt: `"${relationChunk.english}" 主要修饰或说明哪一部分？`,
          options: buildOptions(target.english, sentence.chunks.map((chunk) => chunk.english)),
          answer: target.english,
          explanation: relationChunk.relation ?? `它指向 ${target.english}。`
        });
      }
    }
  }

  return items;
}

function makeRoleChoice(articleId: string, sentence: Sentence, role: string, answerChunk: Chunk): PracticeItem {
  return {
    id: `${sentence.sentenceId}-role-${role}`,
    type: "role_choice",
    articleId,
    sentenceId: sentence.sentenceId,
    prompt: `本句的${role}是哪一部分？`,
    options: buildOptions(answerChunk.english, sentence.chunks.map((chunk) => chunk.english)),
    answer: answerChunk.english,
    explanation: `${answerChunk.english} 在本句中充当${answerChunk.role}。`
  };
}

function makeChunkTranslationChoice(articleId: string, sentence: Sentence, chunk: Chunk): PracticeItem {
  return {
    id: `${sentence.sentenceId}-translation-${chunk.chunkId}`,
    type: "chunk_translation_choice",
    articleId,
    sentenceId: sentence.sentenceId,
    prompt: `"${chunk.english}" 对应的结构直译是？`,
    options: buildOptions(chunk.chinese, sentence.chunks.map((item) => item.chinese)),
    answer: chunk.chinese,
    explanation: `该结构块的语法角色是${chunk.role}。`
  };
}

function buildOptions(answer: string, pool: string[]) {
  const unique = Array.from(new Set(pool.filter((item) => item && item !== answer)));
  const distractors = unique.slice(0, 3);
  return shuffleStable([answer, ...distractors]).slice(0, 4);
}

function shuffleStable(values: string[]) {
  return values
    .map((value) => ({ value, score: hashString(value) }))
    .sort((a, b) => a.score - b.score)
    .map((item) => item.value);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return hash;
}

function collectWordMeanings(article: Article) {
  return article.sentences.flatMap((sentence) => sentence.keyWords.map((word) => word.meaning));
}

function collectPhraseMeanings(article: Article) {
  return article.sentences.flatMap((sentence) => sentence.keyPhrases.map((phrase) => phrase.meaning));
}

function describeChunk(sentence: Sentence, chunkId: string) {
  const chunk = sentence.chunks.find((item) => item.chunkId === chunkId);
  return chunk ? `${chunk.role}：“${chunk.english}”` : "当前句子的某个结构块";
}
