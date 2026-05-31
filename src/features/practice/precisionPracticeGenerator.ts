import type { Article, Chunk, KeyPhrase, KeyWord, Sentence } from "@/features/article/articleTypes";
import type {
  AnswerKeyPoint,
  DiagnosticChoice,
  PrecisionAnswerKey,
  PrecisionPracticeItem,
  SubjectiveTask
} from "./precisionPracticeTypes";

const CLAUSE_ROLE_OPTIONS = ["主语从句", "宾语从句", "定语从句", "状语从句"];

const VOCAB_TRAPS: Record<string, { correct: string; traps: string[]; note: string }> = {
  suggest: {
    correct: "表明/暗示",
    traps: ["建议", "推荐", "使想起"],
    note: "本句如果后接事实性内容或 that 从句，常理解为“表明/暗示”。"
  },
  case: {
    correct: "情况/案例",
    traps: ["箱子", "案件", "语法格"],
    note: "case 在考研阅读中常表示“情况、案例、论据”，要结合上下文判断。"
  },
  claim: {
    correct: "声称/自称",
    traps: ["索赔", "要求", "占领"],
    note: "claim to be 常表示“自称是”。"
  },
  see: {
    correct: "经历/见证/认为",
    traps: ["看见", "拜访", "送别"],
    note: "see 在抽象语境中常不译为“看见”，要看宾语内容。"
  }
};

export function generatePrecisionPracticeItems(article: Article): PrecisionPracticeItem[] {
  return article.sentences
    .filter((sentence) => sentence.difficulty >= 3 || hasHighValuePattern(sentence))
    .map((sentence) => makePrecisionPracticeItem(article, sentence))
    .slice(0, 12);
}

function makePrecisionPracticeItem(article: Article, sentence: Sentence): PrecisionPracticeItem {
  const answerKey = buildAnswerKey(sentence);
  const diagnosticChoices = buildDiagnosticChoices(sentence, answerKey);
  const focusTags = buildFocusTags(sentence, diagnosticChoices);

  return {
    practiceId: `practice_${sentence.sentenceId}_precision_auto`,
    sourceSentenceId: sentence.sentenceId,
    sourceSnapshot: {
      year: sentence.year,
      examType: sentence.examType,
      textId: sentence.textId,
      original: sentence.original
    },
    difficulty: sentence.difficulty,
    focusTags,
    whyKey: buildWhyKey(sentence, focusTags),
    subjectiveTasks: buildSubjectiveTasks(sentence),
    diagnosticChoices,
    answerKey,
    commonErrors: buildCommonErrors(sentence, diagnosticChoices),
  };
}

function buildSubjectiveTasks(sentence: Sentence): SubjectiveTask[] {
  const prefix = sentence.sentenceId;

  return [
    {
      taskId: `${prefix}_main_structure`,
      taskType: "main_structure",
      prompt: "请写出本句主干，并标明主语、谓语、宾语/表语。",
      inputHint: "先找核心主谓，再处理从句、插入语和修饰成分。",
      score: 20
    },
    {
      taskId: `${prefix}_grammar_analysis`,
      taskType: "grammar_analysis",
      prompt: "请分析本句主要语法成分，并说明从句或短语修饰/说明的对象。",
      inputHint: "重点写清从句类型、介词短语、后置定语、强调结构等。",
      score: 25
    },
    {
      taskId: `${prefix}_sentence_cuts`,
      taskType: "sentence_cuts",
      prompt: "请用 / 把本句切分成便于翻译的小段。",
      inputHint: "按结构切分，不要只按长度切。",
      score: 15
    },
    {
      taskId: `${prefix}_key_language`,
      taskType: "key_language",
      prompt: "请写出本句重点词、熟词僻义、固定搭配或句型。",
      inputHint: "优先写影响理解和翻译的词、短语、句型。",
      score: 10
    },
    {
      taskId: `${prefix}_translation`,
      taskType: "structure_translation",
      prompt: "请按照句子结构，把本句翻译成一个完整通顺的中文句子。",
      inputHint: "不要只堆词义，要体现主干和修饰关系。",
      score: 20
    },
    {
      taskId: `${prefix}_self_check`,
      taskType: "self_check",
      prompt: "对照答案后，请写出你最需要订正的一处语法或词义问题。",
      inputHint: "写清楚错因，不要只写“已订正”。",
      score: 10
    }
  ];
}

