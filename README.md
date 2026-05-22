# Ванилька — кондитерская

## Локальный запуск

```bash
npm install
node server.js
```

- Сайт: http://localhost:8008
- Админка: http://localhost:8008/admin.html
- Логин: `admin` / Пароль: `vanilka2024`

## Деплой на Railway

1. Загрузи на GitHub
2. Railway → New Project → Deploy from GitHub
3. Добавь переменную: `ADMIN_PASSWORD` = твой пароль
4. Railway сам запустит `npm start`
