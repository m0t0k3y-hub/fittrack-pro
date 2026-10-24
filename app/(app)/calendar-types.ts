export type WorkoutStatus = "planned" | "done";

export type WorkoutSetRow = {
  exercise_id: string;
  set_order: number;
  weight_kg: number;
  reps: number;
  is_done: boolean;
  exercises: { name: string } | null;
};

export type WorkoutLogRow = {
  id: string;
  date: string;
  status: WorkoutStatus;
  memo: string | null;
  workout_sets: WorkoutSetRow[];
};

export type BodyMetricRow = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};
