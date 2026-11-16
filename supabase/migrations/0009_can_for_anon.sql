-- Fix for 0008: the catalogue write policies are "for all", so Postgres also
-- evaluates them on reads, including the storefront's signed-out reads. can()
-- must therefore be callable by anon (it simply returns false for them).
grant execute on function public.can(text) to anon;
