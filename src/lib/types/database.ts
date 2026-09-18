export type Sex = "homme" | "femme";

export interface Profile {
  id: string;
  first_name: string;
  sex: Sex;
  birth_date: string;
  height_cm: number;
  couple_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export type MealType = "petit_dejeuner" | "dejeuner" | "diner" | "collation";

export interface FavoriteFood {
  id: string;
  user_id: string;
  name: string;
  default_quantity: string | null;
  default_calories: number | null;
  created_at: string;
}

export interface CommonFood {
  id: string;
  name: string;
  default_quantity: string | null;
  default_calories: number | null;
  sort_order: number;
}

export interface MealEntry {
  id: string;
  user_id: string;
  entry_date: string;
  meal_type: MealType;
  name: string;
  quantity: string | null;
  calories: number | null;
  position: number;
  created_at: string;
}

export type MeasurementCode =
  | "poitrine"
  | "pectoraux"
  | "taille"
  | "hanches"
  | "cuisses"
  | "mollets"
  | "bras";

export interface MeasurementType {
  code: MeasurementCode;
  label_fr: string;
  applies_to: Sex | "tous";
  lower_is_better: boolean;
  sort_order: number;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  measurement_type: MeasurementCode;
  measured_on: string;
  value_cm: number;
  created_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  measured_on: string;
  weight_kg: number;
  iso_year: number;
  iso_week: number;
  created_at: string;
  updated_at: string;
}

export type ExerciseVariant = "sans_halteres" | "avec_halteres";
export type SessionCode = "A" | "B" | "C";

export interface WorkoutSessionType {
  code: SessionCode;
  name: string;
  focus: string;
  sort_order: number;
}

export interface Exercise {
  id: string;
  session_code: SessionCode;
  exercise_group: string;
  variant: ExerciseVariant;
  name: string;
  target_muscles: string;
  sets: number;
  reps: string | null;
  duration_seconds: number | null;
  rest_seconds: number;
  description: string;
  sort_order: number;
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  session_code: SessionCode;
  variant: ExerciseVariant;
  performed_on: string;
  created_at: string;
}
