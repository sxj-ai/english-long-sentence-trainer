"use client";

import { useEffect, useState } from "react";
import type { Article, Sentence } from "@/features/article/articleTypes";

export function SentenceBookmarkButton({ article, sentence }: { article: Article; sentence: Sentence }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBookmarkState() {
      try {
        const params = new URLSearchParams({
          articleId: article.id,
          sentenceId: sentence.sentenceId
        });
        const response = await fetch(`/api/student/bookmarks/?${params.toString()}`);
        if (!response.ok) return;

        const data = (await response.json()) as { bookmarked?: boolean };
        if (!cancelled) {
          setBookmarked(Boolean(data.bookmarked));
        }
      } catch {
        // Keep the button usable for visitors who are not logged in.
      }
    }

    setMessage("");
    setBookmarked(false);
    void loadBookmarkState();

    return () => {
      cancelled = true;
    };
  }, [article.id, sentence.sentenceId]);

  async function toggleBookmark() {
    if (isLoading) return;

    setIsLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        articleId: article.id,
        sentenceId: sentence.sentenceId
      });
      const response = await fetch(bookmarked ? `/api/student/bookmarks/?${params.toString()}` : "/api/student/bookmarks/", {
        method: bookmarked ? "DELETE" : "POST",
        headers: bookmarked
          ? undefined
          : {
              "Content-Type": "application/json"
            },
        body: bookmarked
          ? undefined
          : JSON.stringify({
              articleId: article.id,
              articleTitle: article.title,
              sentenceId: sentence.sentenceId,
              sentenceText: sentence.original,
              translationLiteral: sentence.translationLiteral,
              difficulty: sentence.difficulty
            })
      });
      const data = (await response.json().catch(() => ({}))) as { bookmarked?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "收藏失败。");
      }

      setBookmarked(Boolean(data.bookmarked));
      setMessage(data.bookmarked ? "已加入今日复习" : "已取消收藏");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "收藏失败。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bookmark-action">
      <button className="secondary-link button-like" disabled={isLoading} onClick={toggleBookmark} type="button">
        {isLoading ? "处理中..." : bookmarked ? "取消收藏" : "收藏句子"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}
