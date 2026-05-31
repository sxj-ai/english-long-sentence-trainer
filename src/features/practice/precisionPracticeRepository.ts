import { promises as fs } from "fs";
import path from "path";
import type { Article } from "@/features/article/articleTypes";
import { generatePrecisionPracticeItems } from "./precisionPracticeGenerator";
import type {
  AnswerKeyPoint,
  CommonError,
  DiagnosticChoice,
  DiagnosticChoiceOption,
  PrecisionPracticeItem,
  SubjectiveTask
} from "./precisionPracticeTypes";

const PRACTICE_DIR = path.join(process.cwd(), "data", "practice");

interface RawPracticeItem {
  practice_id: string;
  source_sentence_id: string;
  practice_type?: string;
  version?: string;
  source_snapshot: {
    year: number;
    exam_type: string;
    text_id: string;
    original: string;
    translation_literal?: string;
    difficulty?: number;
  };
  difficulty: number;
  is_key_sentence?: boolean;
  focus_tags: string[];
  why_key: string;
  subjective_tasks: RawSubjectiveTask[];
  diagnostic_choices: RawDiagnosticChoice[];
  answer_key: RawAnswerKey;
  common_errors: RawCommonError[];
}

interface RawSubjectiveTask {
  task_id: string;
  task_type: SubjectiveTask["taskType"];
  prompt: string;
  input_hint: string;
  score: number;
}

interface RawDiagnosticChoice {
  choice_id: string;
  choice_type: DiagnosticChoice["choiceType"];
  target: string;
  error_tag: string;
  prompt: string;
  options: RawDiagnosticChoiceOption[];
  explanation: string;
}

interface RawDiagnosticChoiceOption {
  label: string;
  text: string;
  is_correct: boolean;
  trap_reason: string | null;
}

interface RawAnswerKey {
  main_structure: {
    subject?: string;
    predicate?: string;
    object?: string;
    predicative?: string;
    complement?: string;
    real_subject?: string;
    adverbial?: string;
    note: string;
  };
  grammar_analysis: RawAnswerKeyPoint[];
  standard_cuts: string[];
  key_language: RawAnswerKeyPoint[];
  translation: {
    literal: string;
    polished?: string;
  };
}

interface RawAnswerKeyPoint {
  text: string;
  role?: string;
  type?: string;
  target?: string;
  explanation?: string;
  meaning?: string;
}

interface RawCommonError {
  error_tag: string;
  description: string;
  diagnosis: string;
  remediation: string;
}

export async function getPrecisionPracticeItems(article: Article): Promise<PrecisionPracticeItem[]> {
  const manualItems = await loadManualPracticeItems(article);
  return manualItems.length > 0 ? manualItems : generatePrecisionPracticeItems(article);
}

async function loadManualPracticeItems(article: Article): Promise<PrecisionPracticeItem[]> {
  const filePath = path.join(PRACTICE_DIR, article.sourceFile.replace(/\.json$/i, "_precision_practice.json"));

  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as RawPracticeItem[];
    const sentenceIds = new Set(article.sentences.map((sentence) => sentence.sentenceId));

    return parsed
      .filter((item) => sentenceIds.has(item.source_sentence_id))
      .map(normalizePracticeItem);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Failed to load precision practice data for ${article.id}:`, error);
    }
    return [];
  }
}

function normalizePracticeItem(raw: RawPracticeItem): PrecisionPracticeItem {
  return {
    practiceId: raw.practice_id,
    sourceSentenceId: raw.source_sentence_id,
    sourceSnapshot: {
      year: raw.source_snapshot.year,
      examType: raw.source_snapshot.exam_type,
      textId: raw.source_snapshot.text_id,
      original: raw.source_snapshot.original
    },
    difficulty: raw.difficulty,
    focusTags: raw.focus_tags,
    whyKey: raw.why_key,
    subjectiveTasks: raw.subjective_tasks.map(normalizeSubjectiveTask),
    diagnosticChoices: raw.diagnostic_choices.map(normalizeDiagnosticChoice),
    answerKey: {
      mainStructure: {
        subject: raw.answer_key.main_structure.subject,
        predicate: raw.answer_key.main_structure.predicate,
        object: raw.answer_key.main_structure.object,
        predicative: raw.answer_key.main_structure.predicative,
        complement: raw.answer_key.main_structure.complement,
        realSubject: raw.answer_key.main_structure.real_subject,
        adverbial: raw.answer_key.main_structure.adverbial,
        note: raw.answer_key.main_structure.note
      },
      grammarAnalysis: raw.answer_key.grammar_analysis.map(normalizeAnswerKeyPoint),
      standardCuts: raw.answer_key.standard_cuts,
      keyLanguage: raw.answer_key.key_language.map(normalizeAnswerKeyPoint),
      translation: raw.answer_key.translation
    },
    commonErrors: raw.common_errors.map(normalizeCommonError)
  };
}

function normalizeSubjectiveTask(raw: RawSubjectiveTask): SubjectiveTask {
  return {
    taskId: raw.task_id,
    taskType: raw.task_type,
    prompt: raw.prompt,
    inputHint: raw.input_hint,
    score: raw.score
  };
}

function normalizeDiagnosticChoice(raw: RawDiagnosticChoice): DiagnosticChoice {
  return {
    choiceId: raw.choice_id,
    choiceType: raw.choice_type,
    target: raw.target,
    errorTag: raw.error_tag,
    prompt: raw.prompt,
    options: raw.options.map(normalizeDiagnosticChoiceOption),
    explanation: raw.explanation
  };
}

function normalizeDiagnosticChoiceOption(raw: RawDiagnosticChoiceOption): DiagnosticChoiceOption {
  return {
    label: raw.label,
    text: raw.text,
    isCorrect: raw.is_correct,
    trapReason: raw.trap_reason
  };
}

function normalizeAnswerKeyPoint(raw: RawAnswerKeyPoint): AnswerKeyPoint {
  return {
    text: raw.text,
    role: raw.role ?? raw.type ?? "重点",
    target: raw.target,
    explanation: raw.explanation ?? raw.meaning ?? ""
  };
}

function normalizeCommonError(raw: RawCommonError): CommonError {
  return {
    errorTag: raw.error_tag,
    description: raw.description,
    diagnosis: raw.diagnosis,
    remediation: raw.remediation
  };
}
