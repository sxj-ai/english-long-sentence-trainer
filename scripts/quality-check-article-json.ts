import { promises as fs } from "fs";
import path from "path";

type Chunk = {
  chunk_id: string;
  role: string;
  english: string;
  chinese: string;
  parent_id: string | null;
  target_id: string | null;
  relation: string | null;
};

type SentencePattern = {
  pattern_name: string;
  pattern_form: string;
  explanation: string;
};

type KeyWord = {
  word: string;
  pos?: string;
  meaning: string;
  chunk_id: string;
};

type KeyPhrase = {
  phrase: string;
  phrase_type?: string;
  meaning: string;
  chunk_id: string;
};

type Sentence = {
  sentence_id: string;
  original: string;
  chunks: Chunk[];
  sentence_patterns?: SentencePattern[];
  key_words: KeyWord[];
  key_phrases: KeyPhrase[];
};

const allowedPos = new Set([
  "n.",
  "v.",
  "adj.",
  "adv.",
  "pron.",
  "prep.",
  "conj.",
  "det.",
  "modal v.",
  "num.",
  "abbr."
]);

const allowedPhraseTypes = new Set([
  "n. phr.",
  "v. phr.",
  "adj. phr.",
  "adv. phr.",
  "prep. phr.",
  "conj. phr.",
  "modal phr.",
  "idiom",
  "collocation",
  "sentence pattern",
  "as-structure",
  "absolute construction",
  "parenthetical",
  "question pattern"
]);

const allowedPatternNames = new Set([
  "强调句",
  "形式主语",
  "形式宾语",
  "倒装句",
  "让步倒装",
  "省略结构",
  "插入语结构",
  "as 引导的特殊结构",
  "as...as...",
  "分裂结构 / 间隔结构",
  "同位语解释结构",
  "长并列结构"
]);

const allowedRoles = new Set([
  "as 引导结构",
  "被强调部分",
  "表语",
  "表语从句",
  "表语核心",
  "宾语",
  "宾语补足语",
  "宾语从句",
  "宾语核心",
  "并列表语",
  "并列宾语",
  "并列宾语从句",
  "并列成分",
  "并列定语",
  "并列非谓语",
  "并列非谓语结构",
  "并列分句",
  "并列谓语",
  "并列原因",
  "并列原因状语从句",
  "并列状语",
  "补语",
  "插入/解释结构",
  "插入举例",
  "插入语",
  "从句表语",
  "从句宾语",
  "从句谓语",
  "从句主语",
  "存在句",
  "倒装/省略结构",
  "倒装结构",
  "定语",
  "定语从句",
  "定语从句宾语",
  "定语从句谓语",
  "定语从句主语",
  "非谓语核心",
  "非谓语结构",
  "非谓语主语",
  "结果状语从句",
  "连接成分",
  "祈使句",
  "强调结构",
  "让步/选择结构",
  "让步状语",
  "让步状语从句",
  "省略结构",
  "省略谓语",
  "条件状语从句",
  "同位语",
  "同位语从句",
  "同位语从句表语",
  "同位语从句宾语",
  "同位语从句谓语",
  "同位语从句主语",
  "同位语解释结构",
  "谓语",
  "形式宾语",
  "形式主语",
  "引语谓语",
  "引语主语",
  "原因状语",
  "原因状语从句",
  "真正宾语",
  "真正宾语从句",
  "真正主语",
  "真正主语从句",
  "真正主语核心",
  "主语",
  "主语从句",
  "主语核心",
  "转折分句",
  "状语",
  "状语从句"
]);

const vagueRelations = [
  "主干或独立结构",
  "修饰成分",
  "补充说明",
  "从句内部结构",
  "说明内容",
  "相关结构"
];

async function main() {
  const articleDirs = [
    path.join(process.cwd(), "英语一json"),
    path.join(process.cwd(), "英语二json"),
    path.join(process.cwd(), "data", "articles")
  ];
  const files = (await Promise.all(articleDirs.map(readJsonFilesIfExists))).flat();
  let issueCount = 0;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const sentences = JSON.parse(content) as Sentence[];
    const issues = checkArticle(sentences);

    console.log(`${path.relative(process.cwd(), filePath)}: ${sentences.length} sentences, ${issues.length} quality issues`);
    for (const issue of issues) {
      issueCount += 1;
      console.warn(`  - ${issue}`);
    }
  }

  if (issueCount > 0) {
    console.warn(`\nQuality gate found ${issueCount} issue(s).`);
    process.exitCode = 1;
  }
}

