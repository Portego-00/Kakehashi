-- Reduce full-history scans in the local admin analytics dashboard.
-- Preaggregate sessions per Madrid day and user, then retain exact distinct
-- user counts for each daily, weekly and monthly period.
-- Validated against the previous RPC in one snapshot: 298 rows, no differences.
CREATE OR REPLACE FUNCTION public.get_analytics()
 RETURNS TABLE(period_type text, period_start date, sessions bigint, active_users bigint, app_rate_clicks bigint, rate_settings bigint, rate_tip_developer bigint, rate_streak bigint, tips_total bigint, tips_small bigint, tips_medium bigint, tips_large bigint, tips_xlarge bigint)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
WITH session_days_by_user AS MATERIALIZED (
  SELECT (session_started_at AT TIME ZONE 'Europe/Madrid')::date AS day,
         user_id, COUNT(*) AS sessions
  FROM public.app_sessions
  GROUP BY 1, 2
), session_keys AS (
  SELECT day, DATE_TRUNC('week', day)::date AS week,
         DATE_TRUNC('month', day)::date AS month, user_id, sessions
  FROM session_days_by_user
), sessions AS (
  SELECT CASE WHEN GROUPING(day) = 0 THEN 'daily'
              WHEN GROUPING(week) = 0 THEN 'weekly' ELSE 'monthly' END AS period_type,
         COALESCE(day, week, month) AS period_start,
         SUM(sessions)::bigint AS sessions,
         COUNT(DISTINCT user_id) AS active_users
  FROM session_keys
  GROUP BY GROUPING SETS ((day), (week), (month))
), rate_keys AS (
  SELECT (created_at AT TIME ZONE 'Europe/Madrid')::date AS day,
         DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Madrid')::date AS week,
         DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Madrid')::date AS month,
         LOWER(source) AS source
  FROM public.rate_app_clicks
), rate_agg AS (
  SELECT CASE WHEN GROUPING(day) = 0 THEN 'daily'
              WHEN GROUPING(week) = 0 THEN 'weekly' ELSE 'monthly' END AS period_type,
         COALESCE(day, week, month) AS period_start,
         COUNT(*) AS app_rate_clicks,
         COUNT(*) FILTER (WHERE source = 'settings') AS rate_settings,
         COUNT(*) FILTER (WHERE source = 'tip-developer') AS rate_tip_developer,
         COUNT(*) FILTER (WHERE source = 'streak') AS rate_streak
  FROM rate_keys
  GROUP BY GROUPING SETS ((day), (week), (month))
), tip_keys AS (
  SELECT (created_at AT TIME ZONE 'Europe/Madrid')::date AS day,
         DATE_TRUNC('week', created_at AT TIME ZONE 'Europe/Madrid')::date AS week,
         DATE_TRUNC('month', created_at AT TIME ZONE 'Europe/Madrid')::date AS month,
         LOWER(tip_type) AS tip_type
  FROM public.tips
), tip_agg AS (
  SELECT CASE WHEN GROUPING(day) = 0 THEN 'daily'
              WHEN GROUPING(week) = 0 THEN 'weekly' ELSE 'monthly' END AS period_type,
         COALESCE(day, week, month) AS period_start,
         COUNT(*) AS tips_total,
         COUNT(*) FILTER (WHERE tip_type = 'small') AS tips_small,
         COUNT(*) FILTER (WHERE tip_type = 'medium') AS tips_medium,
         COUNT(*) FILTER (WHERE tip_type = 'large') AS tips_large,
         COUNT(*) FILTER (WHERE tip_type = 'xlarge') AS tips_xlarge
  FROM tip_keys
  GROUP BY GROUPING SETS ((day), (week), (month))
)
SELECT s.period_type, s.period_start, s.sessions, s.active_users,
       COALESCE(r.app_rate_clicks, 0) AS app_rate_clicks,
       COALESCE(r.rate_settings, 0) AS rate_settings,
       COALESCE(r.rate_tip_developer, 0) AS rate_tip_developer,
       COALESCE(r.rate_streak, 0) AS rate_streak,
       COALESCE(t.tips_total, 0) AS tips_total,
       COALESCE(t.tips_small, 0) AS tips_small,
       COALESCE(t.tips_medium, 0) AS tips_medium,
       COALESCE(t.tips_large, 0) AS tips_large,
       COALESCE(t.tips_xlarge, 0) AS tips_xlarge
FROM sessions s
LEFT JOIN rate_agg r USING (period_type, period_start)
LEFT JOIN tip_agg t USING (period_type, period_start)
ORDER BY CASE s.period_type WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 WHEN 'monthly' THEN 3 ELSE 4 END,
         s.period_start
$function$;
