-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule zalo-scheduler to run at 8 AM daily
SELECT cron.schedule(
  'zalo-scheduler',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url=>'https://jzhxdwriskdxcivirbip.supabase.co/functions/v1/zalo-scheduler',
    headers=>'{"Content-Type":"application/json"}'::jsonb,
    body=>'{}'::jsonb
  );
  $$
);