import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ixocecrvriaprwynhnst.supabase.co";
export const supabaseUrl = url;
// The publishable key is public; access is restricted by Supabase Auth and RLS.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_AS3RphAZQVJno1NspjsBWw_o0TROhFj";

export const supabase = url && key ? createClient(url, key) : null;
