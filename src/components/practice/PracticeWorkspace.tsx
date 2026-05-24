"use client";

import { useMemo, useState } from "react";
import type { Article } from "@/features/article/articleTypes";
import { checkAnswer } from "@/features/practice/answerChecker";
import type { PracticeItem } from "@/features/practice/practiceTypes";
import { PracticeCard } from "./PracticeCard";

export function PracticeWorkspace({ article, items }: { article: Article; items: PracticeItem[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const result = useMemo(() => {
    const answered = Object.keys(answers).length;
    const correct = items.filter((item) => checkAnswer(answers[item.id] ?? null, item.answer)).length;
    return { answered, correct };
  }, [answers, items]);

  return (
    <section className="practice-layout">
      <div className="practice-header">
        <div>
          <p className="eyebrow">检测练习</p>
          <h1>{article.title}</h1>
          <p>题目由当前 JSON 的结构块、重点词和重点短语自动生成。</p>
        </div>
        <div className="score-box">
          <strong>{result.correct}</strong>
          <span>正确 / 已答 {result.answered}</span>
        </div>
      </div>

      <div className="practice-list">
        {items.slice(0, 30).map((item, index) => (
          <PracticeCard
            item={item}
            key={item.id}
            index={index + 1}
            selectedAnswer={answers[item.id]}
            onAnswer={(answer) => setAnswers((current) => ({ ...current, [item.id]: answer }))}
          />
        ))}
      </div>
    </section>
  );
}
