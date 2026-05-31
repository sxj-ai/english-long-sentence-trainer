import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";

const practiceDir = path.join(process.cwd(), "data", "practice");
const articleDir = path.join(process.cwd(), "data", "articles");

const optionSchema = z.object({
  label: z.string().min(1),
  text: z.string().min(1),
  is_correct: z.boolean(),
  trap_reason: z.string().nullable()
});

const diagnosticChoiceSchema = z.object({
  choice_id: z.string().min(1),
  choice_type: z.string().min(1),
  target: z.string().min(1),
  error_tag: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(optionSchema).min(2),
  explanation: z.string().min(1)
});

const subjectiveTaskSchema = z.object({
  task_id: z.string().min(1),
  task_type: z.string().min(1),
  prompt: z.string().min(1),
  input_hint: z.string().min(1),
  score: z.number().positive()
});

const answerPointSchema = z.object({
  text: z.string().min(1),
  role: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  target: z.string().optional(),
  explanation: z.string().min(1).optional(),
  meaning: z.string().min(1).optional()
}).refine((point) => point.role || point.type, {
  message: "expected either role or type"
}).refine((point) => point.explanation || point.meaning, {
  message: "expected either explanation or meaning"
});

const practiceItemSchema = z.object({
  practice_id: z.string().min(1),
  source_sentence_id: z.string().min(1),
  practice_type: z.string().min(1),
  version: z.string().min(1),
  source_snapshot: z.object({
    year: z.number(),
    exam_type: z.string().min(1),
    text_id: z.string().min(1),
    original: z.string().min(1),
    translation_literal: z.string().optional(),
    difficulty: z.number().optional()
  }),
  difficulty: z.number(),
  is_key_sentence: z.boolean().optional(),
  focus_tags: z.array(z.string().min(1)).min(1),
  why_key: z.string().min(1),
  subjective_tasks: z.array(subjectiveTaskSchema).min(1),
  diagnostic_choices: z.array(diagnosticChoiceSchema).min(1),
  answer_key: z.object({
    main_structure: z.object({
      subject: z.string().optional(),
      predicate: z.string().optional(),
      object: z.string().optional(),
      predicative: z.string().optional(),
      complement: z.string().optional(),
      real_subject: z.string().optional(),
      adverbial: z.string().optional(),
      note: z.string().min(1)
    }),
    grammar_analysis: z.array(answerPointSchema).min(1),
    standard_cuts: z.array(z.string().min(1)).min(1),
    key_language: z.array(answerPointSchema),
    translation: z.object({
      literal: z.string().min(1),
      polished: z.string().optional()
    })
  }),
  rubric: z.object({
    total_score: z.number().positive(),
    items: z.array(z.unknown()).min(1),
    level_rules: z.array(z.unknown()).min(1)
  }),
  common_errors: z.array(z.object({
    error_tag: z.string().min(1),
    description: z.string().min(1),
    diagnosis: z.string().min(1),
    remediation: z.string().min(1)
  })).min(1),
  review_plan: z.unknown().optional()
});

const practiceFileSchema = z.array(practiceItemSchema).min(1);

const meaningCheckSchema = z.object({
  check_id: z.string().min(1),
  source_sentence_id: z.string().min(1),
  target: z.string().min(1),
  target_type: z.enum(["word", "phrase", "function_word", "structure"]),
  prompt: z.string().min(1),
  correct_meaning: z.string().min(1),
  acceptable_meanings: z.array(z.string().min(1)).min(1),
  meaning_pool: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  priority: z.number().int().positive()
});

const meaningCheckFileSchema = z.array(meaningCheckSchema).min(1);

