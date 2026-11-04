/** Types shared by the game actions and the game components (no secrets: no answers before answering). */
import type { GameMode, GamePublic } from "@edukemonos/curriculum";

export interface GamePieceView {
  id: string;
  kind: "game_pairs" | "game_order" | "game_fill" | "game_find_error" | "single_choice";
  stem: string;
  options: string[] | null;
  game_public: GamePublic | null;
  reviewed: boolean;
}

export interface GameRunView {
  run: string;
  mode: GameMode;
  /** Ghost race: the rival's answers question by question; null the first time with no classmate. */
  rival: { kind: "self" | "peer"; pattern: boolean[] } | null;
  pieces: GamePieceView[];
}

export interface PieceFeedback {
  is_correct: boolean;
  explanation: string | null;
  correct_index: number | null;
  game_answer: { mechanic: string; match?: number[]; order?: number[]; index?: number; correction?: string } | null;
}

export interface GameResult {
  correct: number;
  total: number;
  pattern: boolean[];
  rival: GameRunView["rival"];
  best_before: number | null;
  new_record: boolean;
}
