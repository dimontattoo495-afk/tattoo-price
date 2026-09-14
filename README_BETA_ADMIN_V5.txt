TATTOO PRICE — BETA ADMIN V5

Что меняется в админке:
- бесплатное объявление больше не выглядит как «payment: paid»;
- показывается «БЕТА · бесплатно» и «без списаний»;
- вместо «Размещение: 199 ₽» показывается «Размещение: бесплатно»;
- у бесплатного объявления показывается:
  «Бесплатное место №N из 50» и сколько мест осталось;
- сверху админки появляется общая строка:
  использовано X из 50 · осталось Y · срок 15 дней.

Файлы для GitHub:
- admin.html
- admin.js
- admin.css
- admin-api-beta-v11-index.ts
- 10_BETA_ADMIN_LABELS.sql

После Commit подождать до 2 минут, чтобы автообновление Beget забрало файлы.

Потом ИЗ WINDOWS POWERSHELL выполнить одной строкой:

ssh root@45.80.68.40 "cd /root/supabase-project && cat volumes/site/10_BETA_ADMIN_LABELS.sql | docker exec -i supabase-db psql -U postgres -d postgres && cp volumes/site/admin-api-beta-v11-index.ts volumes/functions/admin-api/index.ts && docker compose up -d --force-recreate functions"

После выполнения открыть:
https://price.smoke-tattoo.ru/admin.html
и нажать Ctrl+F5.

Для уже созданного бесплатного объявления №100007 SQL автоматически присвоит
первый beta_slot_no = 1.
