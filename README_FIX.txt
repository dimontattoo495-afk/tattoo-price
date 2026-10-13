TATTOO PRICE RENT V1.1 — FIX

Причина:
Текущий Tattoo Price не использует window.supabaseClient.
У него уже есть свои файлы:
  supabase-config.js
  tp-auth.js
Поэтому V1 показывал «Не найден Supabase-клиент сайта».

Что исправлено:
- rent-publish.js теперь использует существующий TPAuth;
- отправка идёт напрямую в REST API с текущим access token пользователя;
- rent.js использует существующий TP_CONFIG.publishableKey;
- rent-view.js тоже использует TP_CONFIG;
- HTML подключает правильные supabase-config.js и tp-auth.js.

Установка:
Загрузить ВСЕ 6 файлов из этого архива в корень GitHub репозитория tattoo-price
С ЗАМЕНОЙ существующих файлов:
  rent.html
  rent.js
  rent-publish.html
  rent-publish.js
  rent-view.html
  rent-view.js

Сервер повторно устанавливать НЕ НУЖНО.

После GitHub Pages:
1. Обновить страницу Ctrl+F5.
2. Войти в аккаунт Tattoo Price.
3. Открыть /rent-publish.html.
4. Отправить тест.
5. Должно появиться:
   «Готово. Объявление №... отправлено на модерацию.»

Важно:
Скрин с текстом «Не найден Supabase-клиент сайта» означает, что предыдущее тестовое объявление фактически НЕ было отправлено.
