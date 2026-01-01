# Инструкция по деплою на Render.com

Для того чтобы игра работала на Render, выполните следующие шаги:

## 1. Подготовка GitHub
Вы уже скопировали файлы в папку `game_deploy`.
1. Создайте новый приватный (или публичный) репозиторий на GitHub.
2. Инициализируйте Git в папке `game_deploy` и отправьте код в репозиторий:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПОЗИТОРИЙ.git
   git push -u origin main
   ```

## 2. Настройка на Render.com
1. Зайдите на [dashboard.render.com](https://dashboard.render.com).
2. Нажмите **New +** -> **Web Service**.
3. Подключите свой репозиторий GitHub.
4. В настройках укажите:
   - **Name**: `ant-game` (любое имя)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. В разделе **Environment Variables** (Переменные окружения) добавьте:

> [!IMPORTANT]  
> Если Render выдает ошибку `MODULE_NOT_FOUND` для `index.js`, убедитесь, что в настройках **Start Command** указано именно `npm start` (а не `node index.js`). Я также обновил `package.json`, чтобы минимизировать риск этой ошибки.
   - `PORT`: `8080` (Render сам назначит порт, если не указывать)
   - `GAME_PASSWORD`: `game` (пароль входа в игру для игроков)
   - `CURATOR_PASSWORD`: `curator` (пароль входа в панель куратора)
   - `NODE_ENV`: `production`

## Список файлов для GitHub:
- `client/` — вся папка с фронтендом.
- `server/` — вся папка с логикой.
- `package.json` — зависимости и скрипт запуска.
- `package-lock.json` — зафиксированные версии зависимостей.
- `.gitignore` — чтобы не заливать лишнее.

## Почему мы создали отдельную папку?
Папка `game_deploy` на рабочем столе — это "чистый" снимок текущего состояния кода. Вы можете спокойно заливать её на GitHub, а в оригинальной папке мы продолжим разработку. Это защитит рабочую версию от случайных ошибок при настройке деплоя.
