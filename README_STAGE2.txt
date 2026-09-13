TATTOO PRICE — STAGE 2

1. Edge Function create-listing должна быть Deploy.
2. Verify JWT with legacy secret = OFF.
3. Загрузите файлы из этого архива в корень GitHub repo tattoo-price поверх старых.
4. Commit changes.
5. После GitHub Pages deployment откройте publish.html.
6. Создайте тестовое объявление с 1–5 фотографиями.

Ожидаемый результат:
- в форме появляется номер объявления;
- запись появляется в tp_listings со status=pending_payment;
- строки фото появляются в tp_listing_photos;
- сами файлы появляются в Storage -> listing-photos.

На главной созданное объявление пока НЕ показывается — это правильно.
До оплаты и модерации оно не должно быть публичным.

Публичный publishable key в supabase-config.js не является секретом.
Не добавляйте service_role / secret keys в GitHub.
