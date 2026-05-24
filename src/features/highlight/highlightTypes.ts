export type MatchConfidence = "exact" | "normalized" | "failed";

export interface ChunkPosition {
  chunkId: string;
  start: number;
  end: number;
  confidence: MatchConfidence;
}
