export type SubjectiveTaskType =
  | "main_structure"
  | "grammar_analysis"
  | "sentence_cuts"
  | "key_language"
  | "structure_translation"
  | "self_check";

export type DiagnosticChoiceType =
  | "vocab_trap"
  | "grammar_trap"
  | "modifier_trap"
  | "modifier_target_trap"
  | "pattern_trap";

export interface PrecisionPracticeItem {
  practiceId: string;
  sourceSentenceId: string;
  sourceSnapshot: {
    year: number;
    examType: string;
    textId: string;
    original: string;
  };
  difficulty: number;
  focusTags: string[];
  whyKey: string;
  subjectiveTasks: SubjectiveTask[];
  diagnosticChoices: DiagnosticChoice[];
  answerKey: PrecisionAnswerKey;
  commonErrors: CommonError[];
}

export interface SubjectiveTask {
  taskId: string;
  taskType: SubjectiveTaskType;
  prompt: string;
  inputHint: string;
  score: number;
}

export interface DiagnosticChoice {
  choiceId: string;
  choiceType: DiagnosticChoiceType;
  target: string;
  errorTag: string;
  prompt: string;
  options: DiagnosticChoiceOption[];
  explanation: string;
}

export interface DiagnosticChoiceOption {
  label: string;
  text: string;
  isCorrect: boolean;
  trapReason: string | null;
}

export interface PrecisionAnswerKey {
  mainStructure: {
    subject?: string;
    predicate?: string;
    object?: string;
    predicative?: string;
    complement?: string;
    realSubject?: string;
    adverbial?: string;
    note: string;
  };
  grammarAnalysis: AnswerKeyPoint[];
  standardCuts: string[];
  keyLanguage: AnswerKeyPoint[];
  translation: {
    literal: string;
    polished?: string;
  };
}

export interface AnswerKeyPoint {
  text: string;
  role: string;
  target?: string;
  explanation: string;
}

export interface CommonError {
  errorTag: string;
  description: string;
  diagnosis: string;
  remediation: string;
}
