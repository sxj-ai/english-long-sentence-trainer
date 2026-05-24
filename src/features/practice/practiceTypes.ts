export type PracticeType = "role_choice" | "chunk_translation_choice" | "vocab_choice" | "phrase_choice" | "relation_choice";

export interface PracticeItem {
  id: string;
  type: PracticeType;
  articleId: string;
  sentenceId: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}