function buildAnswerKey(sentence: Sentence): PrecisionAnswerKey {
  const subject = findChunk(sentence, ["主语"]);
  const predicate = findChunk(sentence, ["谓语", "并列谓语"]);
  const object = findChunk(sentence, ["宾语", "宾语从句"]);
  const predicative = findChunk(sentence, ["表语"]);
  const complement = findChunk(sentence, ["宾语补足语", "补语"]);

  return {
    mainStructure: {
      subject: subject?.english,
      predicate: predicate?.english,
      object: object?.english,
      predicative: predicative?.english,
      complement: complement?.english,
      note: buildMainStructureNote(sentence, subject, predicate, object, predicative, complement)
    },
    grammarAnalysis: buildGrammarAnalysis(sentence),
    standardCuts: buildStandardCuts(sentence),
    keyLanguage: buildKeyLanguage(sentence),
    translation: {
      literal: sentence.translationLiteral
    }
  };
}

function buildMainStructureNote(
  sentence: Sentence,
  subject?: Chunk,
  predicate?: Chunk,
  object?: Chunk,
  predicative?: Chunk,
  complement?: Chunk
) {
  const parts = [
    subject ? `主语：${subject.english}` : null,
    predicate ? `谓语：${predicate.english}` : null,
    object ? `宾语：${object.english}` : null,
    predicative ? `表语：${predicative.english}` : null,
    complement ? `补语：${complement.english}` : null
  ].filter(Boolean);

  if (sentence.chunks.some((chunk) => chunk.role.includes("强调结构"))) {
    parts.push("本句含强调结构，注意不要误判为普通形式主语。");
  }

  if (sentence.original.trim().endsWith("?")) {
    parts.push("本句是疑问句，分析主干时要注意还原核心主谓关系。");
  }

  return parts.join("；") || "请根据句中核心主谓关系判断主干。";
}

function buildGrammarAnalysis(sentence: Sentence): AnswerKeyPoint[] {
  return sentence.chunks
    .filter((chunk) => shouldExposeGrammarPoint(chunk))
    .map((chunk) => ({
      text: chunk.english,
      role: chunk.role,
      target: resolveTarget(sentence, chunk),
      explanation: chunk.relation ?? `${chunk.english} 在句中充当${chunk.role}。`
    }))
    .slice(0, 8);
}