async function main() {
  const files = await readJsonFilesIfExists(practiceDir);

  if (files.length === 0) {
    console.log("data/practice: no practice files");
    return;
  }

  let hasError = false;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const fileName = path.basename(filePath);
    const parsedJson = JSON.parse(content);

    if (fileName.endsWith("_meaning_in_context.json")) {
      const parsed = meaningCheckFileSchema.safeParse(parsedJson);
      if (!parsed.success) {
        hasError = true;
        console.error(`${fileName}: schema errors`);
        console.error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
        continue;
      }

      const articleFile = fileName.replace(/_meaning_in_context\.json$/i, ".json");
      const articleSentences = await loadArticleSentences(articleFile);
      const warnings = validateMeaningChecks(parsed.data, articleSentences);

      console.log(`${path.relative(process.cwd(), filePath)}: ${parsed.data.length} meaning checks`);

      if (warnings.length > 0) {
        hasError = true;
        console.error(warnings.map((warning) => `  - ${warning}`).join("\n"));
      }

      continue;
    }

    const parsed = practiceFileSchema.safeParse(parsedJson);

    if (!parsed.success) {
      hasError = true;
      console.error(`${fileName}: schema errors`);
      console.error(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n"));
      continue;
    }

    const articleFile = fileName.replace(/_precision_practice\.json$/i, ".json");
    const articleSentences = await loadArticleSentences(articleFile);
    const warnings = validatePracticeItems(parsed.data, articleSentences);

    console.log(`${path.relative(process.cwd(), filePath)}: ${parsed.data.length} practice items`);

    if (warnings.length > 0) {
      hasError = true;
      console.error(warnings.map((warning) => `  - ${warning}`).join("\n"));
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

async function readJsonFilesIfExists(dir: string) {
  try {
    const files = await fs.readdir(dir);
    return files.filter((file) => file.endsWith(".json")).map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

async function loadArticleSentences(articleFile: string) {
  try {
    const content = await fs.readFile(path.join(articleDir, articleFile), "utf8");
    const parsed = JSON.parse(content) as Array<{ sentence_id: string; original: string }>;
    return new Map(parsed.map((sentence) => [sentence.sentence_id, sentence.original]));
  } catch {
    return new Map<string, string>();
  }
}

function validatePracticeItems(items: z.infer<typeof practiceFileSchema>, articleSentences: Map<string, string>) {
  const warnings: string[] = [];
  const practiceIds = new Set<string>();

  for (const item of items) {
    if (practiceIds.has(item.practice_id)) {
      warnings.push(`${item.practice_id}: practice_id duplicate`);
    }
    practiceIds.add(item.practice_id);

    const original = articleSentences.get(item.source_sentence_id);
    if (!original) {
      warnings.push(`${item.practice_id}: source_sentence_id ${item.source_sentence_id} not found in article JSON`);
    } else if (original !== item.source_snapshot.original) {
      warnings.push(`${item.practice_id}: source_snapshot.original does not match article original`);
    }

    const taskScore = item.subjective_tasks.reduce((sum, task) => sum + task.score, 0);
    if (taskScore !== item.rubric.total_score) {
      warnings.push(`${item.practice_id}: subjective task scores sum to ${taskScore}, rubric total is ${item.rubric.total_score}`);
    }

    for (const choice of item.diagnostic_choices) {
      const correctCount = choice.options.filter((option) => option.is_correct).length;
      if (correctCount !== 1) {
        warnings.push(`${item.practice_id}/${choice.choice_id}: expected exactly one correct option, got ${correctCount}`);
      }

      for (const option of choice.options) {
        if (!option.is_correct && !option.trap_reason) {
          warnings.push(`${item.practice_id}/${choice.choice_id}/${option.label}: wrong option missing trap_reason`);
        }
      }
    }
  }

  return warnings;
}

function validateMeaningChecks(items: z.infer<typeof meaningCheckFileSchema>, articleSentences: Map<string, string>) {
  const warnings: string[] = [];
  const checkIds = new Set<string>();

  for (const item of items) {
    if (checkIds.has(item.check_id)) {
      warnings.push(`${item.check_id}: check_id duplicate`);
    }
    checkIds.add(item.check_id);

    if (!articleSentences.has(item.source_sentence_id)) {
      warnings.push(`${item.check_id}: source_sentence_id ${item.source_sentence_id} not found in article JSON`);
    }

    if (!item.acceptable_meanings.includes(item.correct_meaning) && !item.correct_meaning.includes("/")) {
      warnings.push(`${item.check_id}: correct_meaning should normally be included in acceptable_meanings`);
    }

    const poolHasCorrect = item.meaning_pool.some((meaning) => meaning === item.correct_meaning || item.acceptable_meanings.includes(meaning));
    if (!poolHasCorrect) {
      warnings.push(`${item.check_id}: meaning_pool does not include a correct/acceptable meaning`);
    }
  }

  return warnings;
}

void main();
