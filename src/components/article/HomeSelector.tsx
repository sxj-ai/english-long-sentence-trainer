"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ArticleSummary } from "@/features/article/articleTypes";

const EXAM_TYPES = ["英语一", "英语二"] as const;
const YEARS = Array.from({ length: 17 }, (_, index) => 2010 + index);

export function HomeSelector({ articles }: { articles: ArticleSummary[] }) {
  const [examType, setExamType] = useState<(typeof EXAM_TYPES)[number]>("英语一");
  const [selectedYear, setSelectedYear] = useState(2015);

  const availableYears = useMemo(() => {
    return new Set(articles.filter((article) => article.examType === examType).map((article) => article.year));
  }, [articles, examType]);

  const selectedArticles = useMemo(() => {
    return articles
      .filter((article) => article.examType === examType && article.year === selectedYear)
      .sort((a, b) => getTextNumber(a.textId) - getTextNumber(b.textId));
  }, [articles, examType, selectedYear]);

  function chooseExam(nextExamType: (typeof EXAM_TYPES)[number]) {
    setExamType(nextExamType);
    const firstAvailable = YEARS.find((year) => articles.some((article) => article.examType === nextExamType && article.year === year));
    setSelectedYear(firstAvailable ?? 2015);
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <h1>考研英语长难句训练</h1>
      </section>

      <section className="exam-selector-panel">
        <div className="exam-tabs" aria-label="选择考试类型">
          {EXAM_TYPES.map((item) => (
            <button
              className={`exam-tab ${item === examType ? "is-active" : ""}`}
              key={item}
              onClick={() => chooseExam(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        <div className="year-grid" aria-label="选择年份">
          {YEARS.map((year) => {
            const hasData = availableYears.has(year);
            const isActive = year === selectedYear;
            return (
              <button
                className={`year-button ${isActive ? "is-active" : ""} ${hasData ? "has-data" : "is-disabled"}`}
                disabled={!hasData}
                key={year}
                onClick={() => setSelectedYear(year)}
                type="button"
              >
                <strong>{year}</strong>
                <span>{hasData ? "已开放" : "待开放"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="text-entry-panel">
        <div className="text-entry-heading">
          <h2>
            {selectedYear} {examType}
          </h2>
        </div>

        {selectedArticles.length > 0 ? (
          <div className="text-entry-grid">
            {selectedArticles.map((article) => (
              <article className="text-entry-card" key={article.id}>
                <div>
                  <h3>{article.textId}</h3>
                  <p>{article.sentenceCount} 个句子</p>
                </div>
                <div className="text-entry-actions">
                  <Link className="primary-link" href={`/articles/${article.id}`}>
                    学习
                  </Link>
                  <Link className="secondary-link" href={`/practice/${article.id}`}>
                    检测
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">该年份内容待开放。</div>
        )}
      </section>
    </div>
  );
}

function getTextNumber(textId: string) {
  const match = textId.match(/\d+/);
  return match ? Number(match[0]) : 0;
}
