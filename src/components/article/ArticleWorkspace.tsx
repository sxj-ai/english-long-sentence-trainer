"use client";

import { useMemo, useRef, useState } from "react";
import type { Article, Sentence } from "@/features/article/articleTypes";
import { ArticleReader } from "./ArticleReader";
import { SentenceAiTutor } from "./SentenceAiTutor";
import { SentenceDetailPanel } from "./SentenceDetailPanel";

type SideMode = "sentences" | "ai";
type AiAccess = "student" | "anonymous" | "other";

interface ArticleWorkspaceProps {
  aiAccess: AiAccess;
  article: Article;
  initialSentenceId?: string;
  initialSideMode?: SideMode;
}

export function ArticleWorkspace({ aiAccess, article, initialSentenceId, initialSideMode = "sentences" }: ArticleWorkspaceProps) {
  const fallbackSentenceId = article.sentences[0]?.sentenceId;
  const initialSelectedSentenceId = article.sentences.some((sentence) => sentence.sentenceId === initialSentenceId)
    ? initialSentenceId
    : fallbackSentenceId;
  const [selectedSentenceId, setSelectedSentenceId] = useState(initialSelectedSentenceId);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [sideMode, setSideMode] = useState<SideMode>(initialSideMode);
  const [leftWidth, setLeftWidth] = useState(32);
  const layoutRef = useRef<HTMLElement | null>(null);

  const selectedSentence = useMemo<Sentence | undefined>(
    () => article.sentences.find((sentence) => sentence.sentenceId === selectedSentenceId),
    [article.sentences, selectedSentenceId]
  );

  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const layout = layoutRef.current;
    if (!layout) return;

    const rect = layout.getBoundingClientRect();
    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(Math.max(nextWidth, 20), 56));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <section
      className="learning-layout"
      ref={layoutRef}
      style={{ gridTemplateColumns: `minmax(260px, ${leftWidth}%) 12px minmax(520px, 1fr)` }}
    >
      <div className="workspace-side-slot">
        <div hidden={sideMode !== "sentences"}>
          <ArticleReader
            article={article}
            selectedSentenceId={selectedSentenceId}
            onAskAi={() => setSideMode("ai")}
            onSelectSentence={(sentenceId) => {
              setSelectedSentenceId(sentenceId);
              setSelectedChunkId(null);
            }}
          />
        </div>
        <div hidden={sideMode !== "ai"}>
          <SentenceAiTutor
            aiAccess={aiAccess}
            article={article}
            onShowSentences={() => setSideMode("sentences")}
            sentence={selectedSentence}
          />
        </div>
      </div>
      <button
        aria-label="拖动调整左右区域宽度"
        className="pane-resizer"
        onDoubleClick={() => setLeftWidth(32)}
        onPointerDown={startResize}
        title="拖动调整宽度，双击恢复默认"
        type="button"
      />
      <SentenceDetailPanel
        article={article}
        sentence={selectedSentence}
        selectedChunkId={selectedChunkId}
        onAskAi={() => setSideMode("ai")}
        onSelectChunk={setSelectedChunkId}
      />
    </section>
  );
}
