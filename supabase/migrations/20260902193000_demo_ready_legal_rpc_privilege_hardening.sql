-- Tighten user-specific legal RPC execution privileges.
-- These functions already fail closed on auth.uid(), but anonymous callers do not need EXECUTE.

revoke all on function public.get_my_legal_acceptance_state() from public, anon, service_role;
revoke all on function public.accept_my_legal_documents(boolean, boolean) from public, anon, service_role;

grant execute on function public.get_my_legal_acceptance_state() to authenticated;
grant execute on function public.accept_my_legal_documents(boolean, boolean) to authenticated;
