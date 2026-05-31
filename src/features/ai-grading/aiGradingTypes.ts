import type { Chunk } from "@/features/article/articleTypes";

export interface AiGradingInput {
  articleId: string;
  sentenceId: string;
  original: string;
  translationLiteral: string;
  chunks: Chunk[];
  question: string;
  studentAnswer: string;
  gradingRubric: string;
  maxScore?: number;
}

export interface AiGradingResult {
  score: number;
  maxScore: number;
  isAcceptable: boolean;
  strengths: string[];
  problems: string[];
  correctedAnswer: string;
  explanation: string;
}
