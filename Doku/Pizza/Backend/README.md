# Backend-Doku

> Dokumentiert den Code in `../../../Backend/`.
> Nabe: [[00_CONTEXT]] · verwandt: [[Datenbank/README|Datenbank-Doku]] · [[API/README|API-Doku]] · Betrieb: [[SETUP-Supabase]]

Geplante Inhalte: Controller · Services · Businesslogik · Validierung · Fehlerbehandlung · Logging · Caching · Performance

Das Backend ist Supabase: Postgres-Schema mit RLS, Auth, Edge Functions (`admin-users`,
`daily-digest`, `notify-special-order`) und `pg_cron`/`pg_net`. Grundsatzentscheidung:
[[ADR-0002-backend-supabase|ADR-0002 Supabase]] · Cutover: [[ADR-0006-supabase-cutover|ADR-0006]].
