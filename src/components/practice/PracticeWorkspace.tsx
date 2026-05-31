"use client";

import { useMemo, useState } from "react";
import type { Article } from "@/features/article/articleTypes";
import type { PrecisionPracticeItem } from "@/features/practice/precisionPracticeTypes";

type AiTaskGrading = {
  score: number;
  maxScore: number;
  isAcceptable: boolean;
  strengths: string[];
  problems: string[];
  correctedAnswer: string;
  explanation: string;
};

interface PracticeWorkspaceProps {
  article: Article;
  items: PrecisionPracticeItem[];
}

export function PracticeWorkspace({ article, items }: PracticeWorkspaceProps) {
  const [taskAnswers, setTaskAnswers] = useState<Record<string, string>>({});
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [gradingResults, setGradingResults] = useState<Record<string, AiTaskGrading>>({});
  const [gradingErrors, setGradingErrors] = useState<Record<string, string>>({});
  const [gradingLoading, setGradingLoading] = useState<Record<string, boolean>>({});

  const result = useMemo(() => {
    const choices = items.flatMap((item) => item.diagnosticChoices);
    const answeredChoices = choices.filter((choice) => choiceAnswers[choice.choiceId]).length;
    const correctChoices = choices.filter((choice) => {
      const answer = choiceAnswers[choice.choiceId];
      return choice.options.some((option) => option.text === answer && option.isCorrect);
    }).length;
    const tasks = items.flatMap((item) => item.subjectiveTasks);
    const answeredTasks = tasks.filter((task) => taskAnswers[task.taskId]?.trim()).length;

    return { answeredChoices, correctChoices, answeredTasks, totalChoices: choices.length, totalTasks: tasks.length };
  }, [choiceAnswers, items, taskAnswers]);

  return (
    <section className="practice-layout precision-practice-layout">
      <div className="practice-header">
        <div>
          <p className="eyebrow">精分析检测</p>
          <h1>{article.title}</h1>
          <p>当前先用文章 JSON 自动生成检测框架；独立检测题库接入后，会替换为人工设计的高质量题目。</p>
        </div>
        <div className="score-box">
          <strong>{result.correctChoices}/{result.answeredChoices}</strong>
          <span>诊断题正确 / 主观题已填 {result.answeredTasks}</span>
        </div>
      </div>

      <div className="practice-summary-strip">
        <span>{items.length} 个句子</span>
        <span>{result.totalTasks} 个主观任务</span>
        <span>{result.totalChoices} 道诊断陷阱题</span>
      </div>

      <div className="precision-list">
        {items.map((item, index) => (
          <PrecisionPracticeCard
            choiceAnswers={choiceAnswers}
            index={index + 1}
            item={item}
            key={item.practiceId}
            onChoiceAnswer={(choiceId, answer) =>
              setChoiceAnswers((current) => ({
                ...current,
                [choiceId]: answer
              }))
            }
            onReveal={() =>
              setRevealed((current) => ({
                ...current,
                [item.practiceId]: !current[item.practiceId]
              }))
            }
            onTaskGrade={async (taskId) => {
              const answer = taskAnswers[taskId]?.trim();

              if (!answer) {
                setGradingErrors((current) => ({
                  ...current,
                  [taskId]: "请先写下自己的分析，再让 AI 批改。"
                }));
                return;
              }

              setGradingLoading((current) => ({
                ...current,
                [taskId]: true
              }));
              setGradingErrors((current) => ({
                ...current,
                [taskId]: ""
              }));

              try {
                const response = await fetch("/api/ai/precision-grade/", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    articleId: article.id,
                    practiceId: item.practiceId,
                    taskId,
                    studentAnswer: answer
                  })
                });
                const data = (await response.json()) as { result?: AiTaskGrading; error?: string };

                if (!response.ok || !data.result) {
                  throw new Error(data.error || "AI 批改失败。");
                }

                setGradingResults((current) => ({
                  ...current,
                  [taskId]: data.result as AiTaskGrading
                }));
              } catch (error) {
                setGradingErrors((current) => ({
                  ...current,
                  [taskId]: error instanceof Error ? error.message : "AI 批改失败。"
                }));
              } finally {
                setGradingLoading((current) => ({
                  ...current,
                  [taskId]: false
                }));
              }
            }}
            onTaskAnswer={(taskId, answer) =>
              setTaskAnswers((current) => ({
                ...current,
                [taskId]: answer
              }))
            }
            revealed={Boolean(revealed[item.practiceId])}
            taskAnswers={taskAnswers}
            taskGradingErrors={gradingErrors}
            taskGradingLoading={gradingLoading}
            taskGradingResults={gradingResults}
          />
        ))}
      </div>
    </section>
  );
}

