-- Domänen-Defaults (idempotent via on conflict do nothing).
-- Quelle: Frontend/src/lib/data/seed.ts (INGREDIENTS_DEFAULT, SAUCES_DEFAULT, VOUCHERS_INIT, DEFAULT_CONFIG).

insert into public.ingredients (id, name, emoji, category, available, description) values
  ('mozzarella','Mozzarella','🧀','Käse',true,'Frischer ital. Mozzarella'),
  ('extra-kaese','Extra Käse','🫕','Käse',true,'Doppelt so viel Käse'),
  ('gorgonzola','Gorgonzola','🧀','Käse',true,'Würziger Blauschimmelkäse'),
  ('salami','Salami','🍖','Fleisch',true,'Würzige Salamischeiben'),
  ('schinken','Schinken','🥩','Fleisch',true,'Zarter Kochschinken'),
  ('haehnchen','Hähnchen','🍗','Fleisch',true,'Gegrilltes Hähnchen'),
  ('hackfleisch','Hackfleisch','🫙','Fleisch',true,'Gewürztes Rinderhackfleisch'),
  ('thunfisch','Thunfisch','🐟','Fisch',true,'Milder Thunfisch'),
  ('garnelen','Garnelen','🍤','Fisch',true,'Gegrillte Garnelen'),
  ('ananas','Ananas','🍍','Gemüse',true,'Frische Ananasstreifen'),
  ('paprika','Paprika','🫑','Gemüse',true,'Bunte Paprikastreifen'),
  ('mais','Mais','🌽','Gemüse',true,'Süßer Zuckermais'),
  ('jalapenos','Jalapeños','🌶️','Gemüse',true,'Feurige Jalapeños'),
  ('pilze','Pilze','🍄','Gemüse',true,'Frische Champignons'),
  ('zwiebeln','Zwiebeln','🧅','Gemüse',true,'Rote Zwiebeln'),
  ('oliven','Oliven','🫒','Gemüse',true,'Schwarze Oliven'),
  ('rucola','Rucola','🥬','Gemüse',true,'Frischer Rucola'),
  ('spinat','Spinat','🌿','Gemüse',true,'Junger Blattspinat'),
  ('kirschtomaten','Kirschtomaten','🍅','Gemüse',true,'Halbierte Kirschtomaten'),
  ('artischocken','Artischocken','🌱','Gemüse',false,'Zarte Artischockenherzen'),
  ('knoblauch','Knoblauch','🧄','Gemüse',true,'Frischer Knoblauch'),
  ('basilikum','Basilikum','🌿','Gemüse',true,'Frisches Basilikum'),
  ('peperoncini','Peperoncini','🫑','Gemüse',true,'Milde eingelegte Peperoncini')
on conflict (id) do nothing;

insert into public.sauces (id, name, emoji, color, available) values
  ('tomate','Tomate','🍅','#B03818',true),
  ('creme','Crème fraîche','🥛','#ECE3C8',true),
  ('bbq','BBQ','🍖','#7A3B1E',true),
  ('pesto','Pesto','🌿','#4B7A2F',true),
  ('keine','Ohne Soße','🚫','#E8C070',true)
on conflict (id) do nothing;

insert into public.vouchers (id, name, code, type, value, ingredient_name, expires_at, active, max_uses, uses) values
  ('v1','Willkommen','WELCOME10','percent',10,null,'2026-12-31',true,100,23),
  ('v2','Sommer','SOMMER15','percent',15,null,'2026-08-31',true,50,12),
  ('v3','Festrabatt','PIZZA5','fixed',5,null,'2026-09-30',false,200,87),
  ('v4','Special','WEED420','ingredient',0,'Weed 🌿','2026-12-31',true,50,4)
on conflict (id) do nothing;

insert into public.app_config (id, days, hours, lead_time_days, service) values
  (1,
   '{"Montag":true,"Dienstag":true,"Mittwoch":false,"Donnerstag":true,"Freitag":true,"Samstag":true,"Sonntag":false}'::jsonb,
   '{"from":"11:00","to":"21:00"}'::jsonb,
   3,
   '{"dineIn":false,"takeaway":true}'::jsonb)
on conflict (id) do nothing;
