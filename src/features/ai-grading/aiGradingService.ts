import type { AiGradingInput, AiGradingResult } from "./aiGradingTypes";

export async function gradeWithAi(_input: AiGradingInput): Promise<AiGradingResult> {
  throw new Error("AI 自动批改将在用户系统和主观题系统完成后接入。");
}
