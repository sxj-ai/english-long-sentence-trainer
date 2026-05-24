import { checkAnswer } from "@/features/practice/answerChecker";
import type { PracticeItem } from "@/features/practice/practiceTypes";

interface PracticeCardProps {
  item: PracticeItem;
  index: number;
  selectedAnswer?: string;
  onAnswer: (answer: string) => void;
}

export function PracticeCard({ item, index, selectedAnswer, onAnswer }: PracticeCardProps) {
  const answered = Boolean(selectedAnswer);
  const correct = checkAnswer(selectedAnswer ?? null, item.answer);

  return (
    <article className={`practice-card ${answered ? (correct ? "is-correct" : "is-wrong") : ""}`}>
      <div className="practice-question">
        <span>{index}</span>
        <div>
          <p>{item.prompt}</p>
          <small>{item.sentenceId}</small>
        </div>
      </div>

      <div className="option-grid">
        {item.options.map((option) => (
          <button
            className={`option-button ${selectedAnswer === option ? "is-selected" : ""}`}
            key={option}
            onClick={() => onAnswer(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>

      {answered ? (
        <div className="answer-note">
          <strong>{correct ? "回答正确" : `正确答案：${item.answer}`}</strong>
          <p>{item.explanation}</p>
        </div>
      ) : null}
    </article>
  );
}
