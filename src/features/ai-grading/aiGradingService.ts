import type { AiGradingInput, AiGradingResult } from "./aiGradingTypes";
import { createChatCompletion } from "@/lib/sub2api";

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("AI 批改结果不是 JSON。");
  }

  return JSON.parse(source.slice(start, end + 1)) as Partial<AiGradingResult>;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 6);
}

function normalizeScore(value: unknown, maxScore: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(Math.max(Math.round(numberValue), 0), maxScore);
}

export async function gradeWithAi(input: AiGradingInput): Promise<AiGradingResult> {
  const maxScore = input.maxScore ?? 100;
  const content = await createChatCompletion(
    [
      {
        role: "system",
        content:
          "你是考研英语长难句老师，负责批改学生的主观分析答案。必须只返回 JSON，不要使用 Markdown。评分要严格依据题目要求、原句结构、chunks 和 rubric。"
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            instruction:
              "请批改学生答案，返回字段：score, maxScore, isAcceptable, strengths, problems, correctedAnswer, explanation。",
            articleId: input.articleId,
            sentenceId: input.sentenceId,
            original: input.original,
            translationLiteral: input.translationLiteral,
            chunks: input.chunks,
            question: input.question,
            studentAnswer: input.studentAnswer,
            gradingRubric: input.gradingRubric,
            maxScore
          },
          null,
          2
        )
      }
    ],
    {
      temperature: 0.1
    }
  );
  const parsed = extractJsonObject(content);
  const score = normalizeScore(parsed.score, maxScore);

  return {
    score,
    maxScore: normalizeScore(parsed.maxScore, maxScore) || maxScore,
    isAcceptable: typeof parsed.isAcceptable === "boolean" ? parsed.isAcceptable : score >= 60,
    strengths: normalizeStringList(parsed.strengths),
    problems: normalizeStringList(parsed.problems),
    correctedAnswer: String(parsed.correctedAnswer || "").trim(),
    explanation: String(parsed.explanation || "").trim()
  };
}