function buildStandardCuts(sentence: Sentence) {
  const ordered = sentence.chunks.filter((chunk) => !isTinyFunctionChunk(chunk));
  if (ordered.length >= 3) {
    return ordered.map((chunk) => chunk.english).slice(0, 10);
  }
  return sentence.original
    .split(/,\s+|;\s+|:\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildKeyLanguage(sentence: Sentence): AnswerKeyPoint[] {
  const words = sentence.keyWords.map((word) => ({
    text: word.word,
    role: word.pos ? `重点词（${word.pos}）` : "重点词",
    target: resolveChunkText(sentence, word.chunkId),
    explanation: word.meaning
  }));

  const phrases = sentence.keyPhrases.map((phrase) => ({
    text: phrase.phrase,
    role: phrase.phraseType ? `固定搭配（${phrase.phraseType}）` : "固定搭配",
    target: resolveChunkText(sentence, phrase.chunkId),
    explanation: phrase.meaning
  }));

  return [...words, ...phrases].slice(0, 8);
}

function buildDiagnosticChoices(sentence: Sentence, answerKey: PrecisionAnswerKey): DiagnosticChoice[] {
  const choices = [
    buildVocabTrapChoice(sentence),
    buildClauseRoleChoice(sentence),
    buildModifierTargetChoice(sentence),
    buildPatternChoice(sentence)
  ].filter(Boolean) as DiagnosticChoice[];

  if (choices.length > 0) {
    return choices.slice(0, 4);
  }

  return [buildMainStructureChoice(sentence, answerKey)];
}

function buildVocabTrapChoice(sentence: Sentence): DiagnosticChoice | null {
  const word = sentence.keyWords.find((item) => VOCAB_TRAPS[item.word.toLowerCase()]) ?? sentence.keyWords[0];
  if (!word) {
    return null;
  }

  const trap = VOCAB_TRAPS[word.word.toLowerCase()];
  const correct = trap?.correct ?? word.meaning;
  const traps = trap?.traps ?? buildMeaningDistractors(word, sentence.keyWords);
  const options = shuffleStable([correct, ...traps].slice(0, 4)).map((text, index) => ({
    label: String.fromCharCode(65 + index),
    text,
    isCorrect: text === correct,
    trapReason: text === correct ? null : buildVocabTrapReason(word, text, trap?.note)
  }));

  return {
    choiceId: `${sentence.sentenceId}_${word.word}_meaning`,
    choiceType: "vocab_trap",
    target: word.word,
    errorTag: trap ? "familiar_word_unfamiliar_meaning" : "word_meaning_missing",
    prompt: `本句中 ${word.word} 最合适的意思是：`,
    options,
    explanation: trap?.note ?? `${word.word} 在本句中的意思是“${word.meaning}”。`
  };
}

function buildClauseRoleChoice(sentence: Sentence): DiagnosticChoice | null {
  const clause = sentence.chunks.find((chunk) => CLAUSE_ROLE_OPTIONS.includes(chunk.role));
  if (!clause) {
    return null;
  }

  return {
    choiceId: `${sentence.sentenceId}_${clause.chunkId}_role`,
    choiceType: "grammar_trap",
    target: clause.english,
    errorTag: "clause_type_wrong",
    prompt: `${clause.english} 在句中作什么成分？`,
    options: CLAUSE_ROLE_OPTIONS.map((role, index) => ({
      label: String.fromCharCode(65 + index),
      text: role,
      isCorrect: role === clause.role,
      trapReason: role === clause.role ? null : buildClauseTrapReason(role, clause)
    })),
    explanation: clause.relation ?? `${clause.english} 在句中是${clause.role}。`
  };
}

function buildModifierTargetChoice(sentence: Sentence): DiagnosticChoice | null {
  const modifier = sentence.chunks.find((chunk) => chunk.targetId && chunk.relation && isModifierRole(chunk.role));
  if (!modifier?.targetId) {
    return null;
  }

  const target = sentence.chunks.find((chunk) => chunk.chunkId === modifier.targetId);
  if (!target) {
    return null;
  }

  const distractors = sentence.chunks
    .filter((chunk) => chunk.chunkId !== target.chunkId && chunk.english !== modifier.english)
    .map((chunk) => chunk.english)
    .slice(0, 3);

  const options = shuffleStable([target.english, ...distractors].slice(0, 4)).map((text, index) => ({
    label: String.fromCharCode(65 + index),
    text,
    isCorrect: text === target.english,
    trapReason: text === target.english ? null : "这是常见误判对象；判断修饰关系时要看该成分和中心词的结构关系。"
  }));

  return {
    choiceId: `${sentence.sentenceId}_${modifier.chunkId}_target`,
    choiceType: "modifier_trap",
    target: modifier.english,
    errorTag: "modifier_target_wrong",
    prompt: `${modifier.english} 主要修饰或说明哪一部分？`,
    options,
    explanation: modifier.relation ?? `${modifier.english} 指向 ${target.english}。`
  };
}

function buildPatternChoice(sentence: Sentence): DiagnosticChoice | null {
  const emphasis = sentence.chunks.find((chunk) => chunk.role.includes("强调结构"));
  if (!emphasis && !sentence.original.includes("It is") && !sentence.original.includes("It was")) {
    return null;
  }

  const correct = emphasis ? "强调句" : "形式主语";
  const options = ["形式主语", "强调句", "宾语从句", "倒装句"].map((text, index) => ({
    label: String.fromCharCode(65 + index),
    text,
    isCorrect: text === correct,
    trapReason: text === correct ? null : "该选项容易和 It is...that... 结构混淆，需要看 that 后内容是否被强调。"
  }));

  return {
    choiceId: `${sentence.sentenceId}_pattern`,
    choiceType: "pattern_trap",
    target: emphasis?.english ?? "It is ...",
    errorTag: "emphasis_vs_formal_subject_confused",
    prompt: "本句最核心的特殊句型是：",
    options,
    explanation: emphasis?.relation ?? "需要结合 It is/was ... that ... 的结构判断它是强调句还是形式主语。"
  };
}

function buildMainStructureChoice(sentence: Sentence, answerKey: PrecisionAnswerKey): DiagnosticChoice {
  const correct = answerKey.mainStructure.predicate ?? "核心谓语需要结合主干判断";
  const distractors = sentence.chunks
    .filter((chunk) => chunk.english !== correct)
    .map((chunk) => chunk.english)
    .slice(0, 3);

  return {
    choiceId: `${sentence.sentenceId}_predicate`,
    choiceType: "grammar_trap",
    target: sentence.original,
    errorTag: "predicate_wrong",
    prompt: "本句核心谓语最接近哪一部分？",
    options: shuffleStable([correct, ...distractors]).map((text, index) => ({
      label: String.fromCharCode(65 + index),
      text,
      isCorrect: text === correct,
      trapReason: text === correct ? null : "这是句中重要成分，但不是主干谓语。"
    })),
    explanation: answerKey.mainStructure.note
  };
}

function buildCommonErrors(sentence: Sentence, choices: DiagnosticChoice[]) {
  const errors = choices.map((choice) => ({
    errorTag: choice.errorTag,
    description: `在“${choice.target}”处容易判断错误。`,
    diagnosis: choice.prompt,
    remediation: choice.explanation
  }));

  return [
    ...errors,
    {
      errorTag: "translation_not_structure_based",
      description: "翻译只凭大意，没有体现主干和修饰关系。",
      diagnosis: "学生可能直接看词义翻译，没有先划分结构。",
      remediation: "先写主干，再逐层加入从句、短语和插入成分。"
    },
    {
      errorTag: "self_check_empty",
      description: "对答案后只写“已订正”，没有说明具体错因。",
      diagnosis: "学生没有完成“对”和“记”的环节。",
      remediation: "至少写出一个错因和下一次识别方法。"
    }
  ].slice(0, 5);
}

function buildFocusTags(sentence: Sentence, choices: DiagnosticChoice[]) {
  const tags = new Set<string>(["主干识别", "结构直译"]);

  for (const chunk of sentence.chunks) {
    if (chunk.role.includes("从句")) {
      tags.add(chunk.role);
    }
    if (chunk.role.includes("强调结构")) {
      tags.add("强调句");
    }
    if (chunk.role === "定语") {
      tags.add("后置定语/定语");
    }
    if (chunk.role === "状语") {
      tags.add("状语");
    }
  }

  for (const choice of choices) {
    if (choice.choiceType === "vocab_trap") {
      tags.add("熟词僻义/重点词");
    }
  }

  return Array.from(tags).slice(0, 6);
}

function buildWhyKey(sentence: Sentence, focusTags: string[]) {
  const firstClause = sentence.chunks.find((chunk) => chunk.role.includes("从句"));
  const firstPhrase = sentence.keyPhrases[0];
  const details = [
    firstClause ? `含有${firstClause.role}` : null,
    firstPhrase ? `包含固定搭配 ${firstPhrase.phrase}` : null,
    `适合检测${focusTags.slice(0, 3).join("、")}`
  ].filter(Boolean);

  return details.join("，") + "。";
}

function hasHighValuePattern(sentence: Sentence) {
  return sentence.chunks.some((chunk) => chunk.role.includes("从句") || chunk.role.includes("强调结构"));
}

function findChunk(sentence: Sentence, roles: string[]) {
  return sentence.chunks.find((chunk) => roles.includes(chunk.role));
}

function shouldExposeGrammarPoint(chunk: Chunk) {
  return (
    chunk.role.includes("从句") ||
    chunk.role.includes("强调结构") ||
    chunk.role.includes("插入语") ||
    chunk.role.includes("同位语") ||
    chunk.role === "定语" ||
    chunk.role === "状语" ||
    Boolean(chunk.relation)
  );
}

function isTinyFunctionChunk(chunk: Chunk) {
  return chunk.role === "连接成分" && chunk.english.length <= 4;
}

function isModifierRole(role: string) {
  return role.includes("定语") || role.includes("状语") || role.includes("插入语") || role.includes("从句");
}

function resolveTarget(sentence: Sentence, chunk: Chunk) {
  if (!chunk.targetId) {
    return undefined;
  }
  return sentence.chunks.find((item) => item.chunkId === chunk.targetId)?.english;
}

function resolveChunkText(sentence: Sentence, chunkId: string) {
  return sentence.chunks.find((chunk) => chunk.chunkId === chunkId)?.english;
}

function buildMeaningDistractors(word: KeyWord, words: KeyWord[]) {
  const distractors = words.filter((item) => item.word !== word.word).map((item) => item.meaning);
  return [...distractors, "建议", "影响", "证明"].slice(0, 3);
}

function buildVocabTrapReason(word: KeyWord, text: string, note?: string) {
  if (note) {
    return `${text} 是容易误选的义项；${note}`;
  }
  return `${text} 是干扰义项；本句中 ${word.word} 应结合所在结构理解。`;
}

function buildClauseTrapReason(role: string, clause: Chunk) {
  if (role === "定语从句") {
    return `${clause.english} 不一定是在修饰前面的名词，要看它在主句中承担的功能。`;
  }
  return `这是常见从句误判；本句应根据它和主句谓语/中心词的关系判断。`;
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
