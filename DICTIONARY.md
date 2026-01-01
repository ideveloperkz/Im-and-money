# ГЛОССАРИЙ (DICTIONARY)

## Основные сущности

| Название | Описание | Расположение |
|----------|----------|--------------|
| `GameState` | Главный фасад (Singleton), через который идет доступ к логике | `server/models/GameState.js` |
| `PlayerManager` | Модуль управления игроками, именами и авторизацией | `server/models/managers/PlayerManager.js` |
| `TurnManager` | Управление стадиями игры, ходами и кубиком | `server/models/managers/TurnManager.js` |
| `MovementManager`| Логика перемещения фишек и обработки путей/развилок | `server/models/managers/MovementManager.js` |
| `FinanceManager` | Все финансовые операции, кошельки и бизнесы | `server/models/managers/FinanceManager.js` |
| `CellManager` | Обработка эффектов клеток и работа с колодами | `server/models/managers/CellManager.js` |
| `CardService` | Сервис для загрузки и обработки эффектов JSON-карт | `server/services/CardService.js` |

## Переменные и Флаги

| Название | Описание | Файлы |
|----------|----------|-------|
| `displayName` | Чистое отображаемое имя игрока (без #1, #2) | `PlayerManager.js`, `gameclient.js` |
| `status.skippedTurns`| Количество ходов, которые игрок должен пропустить | `TurnManager.js` |
| `passedMoneyCells` | Список ID денежных клеток, пройденных за текущий ход | `MovementManager.js`, `gameclient.js` |
| `isSleeping` | Флаг игрока, который долго не совершал действий | `TurnManager.js` |
| `eventQueue` | Глобальная очередь событий для поочередного показа окон | `gameclient.js` |
| `isEventWindowOpen` | Флаг, блокирующий открытие нового окна, если старое не закрыто | `gameclient.js`, `deckanimation.js` |
| `doubleDiceTurnsRemaining` | Оставшееся количество ходов с двумя кубиками | `TurnManager.js`, `PlayerManager.js` |
| `charityDonationsMade` | Счетчик накопленных "добрых дел" (привилегий) | `PlayerManager.js`, `CellManager.js` |
| `pendingDoubleRoll` | Результат первого захода при броске 2-х кубиков | `PlayerManager.js`, `TurnManager.js` |
| `isPartial` | Флаг промежуточного (первого) броска кубика | `TurnManager.js`, `diceanimation.js` |
| `incomeBlockedTurns` | Счетчик ходов, в течение которых игрок не получает доход на клетках "Деньги" | `PlayerManager.js`, `CellManager.js` |
| `autoFinanceCards` | Серверная структура данных, дублирующая финансовую карточку игрока | `GameState.js`, `PlayerManager.js` |
| `assets` | Объект, хранящий бизнесы, навыки и купленные предметы игрока | `PlayerManager.js` |
| `requiresSkill` | Требование наличия навыка для эффекта карточки | `CardService.js` |

## Ключевые Функции

| Название | Описание | Модуль |
|----------|----------|--------|
| `applyMoneyChange` | Изменить баланс с авто-распределением по кошелькам | `FinanceManager.js` |
| `spendFromWallets` | Списать деньги, используя приоритеты кошельков | `FinanceManager.js` |
| `handleCell` | Точка входа для всех событий при попадании на клетку | `CellManager.js` |
| `showUnifiedWindow` | Показать игроку событие в универсальном модальном окне | `gameclient.js` |
| `nextTurn` | Переключить ход с учетом всех условий | `TurnManager.js` |
| `addToEventQueue` | Добавить игровое сообщение или карту в очередь показа | `gameclient.js` |
| `refreshFinanceData`| Обновить UI финансовой карточки данными с сервера | `board.js` |
| `showGameOverModal` | **НОВОЕ:** Показать модалку завершения игры с победителями | `gameclient.js` |
| `launchCelebration` | **НОВОЕ:** Запустить анимацию салюта (confetti) | `gameclient.js` |
| `updateHostButton` | Синхронизировать состояние всех кнопок управления игрой | `gameclient.js` |

## Новые переменные (2025-12-30)

| Название | Описание | Файлы |
|----------|----------|-------|
| `monthlyIncome` | Поле дохода в JSON карточках бизнесов | `business.json`, `FinanceManager.js` |
| `buttonExplicitlyHidden` | Флаг явного скрытия кнопки управления куратором | `gameclient.js` |
| `allowPlayerGameControl` | Серверный флаг разрешения управления игрой для игроков | `GameState.js`, `server.js` |
