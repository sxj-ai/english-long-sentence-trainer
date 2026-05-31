"use client";

import { useMemo, useState } from "react";

type AnalysisView = {
  id?: string;
  createdAt?: string | Date;
  summary: string;
  evidence?: unknown;
  ability?: unknown;
  suggestions?: unknown;
  nextActions?: unknown;
  triggerSource?: string;
};

interface StudentAiAnalysisPanelProps {
  studentId?: string;
  title?: string;
  description?: string;
  initialAnalysis?: AnalysisView | null;
}

function toList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
}

function evidenceToList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return String(item);
      const record = item as Record<string, unknown>;
      return [record.observation, record.basis, record.example].filter(Boolean).map(String).join("｜");
    })
    .filter(Boolean)
    .slice(0, 6);
}

function abilityToList(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}：${typeof item === "string" ? item : JSON.stringify(item)}`)
    .slice(0, 8);
}

function formatDate(value?: string | Date) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function StudentAiAnalysisPanel({
  studentId,
  title = "AI 学习分析",
  description = "根据你的 AI 问答、考试和批改记录生成具体诊断。",
  initialAnalysis
}: StudentAiAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<AnalysisView | null>(initialAnalysis || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const evidence = useMemo(() => evidenceToList(analysis?.evidence), [analysis]);
  const ability = useMemo(() => abilityToList(analysis?.ability), [analysis]);
  const suggestions = useMemo(() => toList(analysis?.suggestions), [analysis]);
  const nextActions = useMemo(() => toList(analysis?.nextActions), [analysis]);

  async function generateAnalysis() {
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai/student-analysis/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          studentId
        })
      });
      const data = (await response.json()) as { analysis?: AnalysisView; error?: string };

      if (!response.ok || !data.analysis) {
        throw new Error(data.error || "AI 学习分析生成失败。");
      }

      setAnalysis(data.analysis);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "AI 学习分析生成失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="ai-analysis-panel">
      <div className="section-heading-row">
        <div>
          <h3>{title}</h3>
          <small>{description}</small>
        </div>
        <button className="primary-link button-like" disabled={isLoading} onClick={generateAnalysis} type="button">
          {isLoading ? "分析中..." : "生成分析"}
        </button>
      </div>

      {error ? <div className="form-alert">{error}</div> : null}

      {analysis ? (
        <div className="ai-analysis-content">
          <div>
            <span>最近生成</span>
            <strong>{formatDate(analysis.createdAt) || "刚刚"}</strong>
          </div>
          <p>{analysis.summary}</p>

          {evidence.length > 0 ? (
            <section>
              <h4>具体依据</h4>
              <ul>
                {evidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {ability.length > 0 ? (
            <section>
              <h4>能力判断</h4>
              <ul>
                {ability.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {suggestions.length > 0 ? (
            <section>
              <h4>学习建议</h4>
              <ul>
                {suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {nextActions.length > 0 ? (
            <section>
              <h4>下一步任务</h4>
              <ul>
                {nextActions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">还没有 AI 学习分析。先问几个句子或完成练习，再点击生成分析。</div>
      )}
    </div>
  );
}
