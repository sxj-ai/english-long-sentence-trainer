export function formatDifficulty(value: number) {
  return "★".repeat(value) + "☆".repeat(Math.max(0, 5 - value));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
