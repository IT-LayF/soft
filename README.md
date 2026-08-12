# Infinyty Platform

Vercel API + сайт для лаунчера Infinyty.

## Развёртывание

1. Создайте новый Vercel Project из этой папки/репозитория.
2. Подключите Neon Postgres через Vercel Marketplace.
3. Выполните `sql/schema.sql` в Neon SQL Editor.
4. Добавьте переменные из `.env.example`. Никогда не коммитьте реальные значения.
5. Для первого администратора временно задайте `BOOTSTRAP_SECRET`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, выполните POST `/api/bootstrap`, затем удалите `ADMIN_PASSWORD` и `BOOTSTRAP_SECRET`.
6. Установите Telegram webhook на `https://ВАШ-ДОМЕН/api/telegram`, передав `secret_token`, совпадающий с `TELEGRAM_WEBHOOK_SECRET`.

## Безопасность

- Отзовите ранее опубликованный Telegram token и смените пароль администратора.
- Используйте новый пароль минимум из 16 случайных символов.
- Для production подключите реальный платёжный webhook; `PAYMENT_URL` сейчас создаёт переход к провайдеру, но не активирует подписку автоматически.
