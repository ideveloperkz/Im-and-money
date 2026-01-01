# КАРТА ФАЙЛОВ (FILE_MAP)

## Структура проекта

```
game/
├── client/                    # Клиентская часть (Frontend)
│   ├── index.html            # Игровое поле и все модальные окна
│   ├── board.css             # Стили поля и базовых элементов
│   ├── board.js              # Логика UI (финансы, чат, модалки)
│   ├── gameclient.js         # Ядро клиента (Socket.IO, очередь событий UEQ)
│   ├── deckanimation.js      # Анимация и логика вытягивания карт
│   ├── diceanimation.js      # 3D-анимация кубика
│   ├── coinanimation.js      # Анимация подбрасывания монетки
│   ├── playeranimation.js    # Логика перемещения фишек по полю
│   └── ...                   # Стили и медиа-ассеты
├── server/                    # Серверная часть (Backend)
│   ├── server.js             # Главный серверный файл (Socket.IO инстанс)
│   ├── board.js              # Конфигурация графа игрового поля (56 клеток)
│   ├── models/
│   │   ├── GameState.js      # Фасад состояния (Singleton)
│   │   └── managers/         # Логические модули (Managers)
│   │       ├── PlayerManager.js   # Игроки, авторизация, цвета
│   │       ├── TurnManager.js     # Очередность, кубик, статистика
│   │       ├── MovementManager.js # Перемещение и развилки
│   │       ├── FinanceManager.js  # Счета, доходы, покупки
│   │       └── CellManager.js     # Эффекты клеток
│   ├── services/
│   │   └── CardService.js    # Универсальный сервис для работы с JSON-картами
│   └── data/                 # Статические данные (клетки, колоды)
├── .env                       # Конфигурация (пароли, порты)
├── AGENTS.md                 # Инструкции для ИИ-агентов
├── README.md                 # Главная документация проекта
└── ...                       # Служебные файлы (IMPLEMENTED, DICTIONARY, etc.)
```

---

## Backend: server/models/Managers

### [PlayerManager.js](file:///c:/Users/zhani/Desktop/game%20(2)/server/models/managers/PlayerManager.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 17-148 | `addPlayer` | Регистрация игрока, генерация UUID, назначение цвета |
| 150-187 | `removePlayer` | Удаление игрока из системы при отключении |
| 189-209 | `connectCurator` | Авторизация наблюдателя |

### [TurnManager.js](file:///c:/Users/zhani/Desktop/game%20(2)/server/models/managers/TurnManager.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 17-46 | `startGame` | Запуск игры, перемешивание колод |
| 51-95 | `nextTurn` | Передача хода, учет пропусков и "спящих" игроков |
| 97-154 | `rollDice` | Интерактивный бросок (1 или 2 кубика, 2 фазы) |

### [MovementManager.js](file:///server/models/managers/MovementManager.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 15-118 | `movePlayer` | Перемещение по графу. Обработка `passedMoneyCells`. |
| 120-149 | `predictMove` | Предсказание цели для отрисовки пути. |
| 151-184 | `setForkDirection` | Выбор пути на развилке. |

### [FinanceManager.js](file:///server/models/managers/FinanceManager.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 17-71 | `applyMoneyChange` | Изменение баланса с авто-распределением по кошелькам (4 типа). |
| 104-141 | `collectBusinessIncome` | Сбор дохода от всех активов игрока. **ИСПРАВЛЕНО:** Поддержка `monthlyIncome` (строка 128). |
| 196-267 | `spendFromWallets` | Списание денег по приоритетам (Инвестиции -> Сбережения). |
| 270-300 | `cascadingSpend` | Каскадное списание (Инвест -> Сбер -> Мечта -> Благ). |
| 331-380 | `buyBusiness` | Покупка бизнеса. **ИСПРАВЛЕНО:** Парсинг `monthlyIncome` (строка 352). |

### [CellManager.js](file:///server/models/managers/CellManager.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 23-89  | `handleCell` | Точка входа обработки клетки. Роутинг на DrawCard или ComplexCell. |
| 108-190| `handleComplexCell` | Обработка JSON-сценариев: `collect_income`, `charity_bonus`, `dream_check`. |
| 195-208| `processComplexEffect`| Применение атомарных эффектов (`pay`, `skip_turn`, `block_income`). |
| 213-297| `applyEffect` | Низкоуровневое изменение состояния (финансы, статусы). |
| 302-400| `handleDreamCell` | Логика покупки Мечты (авто-покупка или оффер актива). |
| 405-415| `drawCard` | Фасад для вызова CardService. |

### [CardService.js](file:///server/services/CardService.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 22-39  | `loadCards` | Загрузка JSON баз данных карточек. |
| 130-249| `applyCardEffect` | Парсинг эффектов карты, подготовка diff-объекта для клиента. |
| 267-378| `processCard` | Валидация требований (Skills/Assets), применение эффектов, генерация ответа. |
| 383-390| `addSkill` | Выдача навыка игроку. |

---

## Frontend: client/

### [gameclient.js](file:///client/gameclient.js)
| Строки | Блок / Метод | Описание |
|--------|--------------|----------|
| 8-27   | `getSocketUrl` | Определение URL сервера (поддержка file://, localhost, IP). |
| 71-119 | `authenticatePlayer` | Авторизация, получение токена и init-state. |
| 127-206| `displayAllPlayers` | Рендеринг фишек игроков. Синхронизация позиций. |
| 360-450| `updateGameBoard` | Обновление UI состояния (кнопки броска, монетки, баланс). |
| 506-537| `socket.on('game:state_update')` | Реакция на глобальный апдейт стейта. |
| 707-725| **UEQ** (`processEventQueue`) | Единая очередь событий. |
| 730-800| `showUnifiedWindow` | Универсальное модальное окно события. |
| 1215-1382| **Curator Controls** | Панель куратора, кнопки управления, hide/show controls. |
| 1478-1532| `showGameOverModal` | **НОВОЕ:** Модалка завершения игры с победителями. |
| 1534-1568| `launchCelebration` | **НОВОЕ:** Анимация салюта (confetti) при победе. |

### [board.js](file:///c:/Users/zhani/Desktop/game%20(2)/client/board.js)
| Блок | Описание |
|------|----------|
| `History Modal` | Логика отображения истории транзакций |
| `Autofill Engine` | Механизм синхронизации бланка с сервером |
| `Dream Selection` | Управление интерфейсом выбора цели |

### [diceanimation.js](file:///c:/Users/zhani/Desktop/game%20(2)/client/diceanimation.js)
| Строки | Метод | Описание |
|--------|-------|----------|
| 31-87  | `showDiceAnimation` | 3D-анимация с поддержкой `isPartial` |
| 89-122 | `showResult` | Вывод результата (сумма или просьба кинуть еще) |
| 124-138| `closeModal` | Логика закрытия и старт движения фишки |
