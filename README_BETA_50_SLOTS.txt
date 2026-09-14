TATTOO PRICE — BETA 50 FREE PLACEMENTS / 15 DAYS — V4

Что изменилось:
- бесплатный период ограничен ПЕРВЫМИ 50 РАЗМЕЩЕНИЯМИ;
- это 50 размещений, а не подтверждённые уникальные мастера;
- на главной и на странице публикации виден счётчик:
  «Осталось бесплатных мест: X из 50»;
- первые 50 объявлений:
  0 ₽, без карты, публикация сразу на 15 дней;
- 51-е и последующие объявления автоматически возвращаются
  к обычным тарифам 199 / 399 / 699 ₽;
- лимит резервируется атомарно на сервере, поэтому два посетителя
  не смогут одновременно получить одно последнее бесплатное место;
- если два посетителя всё же видели «1 место» одновременно, проигравшего
  НЕ отправит в банк автоматически: ему покажется сообщение, что бесплатные
  места закончились, и он сам решит, переходить ли к оплате.

УСТАНОВКА
1. Загрузить в GitHub поверх текущих:
   index.html
   publish.html
   publish-live.js
   tp-api-payments.js
   my.html
   09_BETA_FREE_MODE.sql

2. Сделать Commit changes.
3. Подождать до 2 минут — Beget auto-deploy сам обновит сайт.
4. Подключиться к серверу:
   ssh root@45.80.68.40

5. Выполнить:
docker exec -i supabase-db psql -U postgres -d postgres < /root/supabase-project/volumes/site/09_BETA_FREE_MODE.sql

ПРОВЕРКА СЧЁТЧИКА
docker exec supabase-db psql -U postgres -d postgres -c "select public.tp_get_public_settings();"

КАК ПОМЕНЯТЬ ЛИМИТ, например на 100:
docker exec supabase-db psql -U postgres -d postgres -c "update public.tp_site_settings set beta_free_limit=100, updated_at=now() where id=1;"

КАК ВЫКЛЮЧИТЬ БЕТУ РАНЬШЕ:
docker exec supabase-db psql -U postgres -d postgres -c "update public.tp_site_settings set beta_free_enabled=false, updated_at=now() where id=1;"

ВАЖНО
Счётчик beta_free_used специально не уменьшается при удалении бесплатного
объявления: «первые 50» означает 50 выданных бесплатных размещений.
