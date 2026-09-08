import type { SupabaseClient } from "@supabase/supabase-js";

/** Finds a caller by phone number, creating a bare record if none exists yet. Returns null if no phone is known. */
export async function findOrCreateCaller(
  supabase: SupabaseClient,
  phone: string | null
): Promise<string | null> {
  if (!phone) return null;

  const { data: existing, error: findError } = await supabase
    .from("callers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data: created, error: insertError } = await supabase
    .from("callers")
    .insert({ phone })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return created.id as string;
}
