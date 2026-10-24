import type { WorkoutStatus } from "../calendar-types";

export const MUSCLE_LABELS: Record<string, string> = {
  chest: "胸",
  back: "背中",
  legs: "脚",
  shoulders: "肩",
  arms: "腕",
  abs: "腹",
  other: "その他",
};

export type ExerciseOption = {
  id: string;
  name: string;
  target_muscle: string;
  archived: boolean;
};

export type SetInit = { weight: number; reps: number; isDone: boolean };
export type ExerciseBlockInit = { exerciseId: string; sets: SetInit[] };

export type WorkoutInit = {
  id: string | null;
  date: string;
  status: WorkoutStatus;
  memo: string;
  exercises: ExerciseBlockInit[];
};

// 種目ごとの「前回の重量目安」(直近の実績ログの最終セット)
export type SetHints = Record<string, { weight: number; reps: number; date: string }>;

export type RecentLog = { id: string; date: string; exerciseNames: string[] };
