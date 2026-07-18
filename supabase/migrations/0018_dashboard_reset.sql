-- Dashboard-Reset: weicher Reset-Punkt. null = all-time (bisheriges Verhalten).
-- Dashboard-Aggregation zählt Bestellungen ab diesem Zeitpunkt; Bestellungen/Digest/Historie unberührt.
alter table public.app_config add column if not exists dashboard_reset_at timestamptz;
