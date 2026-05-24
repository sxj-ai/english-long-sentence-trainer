export interface LocalProgress {
  articleId: string;
  selectedSentenceId?: string;
  completedPracticeIds: string[];
}

const KEY = "long-sentence-trainer-progress";

export function readLocalProgress(): LocalProgress[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalProgress[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalProgress(progress: LocalProgress[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(KEY, JSON.stringify(progress));
}