interface PrecisionPracticeCardProps {
  item: PrecisionPracticeItem;
  index: number;
  taskAnswers: Record<string, string>;
  choiceAnswers: Record<string, string>;
  revealed: boolean;
  onTaskAnswer: (taskId: string, answer: string) => void;
  onTaskGrade: (taskId: string) => void;
  onChoiceAnswer: (choiceId: string, answer: string) => void;
  onReveal: () => void;
  taskGradingResults: Record<string, AiTaskGrading>;
  taskGradingErrors: Record<string, string>;
  taskGradingLoading: Record<string, boolean>;
}

function PrecisionPracticeCard({
  item,
  index,
  taskAnswers,
  choiceAnswers,
  revealed,
  onTaskAnswer,
  onTaskGrade,
  onChoiceAnswer,
  onReveal,
  taskGradingResults,
  taskGradingErrors,
  taskGradingLoading
}: PrecisionPracticeCardProps) {
  return (
    <article className="precision-card">
      <div className="precision-card-header">
        <div>
          <p className="eyebrow">第 {index} 句 · {item.sourceSentenceId}</p>
          <h2>{item.sourceSnapshot.original}</h2>
        </div>
        <span className="difficulty-pill">难度 {item.difficulty}</span>
      </div>

      <div className="focus-row">
        {item.focusTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>

      <p className="why-key">{item.whyKey}</p>

      <div className="precision-section">
        <div className="section-heading-row">
          <h3>诊断陷阱题</h3>
          <small>少量选择题，只测真实易错点</small>
        </div>
        <div className="diagnostic-grid">
          {item.diagnosticChoices.map((choice) => {
            const selected = choiceAnswers[choice.choiceId];
            const selectedOption = choice.options.find((option) => option.text === selected);

            return (
              <div className="diagnostic-card" key={choice.choiceId}>
                <p>{choice.prompt}</p>
                <div className="option-grid">
                  {choice.options.map((option) => (
                    <button
                      className={`option-button ${selected === option.text ? "is-selected" : ""}`}
                      key={option.label}
                      onClick={() => onChoiceAnswer(choice.choiceId, option.text)}
                      type="button"
                    >
                      <strong>{option.label}.</strong> {option.text}
                    </button>
                  ))}
                </div>
                {selectedOption ? (
                  <div className={`answer-note ${selectedOption.isCorrect ? "is-correct-note" : "is-wrong-note"}`}>
                    <strong>{selectedOption.isCorrect ? "诊断正确" : "这个选项暴露了一个易错点"}</strong>
                    <p>{selectedOption.isCorrect ? choice.explanation : selectedOption.trapReason}</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="precision-section">
        <div className="section-heading-row">
          <h3>主观精分析</h3>
          <small>先作答，最后再对照标准答案</small>
        </div>
        <div className="task-list">
          {item.subjectiveTasks.map((task) => {
            const gradingResult = taskGradingResults[task.taskId];
            const gradingError = taskGradingErrors[task.taskId];
            const isGrading = taskGradingLoading[task.taskId];

            return (
              <div className="subjective-task" key={task.taskId}>
                <label>
                  <span>
                    {task.prompt}
                    <small>{task.inputHint}</small>
                  </span>
                  <textarea
                    onChange={(event) => onTaskAnswer(task.taskId, event.target.value)}
                    placeholder="在这里写你的分析..."
                    value={taskAnswers[task.taskId] ?? ""}
                  />
                </label>
                <div className="subjective-task-actions">
                  <button className="secondary-link button-like" disabled={isGrading} onClick={() => onTaskGrade(task.taskId)} type="button">
                    {isGrading ? "AI 批改中..." : "AI 批改"}
                  </button>
                  <span>{task.score} 分</span>
                </div>
                {gradingError ? <div className="form-alert">{gradingError}</div> : null}
                {gradingResult ? <AiTaskGradingPanel result={gradingResult} /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="precision-actions">
        <button className="primary-link button-like" onClick={onReveal} type="button">
          {revealed ? "收起标准答案" : "对照标准答案"}
        </button>
      </div>

      {revealed ? <AnswerKeyPanel item={item} /> : null}
    </article>
  );
}

function AiTaskGradingPanel({ result }: { result: AiTaskGrading }) {
  return (
    <div className={`ai-grading-panel ${result.isAcceptable ? "is-correct-note" : "is-wrong-note"}`}>
      <div>
        <strong>
          AI 评分：{result.score}/{result.maxScore}
        </strong>
        <span>{result.isAcceptable ? "基本达标" : "需要重练"}</span>
      </div>
      {result.strengths.length > 0 ? (
        <section>
          <h4>做得好的地方</h4>
          <ul>
            {result.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {result.problems.length > 0 ? (
        <section>
          <h4>需要修改的地方</h4>
          <ul>
            {result.problems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {result.correctedAnswer ? (
        <section>
          <h4>参考改法</h4>
          <p>{result.correctedAnswer}</p>
        </section>
      ) : null}
      <section>
        <h4>解释</h4>
        <p>{result.explanation}</p>
      </section>
    </div>
  );
}

function AnswerKeyPanel({ item }: { item: PrecisionPracticeItem }) {
  const { answerKey } = item;

  return (
    <div className="answer-key-panel">
      <div>
        <h3>主干标准</h3>
        <dl className="answer-dl">
          {answerKey.mainStructure.subject ? (
            <>
              <dt>主语</dt>
              <dd>{answerKey.mainStructure.subject}</dd>
            </>
          ) : null}
          {answerKey.mainStructure.predicate ? (
            <>
              <dt>谓语</dt>
              <dd>{answerKey.mainStructure.predicate}</dd>
            </>
          ) : null}
          {answerKey.mainStructure.object ? (
            <>
              <dt>宾语</dt>
              <dd>{answerKey.mainStructure.object}</dd>
            </>
          ) : null}
          {answerKey.mainStructure.predicative ? (
            <>
              <dt>表语</dt>
              <dd>{answerKey.mainStructure.predicative}</dd>
            </>
          ) : null}
          {answerKey.mainStructure.complement ? (
            <>
              <dt>补语</dt>
              <dd>{answerKey.mainStructure.complement}</dd>
            </>
          ) : null}
          {answerKey.mainStructure.realSubject ? (
            <>
              <dt>真正主语</dt>
              <dd>{answerKey.mainStructure.realSubject}</dd>
            </>
          ) : null}
          {answerKey.mainStructure.adverbial ? (
            <>
              <dt>状语</dt>
              <dd>{answerKey.mainStructure.adverbial}</dd>
            </>
          ) : null}
        </dl>
        <p>{answerKey.mainStructure.note}</p>
      </div>

      <div>
        <h3>标准切分</h3>
        <p className="cut-line">{answerKey.standardCuts.join(" / ")}</p>
      </div>

      <div>
        <h3>语法成分</h3>
        <ul className="answer-list">
          {answerKey.grammarAnalysis.map((point) => (
            <li key={`${point.text}-${point.role}`}>
              <strong>{point.text}</strong>
              <span>{point.role}{point.target ? `，指向：${point.target}` : ""}</span>
              <small>{point.explanation}</small>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>重点语言</h3>
        <ul className="answer-list">
          {answerKey.keyLanguage.map((point) => (
            <li key={`${point.text}-${point.role}`}>
              <strong>{point.text}</strong>
              <span>{point.role}</span>
              <small>{point.explanation}</small>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>结构直译</h3>
        <p>{answerKey.translation.literal}</p>
      </div>

      <div>
        <h3>常见错误</h3>
        <ul className="answer-list">
          {item.commonErrors.map((error) => (
            <li key={error.errorTag}>
              <strong>{error.description}</strong>
              <span>{error.diagnosis}</span>
              <small>{error.remediation}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
