import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id, is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_admin) {
    redirect("/admin");
  }

  if (!profile?.couple_id) {
    redirect("/couple-setup");
  }

  redirect("/repas");
}
