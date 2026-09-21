import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const userId = data?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  redirect(profile ? "/home" : "/profile/setup");
}
