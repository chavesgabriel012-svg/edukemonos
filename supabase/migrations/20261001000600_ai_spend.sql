-- Spend fuse support: total estimated AI spend since a given instant.
-- Read by the server (service_role) before every AI call; see packages/ai/src/budget.ts.
-- Rows with a null cost (model without a configured price) are counted separately so the
-- admin panel can flag that the fuse is blind to them.
create function public.ai_spend_usd_since(p_since timestamptz)
returns table (spent_usd numeric, unpriced_calls bigint)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce(sum(u.cost_usd_estimate), 0),
    count(*) filter (where u.success and u.cost_usd_estimate is null)
  from public.ai_usage u
  where u.created_at >= p_since
$$;

revoke execute on function public.ai_spend_usd_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_spend_usd_since(timestamptz) to service_role;
