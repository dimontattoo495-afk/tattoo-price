TATTOO PRICE — ПРОТОТИП ЭТАП 1

Что внутри:
- index.html — главная с карточками, поиском и фильтрами.
- publish.html — форма публикации мастера.
- listing.html — страница отдельной работы.
- styles.css — адаптивный дизайн.
- app.js — демонстрационные карточки и фильтрация.
- assets/ — локальные изображения-заглушки.

ВАЖНО
Это отдельный прототип. Он ничего не меняет в проекте «Я БЫЛ ЗДЕСЬ».
Supabase, хранилище и Т-Банк пока НЕ подключены.

Что уже демонстрирует форма:
- выбор до 5 фотографий;
- уменьшение до 1600 px прямо в браузере;
- WebP/JPEG-сжатие;
- показ примерного размера после сжатия;
- поля мастера, города, стиля, цены и соцсетей;
- 3 демонстрационных тарифа: 199 / 399 / 699 ₽;
- будущую схему «оплата → модерация → публикация».

Предлагаемая архитектура этапа 2:
GitHub Pages
  ↓
Supabase Database
Supabase Storage (фото)
Supabase Edge Functions
  ↓
Т-Банк интернет-эквайринг
  ↓
Webhook
  ↓
Статус: paid_review → published после одобрения администратора

Предлагаемые статусы объявления:
draft
pending_payment
paid_review
published
hidden
expired
rejected

Предлагаемая таблица listings:
id
public_no
owner_hash
master_name
studio_name
city
style
title
description
work_price
price_type
telegram_url
vk_url
website_url
plan
placement_price
status
payment_status
expires_at
created_at
updated_at

Отдельная таблица listing_photos:
id
listing_id
storage_path
sort_order
width
height
bytes
created_at

Следующий шаг после утверждения внешнего вида:
1. Создать НОВЫЙ GitHub repo.
2. Создать второй Supabase project.
3. Создать buckets и таблицы.
4. Реализовать upload 1–5 фото.
5. Перенести owner-link механику из «Я БЫЛ ЗДЕСЬ».
6. Переделать Admin V2 под модерацию фотографий/объявлений.
7. Только после этого подключить Т-Банк.