function checkArticle(sentences: Sentence[]) {
  const issues: string[] = [];

  for (const sentence of sentences) {
    const chunkIds = new Set(sentence.chunks.map((chunk) => chunk.chunk_id));
    const chunksByEnglishAndRole = new Map<string, Chunk[]>();

    for (const chunk of sentence.chunks) {
      if (!allowedRoles.has(chunk.role)) {
        issues.push(`${sentence.sentence_id}: unsupported role "${chunk.role}" in ${chunk.chunk_id}`);
      }

      if ((chunk.parent_id || chunk.target_id) && !chunk.relation) {
        issues.push(`${sentence.sentence_id}: ${chunk.chunk_id} has parent/target but empty relation`);
      }

      if (chunk.relation && vagueRelations.includes(chunk.relation.trim())) {
        issues.push(`${sentence.sentence_id}: ${chunk.chunk_id} relation is too vague: ${chunk.relation}`);
      }

      if (/结构(?:直译)?片段/.test(chunk.chinese)) {
        issues.push(`${sentence.sentence_id}: ${chunk.chunk_id} uses placeholder chunk translation`);
      }

      const duplicateKey = `${normalizeText(chunk.english)}::${chunk.role}`;
      const duplicateGroup = chunksByEnglishAndRole.get(duplicateKey) ?? [];
      duplicateGroup.push(chunk);
      chunksByEnglishAndRole.set(duplicateKey, duplicateGroup);

      if (isLongClause(chunk) && !hasClauseInternalBreakdown(sentence.chunks, chunk.chunk_id)) {
        issues.push(`${sentence.sentence_id}: ${chunk.chunk_id} long clause lacks internal subject/predicate breakdown`);
      }
    }

    for (const group of chunksByEnglishAndRole.values()) {
      if (group.length > 1 && !isExplainedRepeatedStructure(group)) {
        issues.push(`${sentence.sentence_id}: duplicate same-role chunk text "${group[0].english}" (${group.map((chunk) => chunk.chunk_id).join(", ")})`);
      }
    }

    if (wordCount(sentence.original) >= 25 && sentence.chunks.length < 6) {
      issues.push(`${sentence.sentence_id}: long sentence has only ${sentence.chunks.length} chunks`);
    }

    for (const word of sentence.key_words) {
      if (!word.pos) {
        issues.push(`${sentence.sentence_id}: key word "${word.word}" is missing pos`);
      } else if (!allowedPos.has(word.pos)) {
        issues.push(`${sentence.sentence_id}: key word "${word.word}" uses unsupported pos "${word.pos}"`);
      }

      if (/文中重点词|结合所在结构理解/.test(word.meaning)) {
        issues.push(`${sentence.sentence_id}: key word "${word.word}" uses placeholder meaning`);
      }

      if (!chunkIds.has(word.chunk_id)) {
        issues.push(`${sentence.sentence_id}: key word "${word.word}" points to missing chunk ${word.chunk_id}`);
      }
    }

    for (const phrase of sentence.key_phrases) {
      if (!phrase.phrase_type) {
        issues.push(`${sentence.sentence_id}: key phrase "${phrase.phrase}" is missing phrase_type`);
      } else if (!allowedPhraseTypes.has(phrase.phrase_type)) {
        issues.push(`${sentence.sentence_id}: key phrase "${phrase.phrase}" uses unsupported phrase_type "${phrase.phrase_type}"`);
      }

      if (/文中关键短语|按上下文理解/.test(phrase.meaning)) {
        issues.push(`${sentence.sentence_id}: key phrase "${phrase.phrase}" uses placeholder meaning`);
      }

      if (!chunkIds.has(phrase.chunk_id)) {
        issues.push(`${sentence.sentence_id}: key phrase "${phrase.phrase}" points to missing chunk ${phrase.chunk_id}`);
      }
    }

    for (const pattern of sentence.sentence_patterns ?? []) {
      if (!allowedPatternNames.has(pattern.pattern_name)) {
        issues.push(`${sentence.sentence_id}: unsupported sentence pattern "${pattern.pattern_name}"`);
      }

      if (pattern.explanation.length < 12) {
        issues.push(`${sentence.sentence_id}: sentence pattern "${pattern.pattern_name}" explanation is too short`);
      }
    }
  }

  return issues;
}

function isLongClause(chunk: Chunk) {
  const text = normalizeText(chunk.english).toLowerCase();
  if (/^(how|what|whether|if|why|when|where) to\b/.test(text)) return false;

  const clauseRoles = [
    "主语从句",
    "宾语从句",
    "表语从句",
    "同位语从句",
    "定语从句",
    "状语从句",
    "条件状语从句",
    "原因状语从句",
    "让步状语从句",
    "时间状语从句",
    "并列宾语从句",
    "并列分句"
  ];
  return clauseRoles.some((role) => chunk.role === role || chunk.role.startsWith(role)) && wordCount(chunk.english) >= 8;
}

function hasClauseInternalBreakdown(chunks: Chunk[], parentId: string) {
  const byParent = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const list = byParent.get(chunk.parent_id ?? "") ?? [];
    list.push(chunk);
    byParent.set(chunk.parent_id ?? "", list);
  }

  const visited = new Set<string>();
  const stack = [...(byParent.get(parentId) ?? [])];
  let hasSubject = false;
  let hasPredicate = false;

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current.chunk_id)) continue;
    visited.add(current.chunk_id);

    if (current.role.includes("主语")) hasSubject = true;
    if (current.role.includes("谓语")) hasPredicate = true;

    const children = byParent.get(current.chunk_id) ?? [];
    for (const child of children) stack.push(child);
  }

  return hasSubject && hasPredicate;
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isExplainedRepeatedStructure(chunks: Chunk[]) {
  return chunks.every((chunk) => {
    const relation = chunk.relation ?? "";
    return /第一|第二|前一|后一|并列|主句|从句|分句|条件|原因|让步|时间|定语|宾语|同位语/.test(relation);
  });
}

function wordCount(text: string) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

async function readJsonFilesIfExists(dir: string) {
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => file.endsWith(".json")).map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
