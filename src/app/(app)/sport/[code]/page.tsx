import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionPlayer } from "@/components/sport/SessionPlayer";
import type {
  Exercise,
  ExerciseVariant,
  SessionCode,
  WorkoutSessionType,
} from "@/lib/types/database";

const VALID_CODES: SessionCode[] = ["A", "B", "C"];

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase() as SessionCode;
  if (!VALID_CODES.includes(code)) notFound();

  const { variant: variantParam } = await searchParams;
  const variant: ExerciseVariant =
    variantParam === "avec_halteres" ? "avec_halteres" : "sans_halteres";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionType } = await supabase
    .from("workout_session_types")
    .select("*")
    .eq("code", code)
    .single<WorkoutSessionType>();
  if (!sessionType) notFound();

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .eq("session_code", code)
    .eq("variant", variant)
    .order("sort_order")
    .returns<Exercise[]>();

  async function finishSession() {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    await supabase.from("workout_logs").insert({
      user_id: user.id,
      session_code: code,
      variant,
    });

    redirect("/sport?termine=1");
  }

  return (
    <div className="p-4 md:p-6">
      <Link href="/sport" className="text-sm text-muted hover:text-primary">
        ← Retour aux séances
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-gradient font-heading text-3xl">
            Séance {sessionType.code}
          </h1>
          <p className="text-sm text-muted">{sessionType.focus}</p>
        </div>
        <div className="glass-card inline-flex gap-1 p-1">
          <Link
            href={`/sport/${code}?variant=sans_halteres`}
            className="chip"
            data-active={variant === "sans_halteres"}
          >
            Sans haltères
          </Link>
          <Link
            href={`/sport/${code}?variant=avec_halteres`}
            className="chip"
            data-active={variant === "avec_halteres"}
          >
            Avec haltères
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <SessionPlayer exercises={exercises ?? []} />
      </div>

      <form action={finishSession} className="fixed bottom-20 left-0 right-0 z-10 flex justify-center px-4 md:bottom-6">
        <button type="submit" className="btn-primary w-full max-w-sm">
          Terminer la séance
        </button>
      </form>
    </div>
  );
}
