"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MarkdownBlock } from "@/components/common/MarkdownBlock";
import type { Article, Sentence } from "@/features/article/articleTypes";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

type AiAccess = "student" | "anonymous" | "other";

interface SentenceAiTutorProps {
  aiAccess: AiAccess;
  article: Article;
  sentence?: Sentence;
  onShowSentences: () => void;
}

export function SentenceAiTutor({ aiAccess, article, sentence, onShowSentences }: SentenceAiTutorProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const canUseAi = aiAccess === "student";
  const loginRedirectTo = sentence
    ? `/articles/${article.id}?ai=1&sentenceId=${encodeURIComponent(sentence.sentenceId)}`
    : `/articles/${article.id}?ai=1`;
  const loginHref = `/login?redirectTo=${encodeURIComponent(loginRedirectTo)}`;

  useEffect(() => {
    setMessages([]);
    setQuestion("");
    setError("");
    abortControllerRef.current?.abort();

    if (!sentence || !canUseAi) return;

    const controller = new AbortController();
    setIsLoadingHistory(true);

    fetch(`/api/ai/sentence-chat/?articleId=${encodeURIComponent(article.id)}&sentenceId=${encodeURIComponent(sentence.sentenceId)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          conversations?: Array<{
            question?: string;
            answer?: string;
            createdAt?: string;
          }>;
        };
      })
      .then((data) => {
        if (!data?.conversations) return;
        const historyMessages = data.conversations.flatMap((item): ChatMessage[] => [
          {
            role: "user",
            content: String(item.question || ""),
            createdAt: item.createdAt
          },
          {
            role: "assistant",
            content: String(item.answer || ""),
            createdAt: item.createdAt
          }
        ]);
        setMessages(historyMessages.filter((message) => message.content.trim()));
      })
      .catch((caughtError) => {
        if (caughtError instanceof Error && caughtError.name === "AbortError") return;
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [article.id, canUseAi, sentence]);

  async function askAi() {
    if (isLoading || !sentence || !canUseAi) return;

    setError("");
    const nextQuestion = question.trim() || "请按考研长难句学习方法讲解这个句子。";
    const historyForApi = messages.slice(-8);
    const assistantIndex = messages.length + 1;
    const pendingMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content: nextQuestion
      },
      {
        role: "assistant",
        content: ""
      }
    ];

    setMessages(pendingMessages);
    setIsLoading(true);
    setQuestion("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/ai/sentence-chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          sentence: sentence.original,
          question: nextQuestion,
          mode: "考研解析",
          history: historyForApi,
          context: {
            articleId: article.id,
            sentenceId: sentence.sentenceId,
            translationLiteral: sentence.translationLiteral,
            chunks: sentence.chunks,
            keyWords: sentence.keyWords,
            keyPhrases: sentence.keyPhrases
          }
        })
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "AI 老师暂时没有返回。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          const parsed = JSON.parse(payload) as { delta?: string; message?: string };
          if (parsed.delta) {
            setMessages((current) =>
              current.map((message, index) =>
                index === assistantIndex ? { ...message, content: message.content + parsed.delta } : message
              )
            );
          } else if (parsed.message) {
            throw new Error(parsed.message);
          }
        }
      }
    } catch (caughtError) {
      if (controller.signal.aborted || (caughtError instanceof Error && caughtError.name === "AbortError")) {
        setMessages((current) =>
          current.map((message, index) =>
            index === assistantIndex && !message.content.trim() ? { ...message, content: "已停止输出。" } : message
          )
        );
        return;
      }
      setError(caughtError instanceof Error ? caughtError.message : "AI 老师回答失败，请稍后再试。");
      setMessages((current) => current.filter((message) => message.content.trim()));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  }

  function stopAi() {
    abortControllerRef.current?.abort();
  }

  return (
    <aside className="reader-panel ai-chat-panel">
      <div className="ai-chat-toolbar">
        <span>AI 老师</span>
        <button className="secondary-link button-like ai-switch-button" onClick={onShowSentences} type="button">
          打开真题句子
        </button>
      </div>

      <div className="ai-chat-history" aria-live="polite">
        {isLoadingHistory ? (
          <div className="empty-state">正在读取历史对话...</div>
        ) : messages.length ? (
          messages.map((message, index) => (
            <div className={`ai-chat-message is-${message.role}`} key={`${message.role}-${index}`}>
              <div className="ai-chat-role">{message.role === "user" ? "我" : "AI 老师"}</div>
              {message.role === "assistant" ? (
                message.content ? (
                  <MarkdownBlock content={message.content} />
                ) : (
                  <p>正在思考...</p>
                )
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          ))
        ) : (
          canUseAi ? (
            <div className="empty-state">
              {sentence ? "可以连续追问主干、从句、修饰关系、词义和翻译，历史回答会保留在这里。" : "先打开真题句子，选择一个句子。"}
            </div>
          ) : null
        )}
      </div>

      <div className="ai-chat-compose">
        <textarea
          aria-label="向 AI 老师提问"
          disabled={isLoading || !sentence || !canUseAi}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              void askAi();
            }
          }}
          placeholder={canUseAi ? "例如：这句话的主干是什么？which 从句修饰谁？为什么这里不能直译？" : "请先登录学生账号后提问"}
          value={question}
        />
        <div className="ai-tutor-actions">
          {canUseAi ? (
            <button className="primary-link button-like" disabled={isLoading || !sentence} onClick={askAi} type="button">
            发送
            </button>
          ) : aiAccess === "anonymous" ? (
            <Link className="primary-link" href={loginHref}>
              登录后提问
            </Link>
          ) : (
            <button className="secondary-link button-like" disabled type="button">
              学生账号可提问
            </button>
          )}
          {isLoading ? (
            <button className="secondary-link button-like stop-output-button" onClick={stopAi} type="button">
              停止输出
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="form-alert">{error}</div> : null}
    </aside>
  );
}
