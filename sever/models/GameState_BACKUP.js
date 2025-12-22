const { v4: uuidv4 } = require('uuid');
const cardService = require('../services/CardService');
const board = require('../board');
const cellsData = require('../data/cells.json');

/**
 * Управление состоянием игры
 * Все состояние хранится в оперативной памяти (RAM)
 * После завершения игры состояние сбрасывается
 */
class GameState {
    constructor() {
        this.reset();
    }

    /**
     * Сбросить состояние игры
     */
    reset() {
        this.status = 'waiting'; // 'waiting' | 'in_progress' | 'finished'
        this.startedAt = null;
        this.finishedAt = null;

        this.curator = {
            id: null,
            name: null,
            connectedAt: null,
            socketId: null
        };

        this.players = {}; // { playerId: playerData }
        this.hostPlayerId = null; // ID игрока-хоста (первый зарегистрированный)
        this.decks = null; // Перемешанные колоды карт
        this.gameHistory = []; // История всех действий
        this.autoFinanceCards = {}; // Автоматические финансовые карточки
        this.currentTurn = null; // ID текущего игрока

        console.log('🔄 Состояние игры сброшено');
    }

    /**
     * Подключить куратора
     */
    connectCurator(curatorData) {
        this.curator = {
            id: curatorData.id || uuidv4(),
            name: curatorData.name,
            connectedAt: new Date().toISOString(),
            socketId: curatorData.socketId
        };

        this.addToHistory({
            action: 'curator_connected',
            actorId: this.curator.id,
            actorName: this.curator.name,
            details: { message: 'Куратор подключился к игре' }
        });

        console.log(`👨‍🏫 Куратор подключен: ${this.curator.name}`);
        return this.curator;
    }

    /**
     * Начать игру
     */
    startGame() {
        if (this.status !== 'waiting') {
            throw new Error('Игра уже начата');
        }

        this.status = 'in_progress';
        this.startedAt = new Date().toISOString();

        // Создать перемешанные колоды
        this.decks = cardService.createGameDecks();

        // Установить очередность ходов (по порядку добавления)
        const playerIds = Object.keys(this.players);
        if (playerIds.length > 0) {
            this.currentTurn = playerIds[0];
        }

        this.addToHistory({
            action: 'game_started',
            actorId: this.curator.id,
            actorName: this.curator.name,
            details: {
                message: 'Игра началась',
                playersCount: playerIds.length,
                firstTurn: this.currentTurn
            }
        });

        console.log('🎮 Игра началась! Первый ход:', this.players[this.currentTurn]?.displayName);
        return { status: this.status, startedAt: this.startedAt, currentTurn: this.currentTurn };
    }

    /**
     * Передать ход следующему игроку
     */
    nextTurn() {
        const playerIds = Object.keys(this.players);
        if (playerIds.length === 0) return;

        const currentIndex = playerIds.indexOf(this.currentTurn);
        let nextIndex = (currentIndex + 1) % playerIds.length;
        const nextPlayerId = playerIds[nextIndex];
        const nextPlayer = this.players[nextPlayerId];

        // Проверка: должен ли игрок пропустить ход?
        if (nextPlayer.status.skippedTurns > 0) {
            console.log(`⏩ Игрок ${nextPlayer.displayName} пропускает ход (осталось: ${nextPlayer.status.skippedTurns - 1})`);

            // Уменьшаем счетчик
            nextPlayer.status.skippedTurns--;

            // Записываем в историю
            this.addToHistory({
                action: 'turn_skipped',
                actorId: nextPlayerId,
                actorName: nextPlayer.displayName,
                details: { remainingSkips: nextPlayer.status.skippedTurns }
            });

            // Передаем ход (просто меняем currentTurn, рекурсия не обязательна, если мы вызовем nextTurn снова)
            // Но чтобы не зациклить (если все пропускают), нужен лимит.
            // Для простоты: просто переключаем на ЭТОГО "пропускающего", 
            // но клиент должен знать, что он пропускает?
            // НЕТ, лучше СРАЗУ передать следующему.

            this.currentTurn = nextPlayerId; // Сначала ставим его
            return this.nextTurn(); // И сразу передаем дальше!
        }

        // === ПРОВЕРКА СПЯЩЕГО ИГРОКА ===
        if (nextPlayer.isSleeping) {
            console.log(`💤 Игрок ${nextPlayer.displayName} спит - пропускаем`);

            this.addToHistory({
                action: 'sleeping_player_skipped',
                actorId: nextPlayerId,
                actorName: nextPlayer.displayName,
                details: { message: 'Игрок спит, ход пропущен' }
            });

            this.currentTurn = nextPlayerId;
            return this.nextTurn(); // Передаём дальше
        }

        this.currentTurn = nextPlayerId;

        // Сбросить данные текущего хода для нового игрока
        if (nextPlayer && nextPlayer.currentTurnData) {
            nextPlayer.currentTurnData = {
                incomeEntries: [],
                expenseEntries: [],
                walletChanges: {
                    savings: 0,
                    investments: 0,
                    charity: 0,
                    dream: 0
                }
            };
        }

        console.log(`➡️ Ход перешел к игроку ${this.players[this.currentTurn].displayName} (${this.currentTurn})`);
        return this.currentTurn;
    }

    /**
     * Завершить игру
     */
    endGame() {
        this.status = 'finished';
        this.finishedAt = new Date().toISOString();

        this.addToHistory({
            action: 'game_ended',
            actorId: this.curator.id,
            actorName: this.curator.name,
            details: {
                message: 'Игра завершена',
                duration: this.calculateGameDuration()
            }
        });

        console.log('🏁 Игра завершена');
        return this.generateReport();
    }

    /**
     * Добавить игрока
     */
    addPlayer(playerData) {
        // 1.1 СОЗДАНИЕ ОБЪЕКТА ИГРОКА (STATE)
        // Здесь формируется структура данных для нового игрока.
        // Присваивается уникальный ID, имя, цвет и начальная позиция 'cell-start'.
        const playerId = uuidv4();
        const playerNumber = Object.keys(this.players).length + 1;

        this.players[playerId] = {
            id: playerId,
            displayName: `${playerData.name} #${playerNumber}`,
            firstName: playerData.name,
            lastName: playerData.lastName || null,
            antColor: this.getAvailableAntColor(),
            joinedAt: new Date().toISOString(),
            socketId: playerData.socketId,
            isActive: true,

            // Статус игрока (добавлено для логики пропусков и блокировок)
            status: {
                skippedTurns: 0,       // Сколько ходов нужно пропустить
                incomeBlockedTurns: 0, // На сколько кругов заблокирован доход
                activeBuffs: []        // Активные положительные эффекты
            },

            position: {
                currentCell: 'cell-start',
                currentCellType: board['cell-start'].type,
                cellIndex: 0,
                circle: 'long', // 'short' | 'long'
                canPlayBothCircles: false
            },

            // Финансы (что игрок ВВОДИТ САМ)
            playerEnteredFinances: {
                monthlyIncome: 0,
                monthlyExpenses: 0,
                wallets: {
                    charity: 0,
                    dream: 0,
                    savings: 100,  // Стартовый капитал
                    investments: 0
                },
                // Записи доходов (игрок добавляет вручную)
                incomeEntries: [],  // { id, name, amount, timestamp }
                // Записи расходов (игрок добавляет вручную)
                expenseEntries: [], // { id, name, amount, timestamp }
                capital: 100
            },

            // Временное хранилище данных текущего хода для автозаполнения
            currentTurnData: {
                incomeEntries: [],   // Записи доходов текущего хода
                expenseEntries: [],  // Записи расходов текущего хода
                walletChanges: {     // Изменения копилок текущего хода
                    savings: 0,
                    investments: 0,
                    charity: 0,
                    dream: 0
                }
            },

            // История ходов игрока (для таблицы истории)
            turnHistory: [],  // { turnNumber, dice, cellKey, cellName, cardTitle, result, amount }

            // Активы
            assets: {
                businesses: [],  // Бизнесы (приносят доход)
                items: [],       // Активы/Вещи (можно продать)
                skills: [],
                dream: null
            },

            // Активные карточки
            activeCards: {
                news: [],
                expenses: []
            },

            // Партнерства и долги
            partnerships: [],
            debts: [],

            // Мечта (выбранная)
            dream: null,

            // Флаг: заполнил ли игрок карточку после хода
            cardFilledThisTurn: true,  // Первый ход - карточка считается заполненной

            // === БЛАГОТВОРИТЕЛЬНОСТЬ ===
            charityDonationsMade: 0,        // Счетчик благотворительных действий
            doubleDiceTurnsRemaining: 0,    // Ходов с двойным кубиком осталось
            isSleeping: false               // Флаг "спящего" игрока (для таймера)
        };

        // Инициализировать автоматическую финансовую карточку
        // СТАРТОВЫЙ КАПИТАЛ: 100 монет в копилке сбережений
        this.autoFinanceCards[playerId] = {
            calculatedMonthlyIncome: 0,
            calculatedMonthlyExpenses: 0,
            calculatedWallets: {
                charity: 0,
                dream: 0,
                savings: 100,     // СТАРТОВЫЙ КАПИТАЛ
                investments: 0
            },
            incomeHistory: [],
            expensesHistory: [],
            calculatedCapital: 100,
            calculatedBusinessCashFlow: 0,
            discrepancies: {
                hasDiscrepancies: false,
                details: []
            }
        };

        this.addToHistory({
            action: 'player_joined',
            actorId: playerId,
            actorName: this.players[playerId].displayName,
            details: { message: `Игрок ${this.players[playerId].displayName} присоединился` }
        });

        // === НАЗНАЧЕНИЕ ХОСТА ===
        // Первый зарегистрировавшийся игрок становится хостом
        if (!this.hostPlayerId) {
            this.hostPlayerId = playerId;
            console.log(`👑 ${this.players[playerId].displayName} назначен хостом игры`);
        }

        // Сохраняем порядковый номер для передачи хоста
        this.players[playerId].playerNumber = playerNumber;

        console.log(`👤 Игрок добавлен: ${this.players[playerId].displayName}`);
        return this.players[playerId];
    }

    /**
     * Получить доступный цвет муравья
     */
    getAvailableAntColor() {
        const colors = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];
        const usedColors = Object.values(this.players)
            .filter(p => p.isActive)
            .map(p => p.antColor);
        return colors.find(c => !usedColors.includes(c)) || 'blue';
    }

    /**
     * Бросить кубик (генерация случайного числа)
     * Если у игрока есть бонус двойного кубика (благотворительность) - бросаем 2 кубика
     */
    rollDice(playerId) {
        const player = this.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        let result;
        let dice1, dice2;
        let isDoubleDice = false;

        // Проверяем бонус двойного кубика от благотворительности
        if (player.doubleDiceTurnsRemaining > 0) {
            // Бросаем 2 кубика
            dice1 = Math.floor(Math.random() * 6) + 1;
            dice2 = Math.floor(Math.random() * 6) + 1;
            result = dice1 + dice2;
            isDoubleDice = true;

            // Уменьшаем счётчик
            player.doubleDiceTurnsRemaining--;
            console.log(`🎲🎲 ${player.displayName} бросил 2 кубика: ${dice1} + ${dice2} = ${result} (осталось ${player.doubleDiceTurnsRemaining} ходов с бонусом)`);
        } else {
            // Обычный бросок - 1 кубик
            result = Math.floor(Math.random() * 6) + 1;
            console.log(`🎲 ${player.displayName} бросил кубик: ${result}`);
        }

        this.addToHistory({
            action: 'roll_dice',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                diceResult: result,
                dice1: isDoubleDice ? dice1 : result,
                dice2: isDoubleDice ? dice2 : null,
                isDoubleDice,
                message: isDoubleDice
                    ? `Бонус благотворительности! 🎲 ${dice1} + 🎲 ${dice2} = ${result}`
                    : `Выпало: ${result}`
            }
        });

        return result;
    }

    /**
     * Переместить игрока
     */
    movePlayer(playerId, steps) {
        const player = this.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        const fromCell = player.position.currentCell;
        let currentCell = fromCell;

        // === НОВОЕ: Отслеживание пройденных клеток "Деньги" ===
        const passedMoneyCells = [];

        // Если есть сохраненное направление на развилке (после монетки)
        if (board[currentCell].type === 'fork' && player.forkDirection !== null) {
            // Используем сохраненное направление
            const nextIndex = player.forkDirection;
            currentCell = board[currentCell].next[nextIndex];
            player.forkDirection = null; // Сброс после использования
            // Это считается за 1 шаг? Или это старт?
            // "монетка просто определяет направление... потом бросается кубик и отсчитывает клетки"
            // Значит первый шаг кубика идет в выбранном направлении.
            // Но мы уже сделали шаг "currentCell = ...".
            // Значит осталось steps-1.
            steps--;

            // Проверяем, прошли ли через клетку "Деньги" после развилки
            if (board[currentCell].type === 'money') {
                passedMoneyCells.push(currentCell);
            }

            // Если steps было 0? (невозможно, кубик минимум 1)
        }

        // Двигаемся по оставшимся шагам
        for (let i = 0; i < steps; i++) {
            const cellData = board[currentCell];
            if (!cellData || !cellData.next || cellData.next.length === 0) {
                break; // Достигли конца доски
            }

            // Стандартный путь (next[0])
            currentCell = cellData.next[0];

            // === НОВОЕ: Проверяем, прошли ли через клетку "Деньги" (не последний шаг) ===
            if (i < steps - 1 && board[currentCell].type === 'money') {
                passedMoneyCells.push(currentCell);
            }

            // Если пришли на новую развилку - останавливаемся?
            // "если кубик не указывает на развилку то движемся дальше... ничего не должно мешать"
            // Значит STOP rule removed completely.
        }

        player.position.currentCell = currentCell;
        player.position.currentCellType = board[currentCell].type;

        // === НОВОЕ: Сохраняем пройденные клетки "Деньги" в состояние игрока ===
        player.passedMoneyCells = passedMoneyCells;
        console.log(`💰 Пройденные клетки "Деньги": ${passedMoneyCells.join(', ') || 'нет'}`);

        this.addToHistory({
            action: 'player_moved',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                steps, // This might look weird if shortened
                fromCell,
                toCell: currentCell,
                cellType: board[currentCell]?.type,
                message: `Переместился на ${board[currentCell]?.name}`
            }
        });

        console.log(`🚶 ${player.displayName}: ${fromCell} → ${currentCell}`);

        const result = this.handleCell(playerId, currentCell);

        // === ЗАПИСАТЬ В ИСТОРИЮ ХОДОВ ИГРОКА (для таблицы) ===
        const turnEntry = {
            turnNumber: player.turnHistory.length + 1,
            dice: steps,
            cellKey: currentCell,
            cellName: board[currentCell]?.name || currentCell,
            cardTitle: result.card?.title || null,
            result: result.action,
            amount: result.moneyChange || 0
        };
        player.turnHistory.push(turnEntry);

        // === НОВОЕ: Добавляем информацию о пройденных клетках "Деньги" в результат ===
        result.passedMoneyCells = passedMoneyCells;
        return result;
    }

    /**
     * Предсказать движение
     */
    predictMove(playerId, steps) {
        const player = this.players[playerId];
        if (!player) return null;

        let currentCell = player.position.currentCell;
        let forkDir = player.forkDirection; // Check if set

        // Simulation
        let simSteps = steps;

        if (board[currentCell].type === 'fork' && forkDir !== null && forkDir !== undefined) {
            currentCell = board[currentCell].next[forkDir];
            simSteps--;
        }

        for (let i = 0; i < simSteps; i++) {
            const cellData = board[currentCell];
            if (!cellData || !cellData.next || cellData.next.length === 0) break;
            currentCell = cellData.next[0];
        }

        return {
            targetCell: currentCell,
            cellName: board[currentCell].name
        };
    }

    /**
     * Установить направление на развилке (после монетки)
     */
    setForkDirection(playerId, result) {
        const player = this.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        const currentCell = player.position.currentCell;
        const cellData = board[currentCell];

        if (cellData.type !== 'fork') {
            throw new Error('Игрок не на развилке');
        }

        // Heads (Орел) -> Right (index 0 - меньшее число), Tails (Решка) -> Left (index 1 - большее число)
        const nextIndex = (result === 'heads') ? 0 : 1;

        player.forkDirection = nextIndex;

        this.addToHistory({
            action: 'fork_direction_set',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                coinResult: result,
                direction: result === 'heads' ? 'Направо' : 'Налево',
                message: `Монетка (${result}): ${player.displayName} выбирает путь ${result === 'heads' ? 'направо' : 'налево'}`
            }
        });

        // Return null as we are NOT moving yet.
        return { success: true, direction: nextIndex };
    }



    /**
     * Обработать эффект ячейки
     */
    handleCell(playerId, cellKey) {
        const player = this.players[playerId];
        const cell = board[cellKey];
        const autoFinance = this.autoFinanceCards[playerId];

        let result = {
            cellId: cellKey,
            cellType: cell.type,
            cellName: cell.name,
            action: null,
            card: null,
            moneyChange: 0
        };

        // === ПРИОРИТЕТ 1: Проверяем cells.json для специальных клеток ===
        const cellIdNum = cellKey.replace('cell-', '');
        const complexData = cellsData[cellIdNum];

        if (complexData) {
            console.log(`🧩 Обработка сложной клетки ${cellKey} (${complexData.title})`);

            // Логируем событие
            this.addToHistory({
                action: 'complex_cell_visit',
                actorId: playerId,
                actorName: player.displayName,
                details: {
                    title: complexData.title,
                    message: complexData.description_self
                }
            });

            // Возвращаем данные для клиента
            result.title = complexData.title;
            result.description = complexData.description_self;
            result.description_others = complexData.description_others;
            result.image = complexData.image || null;

            // === Обработка в зависимости от типа action ===

            if (complexData.action === 'choice') {
                // ВЫБОР: Игрок должен выбрать опцию
                result.action = 'choice';
                result.options = complexData.options;
                // НЕ вызываем nextTurn - ждем выбора игрока через player:choice_made

            } else if (complexData.action === 'multi_effect') {
                // МНОЖЕСТВЕННЫЕ ЭФФЕКТЫ: Применяем все сразу
                result.action = 'multi_effect';
                result.effects = complexData.effects;

                // Применяем эффекты
                this.processComplexEffect(playerId, complexData);

                // Примечание: Уведомление уже отправлено через addToHistory выше
                // и через server.js socket.broadcast.emit

                // Автоматическая передача хода
                this.nextTurn();

            } else {
                // ПРОСТОЙ ЭФФЕКТ: skip_turn, pay, etc.
                result.action = complexData.action;
                result.value = complexData.value;

                // Применяем эффект
                this.processComplexEffect(playerId, complexData);

                // Примечание: Уведомление уже отправлено через addToHistory выше
                // и через server.js socket.broadcast.emit

                // Автоматическая передача хода
                this.nextTurn();
            }

            return result;
        }

        // === ПРИОРИТЕТ 2: Стандартная логика по типу клетки ===
        switch (cell.type) {
            case 'money':
                // КЛЕТКА "ДЕНЬГИ" - Собрать доход от всех бизнесов и активов
                // Доход распределяется по копилкам автоматически (10/20/10/60)
                const totalBusinessIncome = this.collectBusinessIncome(playerId);

                result.action = 'monthly_income';
                result.moneyChange = totalBusinessIncome;
                result.message = totalBusinessIncome > 0
                    ? `💰 Получен доход: ${totalBusinessIncome} монет`
                    : `📭 Нет активных бизнесов - доход 0`;

                // АВТОМАТИЧЕСКАЯ ПЕРЕДАЧА ХОДА
                this.nextTurn();
                break;

            case 'chance':
            case 'news':
            case 'expenses':
            case 'kidsBusiness':
                // НЕ вытягиваем карточку автоматически!
                // Клиент покажет колоду и игрок кликнет чтобы вытянуть
                // Карточка вытягивается через player:draw_card_from_deck в server.js
                const cardType = this.mapCellTypeToCardType(cell.type);
                result.action = 'draw_card';
                result.cardType = cardType; // Передаём тип для клиента
                // result.card НЕ заполняем - карточка будет вытянута по клику
                break;

            case 'charity':
                // Клетка благотворительности
                // Если игрок делал пожертвования ранее - даём бонус двойного кубика
                if (player.charityDonationsMade > 0) {
                    player.doubleDiceTurnsRemaining = 3; // Бонус на 3 хода
                    player.charityDonationsMade = 0; // Сбрасываем счётчик пожертвований

                    result.action = 'charity_bonus';
                    result.message = '💝 Ваша благотворительность вознаграждена! Следующие 3 хода вы бросаете 2 кубика!';

                    this.addToHistory({
                        action: 'charity_bonus_granted',
                        actorId: playerId,
                        actorName: player.displayName,
                        details: {
                            message: 'Получен бонус: 3 хода с двумя кубиками за благотворительность!'
                        }
                    });

                    console.log(`💝 ${player.displayName} получил бонус двойного кубика за благотворительность!`);
                } else {
                    // Нет пожертвований - просто проходим мимо
                    result.action = 'charity_no_bonus';
                    result.message = 'Вы не делали пожертвований. Продолжайте путь!';
                }
                // Автоматическая передача хода
                this.nextTurn();
                break;

            case 'fork':
                result.action = 'choose_path';
                result.paths = cell.next;
                break;

            default:
                // Проверяем Hardcoded мечты
                // Проверяем Hardcoded мечты
                if (cellKey.includes('dream') || (cell.type && cell.type.startsWith('dream'))) {
                    // Fix: capture return value to send 'offer_buy_dream_item' to client
                    const dreamResult = this.handleDreamCell(playerId, cell);
                    if (dreamResult) {
                        Object.assign(result, dreamResult);
                    } else {
                        // Fallback if handleDreamCell returns nothing (e.g. My Dream handled inside)
                        result.action = 'dream_check';
                    }
                } else {
                    result.action = 'none';
                    // Если это просто обычная клетка - передаём ход
                    this.nextTurn();
                }
        }

        return result;
    }


    /**
     * Применить одиночный эффект (из выбора)
     */
    applyEffect(playerId, action, value, buff) {
        // Формируем объект данных как для processComplexEffect
        const effectData = {
            action,
            value,
            buff
        };
        this.processComplexEffect(playerId, effectData);
    }

    /**
     * Обработка эффектов из cells.json
     */
    processComplexEffect(playerId, data) {
        const player = this.players[playerId];
        const effects = data.effects || [data]; // Если массив эффектов или один объект

        effects.forEach(effect => {
            // Парсинг значения (может быть "50%")
            let value = effect.value;
            let numericValue = 0;

            if (typeof value === 'string' && value.includes('%')) {
                // Если процент, от чего? Обычно от наличных (savings) или investments?
                // По умолчанию считаем от wallet (kese) или savings.
                // "Хулиганы отобрали половину ДЕНЕГ". Обычно это про наличку.
                // Но у нас autoFinance.calculatedWallets...
                // Допустим, берем от savings.
                const percent = parseInt(value);
                const wallet = this.autoFinanceCards[playerId].calculatedWallets.savings || 0;
                numericValue = Math.round(wallet * (percent / 100));
            } else {
                numericValue = parseInt(value) || 0;
            }

            switch (effect.action) {
                case 'pay':
                    // Списание денег
                    this.applyMoneyChange(playerId, -numericValue, { savings: -numericValue });
                    break;

                case 'pay_from_savings':
                    this.applyMoneyChange(playerId, -numericValue, { savings: -numericValue });
                    break;

                case 'skip_turn':
                    // Пропуск хода
                    player.status.skippedTurns += numericValue;
                    if (this.logger) this.logger({ text: `${player.displayName} пропускает ${numericValue} ход(а)`, type: 'warning', playerId: playerId });
                    break;

                case 'block_income':
                    // Блокировка дохода
                    player.status.incomeBlockedTurns += numericValue;
                    if (this.logger) this.logger({ text: `Доход ${player.displayName} заблокирован на ${numericValue} ход(а)`, type: 'warning', playerId: playerId });
                    break;

                case 'multi_effect':
                    // Рекурсия? Или просто массив в effects
                    // Здесь мы уже итерируемся по effects если передали массив.
                    break;
            }
        });
    }

    /**
     * Обработка клетки "Мечта"
     */
    handleDreamCell(playerId, cell) {
        const player = this.players[playerId];
        if (!player.dream) {
            console.log(`⚠️ ${player.displayName} попал на мечту, но мечта не выбрана.`);
            // Автоматическая передача хода даже если ошибка
            this.nextTurn();
            return;
        }

        const autoFinance = this.autoFinanceCards[playerId];
        const price = cell.price || 0;

        // Определяем, совпадает ли клетка с мечтой игрока
        // cell.type: "dreamComputer", player.dream.id: "dreamComputer" (предполагаем совпадение ID)
        // Исключение: Disneyland всегда работает как мечта
        const isMyDream = (cell.type === player.dream.id) || (cell.type === 'dreamDisneyland');

        console.log(`🌟 Проверка мечты для ${player.displayName}: ${cell.name} (${price}č). CellType: ${cell.type}, MyDream: ${player.dream.id}`);

        if (isMyDream) {
            // === ЛОГИКА 1: ЭТО МОЯ МЕЧТА (или Диснейленд) ===
            const dreamWallet = autoFinance.calculatedWallets.dream || 0;

            let message = '';
            let isAlert = false;

            if (dreamWallet >= price) {
                // ПОКУПАЕМ!
                this.applyMoneyChange(playerId, -price, { dream: -price });

                // Добавляем в активы (как победу/мечту)
                player.assets.dream = cell.name;

                message = `🎉 УРА! ${player.displayName} исполнил свою мечту: ${cell.name}!`;
                isAlert = true;

                // Уведомление
                if (this.io) {
                    this.io.emit('game:notification', {
                        title: 'МЕЧТА ИСПОЛНЕНА!',
                        message: message,
                        playerName: player.displayName,
                        type: 'success'
                    });
                }
            } else {
                // Не хватает денег
                message = `😞 ${player.displayName} пока не может купить мечту (${cell.name}). Нужно ${price}č, есть ${dreamWallet}č.`;
                isAlert = true;
            }

            this.addToHistory({
                action: 'dream_check',
                actorId: playerId,
                actorName: player.displayName,
                details: {
                    message: message,
                    cellName: cell.name,
                    price: price,
                    wallet: dreamWallet,
                    isMyDream: true
                }
            });

            if (this.logger) {
                this.logger({ text: message, type: 'system', playerId: playerId, isAlert: isAlert });
            }

            // АВТОМАТИЧЕСКАЯ ПЕРЕДАЧА ХОДА ТОЛЬКО ДЛЯ "СВОЕЙ МЕЧТЫ"
            // Т.к. здесь нет выбора игрока
            this.nextTurn();

        } else {
            // === ЛОГИКА 2: ЭТО ЧУЖАЯ МЕЧТА -> КУПИТЬ КАК ТОВАР ===
            // Используем кошелек ИНВЕСТИЦИИ (по запросу)
            const investmentsWallet = autoFinance.calculatedWallets.investments || 0;

            console.log(`🛒 Чужая мечта. Баланс инвестиций: ${investmentsWallet}č. Цена: ${price}č`);

            if (investmentsWallet >= price) {
                // ПРЕДЛАГАЕМ КУПИТЬ
                // Убираем слово "Мечта " из названия для актива
                const cleanName = cell.name.replace(/^Мечта\s+/i, '');
                // Делаем первую букву заглавной
                const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

                // Возвращаем специальный action, который обработает вызывающий код в handleCell
                // НЕ вызываем nextTurn(), так как ждем выбора
                return {
                    action: 'offer_buy_dream_item',
                    price: price,
                    name: capitalizedName,
                    walletSource: 'investments',
                    isAsset: true
                };
            } else {
                const message = `🛒 ${player.displayName} мог бы купить ${cell.name}, но не хватает денег в инвестициях (${investmentsWallet}/${price}č).`;
                if (this.logger) this.logger({ text: message, type: 'info', playerId: playerId });

                // Если денег нет - просто проходим мимо
                this.nextTurn();

                return {
                    action: 'dream_check_fail',
                    message: message
                };
            }
        }
    }

    /**
     * Распределить месячный доход по копилкам
     */
    distributeMonthlyIncome(playerId, income) {
        const player = this.players[playerId]; // Получаем игрока для проверки статуса
        const autoFinance = this.autoFinanceCards[playerId];

        // Проверка блокировки дохода (например, после драки)
        if (player.status.incomeBlockedTurns > 0) {
            console.log(`🛑 Доход заблокирован для ${player.displayName} (осталось: ${player.status.incomeBlockedTurns})`);

            player.status.incomeBlockedTurns--;

            this.addToHistory({
                action: 'income_blocked',
                actorId: playerId,
                actorName: player.displayName,
                details: { message: 'Зарплата не начислена из-за штрафа' }
            });
            return; // ВЫХОДИМ, денег не даем
        }

        const distribution = {
            charity: Math.round(income * 0.1),      // 10%
            dream: Math.round(income * 0.2),        // 20%
            savings: Math.round(income * 0.1),      // 10%
            investments: Math.round(income * 0.6)   // 60%
        };

        // Добавить в автоматические копилки
        autoFinance.calculatedWallets.charity += distribution.charity;
        autoFinance.calculatedWallets.dream += distribution.dream;
        autoFinance.calculatedWallets.savings += distribution.savings;
        autoFinance.calculatedWallets.investments += distribution.investments;

        // Записать в историю доходов
        autoFinance.incomeHistory.push({
            timestamp: new Date().toISOString(),
            type: 'monthly_salary',
            amount: income,
            distribution
        });

        this.addToHistory({
            action: 'monthly_income_distributed',
            actorId: playerId,
            actorName: this.players[playerId].displayName,
            details: {
                income,
                distribution,
                message: `Получен месячный доход: ${income} соляров`
            },
            autoCalculated: {
                walletsBefore: { ...autoFinance.calculatedWallets },
                walletsAfter: { ...autoFinance.calculatedWallets }
            }
        });
    }

    /**
     * Вытянуть карточку
     */
    drawCard(playerId, cardType) {
        const card = cardService.drawCard(this.decks, cardType);
        const player = this.players[playerId];

        if (!card) {
            console.warn(`⚠️ Не удалось вытянуть карточку типа ${cardType}`);
            return null;
        }

        // Применить эффект карточки
        const effects = cardService.applyCardEffect(card, player, this);

        // === ОБРАБОТКА НАВЫКОВ ===

        // Если карточка ТРЕБУЕТ навык
        if (effects.requiresSkill) {
            // === СПЕЦИАЛЬНАЯ ЛОГИКА ДЛЯ НОВОСТЕЙ ===
            // Новости с навыками применяются ко ВСЕМ игрокам!
            if (cardType === 'news') {
                const skillRequired = effects.requiresSkill;
                const moneyAmount = effects.moneyChange;
                const skillName = this.getSkillDisplayName(skillRequired);

                // Список игроков получивших доход
                const playersRewarded = [];

                // Проверяем ВСЕХ игроков
                Object.keys(this.players).forEach(pid => {
                    if (this.hasSkill(pid, skillRequired)) {
                        // У игрока есть навык - начисляем ему доход
                        this.applyMoneyChange(pid, moneyAmount, { investments: moneyAmount });
                        playersRewarded.push(this.players[pid].displayName);
                        console.log(`✅ ${this.players[pid].displayName} получил ${moneyAmount}₴ за навык ${skillRequired}`);
                    }
                });

                // Формируем сообщение
                if (playersRewarded.length > 0) {
                    effects.message = `📢 Новость! Требуется ${skillName}. Доход получили: ${playersRewarded.join(', ')}`;
                    effects.skillCheckFailed = false;
                } else {
                    effects.message = `📢 Новость! Требуется ${skillName}. Ни у кого нет этого навыка.`;
                    effects.skillCheckFailed = true;
                }

                // Для новостей не начисляем деньги повторно активному игроку
                effects.moneyChange = 0;
                effects.newsAffectedAll = true;
                effects.playersRewarded = playersRewarded;

            } else {
                // === ОБЫЧНАЯ ЛОГИКА ДЛЯ ДРУГИХ КАРТОЧЕК ===
                if (!this.hasSkill(playerId, effects.requiresSkill)) {
                    // Навыка нет - НЕ начисляем деньги!
                    effects.moneyChange = 0;
                    effects.walletChanges = {};
                    effects.skillCheckFailed = true;
                    effects.message = `❌ У вас нет навыка "${this.getSkillDisplayName(effects.requiresSkill)}". Доход не зачислен!`;
                    console.log(`🚫 ${player.displayName} не имеет навыка ${effects.requiresSkill} - доход отклонён`);
                } else {
                    // Навык есть - начисляем деньги
                    effects.message = `✅ Навык "${this.getSkillDisplayName(effects.requiresSkill)}" использован! ${effects.message}`;
                    console.log(`✅ ${player.displayName} использовал навык ${effects.requiresSkill}`);
                }
            }
        }

        // === ПРОВЕРКА НАЛИЧИЯ АКТИВА ДЛЯ ПРОДАЖИ (NEWS) ===
        if (card.offer_asset_name) {
            const assetNameQuery = card.offer_asset_name.toLowerCase();
            // Ищем актив у игрока (частичное совпадение, т.к. может быть "Умные часы (50)")
            const asset = player.assets.items.find(item =>
                item.name.toLowerCase().includes(assetNameQuery)
            );

            if (asset) {
                // Актив есть - предлагаем продать
                effects.isSaleChoice = true;
                effects.salePrice = Math.abs(effects.moneyChange);
                effects.assetId = asset.id;
                effects.offerAssetName = asset.name; // Реальное имя актива у игрока

                // Убираем автоматическое начисление денег
                effects.moneyChange = 0;
                effects.message = `💰 Предложение: ${card.description_self || card.text}`;
            } else {
                // Актива нет - отмена эффекта
                effects.moneyChange = 0;
                effects.skillCheckFailed = true; // Используем этот флаг как "провал условия"
                effects.message = `❌ У вас нет актива "${card.offer_asset_name}", чтобы воспользоваться этим предложением.`;
                console.log(`🚫 ${player.displayName} не имеет актива ${card.offer_asset_name} - продажа невозможна`);
            }
        }

        // Обновить автоматические финансы (только если нет провала и не новость для всех)
        if (effects.moneyChange !== 0 && !effects.skillCheckFailed && !effects.newsAffectedAll) {
            // Fix: Pass description to applyMoneyChange so history shows "Salary" instead of "one_time_income"
            const desc = card.description_self || card.title || card.text || 'Событие';
            this.applyMoneyChange(playerId, effects.moneyChange, effects.walletChanges, desc);
        }

        // Если карточка ДАЁТ навык - добавляем игроку
        if (effects.skillGranted) {
            const added = this.addSkill(playerId, effects.skillGranted);
            if (added) {
                effects.message = `${effects.message} 📚 Получен навык: ${this.getSkillDisplayName(effects.skillGranted)}!`;
            } else {
                effects.message = `${effects.message} (Навык уже был получен ранее)`;
            }
        }

        // === БЛАГОТВОРИТЕЛЬНОСТЬ ===
        // Если карточка помечена как благотворительность - просто помечаем флаг для клиента
        // Списание денег произойдет ТОЛЬКО после подтверждения игроком (событие player:charity_choice)
        if (effects.isCharityAction) {
            effects.message = `${effects.message}`; // Сообщение пока без подтверждения
            effects.charityAmount = Math.abs(effects.moneyChange);

            // ВАЖНО: НЕ списываем деньги автоматически!
            // Обнуляем moneyChange чтобы не сработало стандартное начисление
            effects.moneyChange = 0;
        }

        this.addToHistory({
            action: 'card_drawn',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                cardType,
                cardId: card.id,
                cardText: card.description_self || card.title || card.text, // Fix: use description_self priority
                effects,
                message: effects.message,
                skillGranted: effects.skillGranted || null,
                skillCheckFailed: effects.skillCheckFailed || false
            }
        });

        // === ОБНОВИТЬ turnHistory с данными карточки ===
        // Последняя запись turnHistory - это текущий ход, обновим её
        if (player.turnHistory.length > 0) {
            const lastEntry = player.turnHistory[player.turnHistory.length - 1];
            lastEntry.cardTitle = card.title || card.id;
            // Сохраняем описание для отображения в истории
            lastEntry.cardDescription = card.description_self || card.text || card.description || '';
            lastEntry.amount = effects.moneyChange || 0;
        }

        console.log(`🃏 ${player.displayName} вытянул карточку: ${card.title}`);

        // === ДОБАВИТЬ ЭФФЕКТЫ К КАРТЕ (для отображения на клиенте) ===
        card.message = effects.message;
        card.skillCheckFailed = effects.skillCheckFailed || false;
        card.moneyChange = effects.moneyChange || 0;
        card.requiresSkill = effects.requiresSkill || null;

        // === ПЕРЕДАЧА ДАННЫХ ДЛЯ ПРОДАЖИ (НОВОСТИ) ===
        if (effects.isSaleChoice) {
            card.isSaleChoice = true;
            card.salePrice = effects.salePrice;
            card.assetId = effects.assetId;
            card.offerAssetName = effects.offerAssetName;
            // Сообщение для UI может быть другим, но оставим message
        }

        // === ПЕРЕДАЧА ДАННЫХ ДЛЯ ПОКУПКИ (БИЗНЕС/НАВЫКИ) ===
        if (effects.isPurchaseChoice) {
            card.isPurchaseChoice = true;
            card.purchasePrice = effects.purchasePrice;
            card.purchaseName = effects.purchaseName;
            card.purchaseIncome = effects.purchaseIncome;
            card.isAssetPurchase = effects.isAssetPurchase || false;
            card.skillGranted = effects.skillGranted || null; // Передаем ID навыка
        }

        // === ПЕРЕДАЧА ДАННЫХ ДЛЯ БЛАГОТВОРИТЕЛЬНОСТИ ===
        if (effects.isCharityAction) {
            card.isCharityChoice = true;
            card.charityAmount = Math.abs(effects.moneyChange); // Сумма пожертвования (положительная)
        }

        return card;
    }

    /**
     * Применить изменение денег
     * Если walletChanges пустой и это доход - автоматически распределяем:
     * 10% → charity, 10% → dream, 10% → savings, 70% → investments
     */
    /**
     * Применить изменение денег (с описанием)
     * @param {string} playerId
     * @param {number} amount
     * @param {object} walletChanges
     * @param {string} description - Описание транзакции (для логов)
     */
    applyMoneyChange(playerId, amount, walletChanges = {}, description = null) {
        const autoFinance = this.autoFinanceCards[playerId];
        if (!autoFinance) return;

        if (amount > 0) {
            // Доход
            autoFinance.incomeHistory.push({
                timestamp: new Date().toISOString(),
                type: description || 'one_time_income',
                amount
            });

            // === АВТОМАТИЧЕСКОЕ РАСПРЕДЕЛЕНИЕ ПО КОПИЛКАМ (ТОЛЬКО СЕРВЕР) ===
            if (Object.keys(walletChanges).length === 0) {
                walletChanges = {
                    charity: Math.round(amount * 0.10),
                    dream: Math.round(amount * 0.20),
                    savings: Math.round(amount * 0.10),
                    investments: Math.round(amount * 0.60)
                };
                console.log(`💰 Автораспределение дохода ${amount}₴: charity=${walletChanges.charity}, dream=${walletChanges.dream}, savings=${walletChanges.savings}, investments=${walletChanges.investments}`);
            }
        } else if (amount < 0) {
            // Расход
            autoFinance.expensesHistory.push({
                timestamp: new Date().toISOString(),
                type: description || 'expense', // Используем переданное описание
                amount: Math.abs(amount)
            });

            // Для расходов если не указано - берем из savings
            if (Object.keys(walletChanges).length === 0) {
                walletChanges = { savings: amount };
                console.log(`💸 Автосписание расхода ${Math.abs(amount)}₴ из savings`);
            }
        }

        // Применить изменения к копилкам
        Object.keys(walletChanges).forEach(wallet => {
            if (autoFinance.calculatedWallets[wallet] !== undefined) {
                autoFinance.calculatedWallets[wallet] += walletChanges[wallet];
            }
        });

        // === ЗАПИСЬ В currentTurnData ДЛЯ АВТОЗАПОЛНЕНИЯ ===
        const player = this.players[playerId]; // Ensure player is defined for currentTurnData access
        if (player && player.currentTurnData) {
            // Записываем изменения копилок
            Object.keys(walletChanges).forEach(wallet => {
                if (player.currentTurnData.walletChanges[wallet] !== undefined) {
                    player.currentTurnData.walletChanges[wallet] += walletChanges[wallet];
                }
            });

            // Записываем записи доходов/расходов
            const entryName = description || (amount > 0 ? 'Доход' : 'Расход');
            const entryAmount = Math.abs(amount);

            if (amount > 0) {
                // Доход
                player.currentTurnData.incomeEntries.push({
                    id: Date.now().toString() + Math.random(),
                    name: entryName,
                    amount: entryAmount,
                    timestamp: new Date().toISOString()
                });
            } else if (amount < 0) {
                // Расход
                player.currentTurnData.expenseEntries.push({
                    id: Date.now().toString() + Math.random(),
                    name: entryName,
                    amount: entryAmount,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }

    // ... (skipping mapCellTypeToCardType, addSkill, hasSkill, getSkillDisplayName, updatePlayerFinances, compareFinances, recordExpense)

    /**
     * Купить бизнес
     * @param {string} playerId
     * @param {object} businessData - { name, price, income (or cashflow) }
     * @returns {boolean}
     */
    buyBusiness(playerId, businessData) {
        const player = this.players[playerId];
        const autoFinance = this.autoFinanceCards[playerId];

        // Проверяем достаточность средств (из investments + savings)
        const totalAvailable = autoFinance.calculatedWallets.investments + autoFinance.calculatedWallets.savings;
        if (totalAvailable < businessData.price) {
            return { success: false, error: 'Недостаточно средств' };
        }

        // Списываем (forBusiness = true означает приоритет из investments)
        this.spendFromWallets(playerId, businessData.price, { forBusiness: true });

        // Нормализация дохода (income vs cashflow)
        let incomeAmount = businessData.income !== undefined ? businessData.income : (businessData.cashflow || 0);

        // Fix: Parse string income if needed (e.g. "80_monthly" -> 80)
        if (typeof incomeAmount === 'string') {
            incomeAmount = parseInt(incomeAmount) || 0;
        }

        // Добавляем бизнес игроку
        player.assets.businesses.push({
            id: Date.now().toString(),
            name: businessData.name,
            income: incomeAmount,
            price: businessData.price
        });

        // Добавляем к ежемесячному доходу
        autoFinance.calculatedMonthlyIncome += incomeAmount;
        autoFinance.calculatedBusinessCashFlow += incomeAmount;

        this.addToHistory({
            action: 'business_bought',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                business: businessData.name,
                price: businessData.price,
                income: incomeAmount,
                message: `Куплен бизнес: ${businessData.name}. Расход: ${businessData.price}₴. Доход: ${incomeAmount}₴/мес`
            },
            // Explicitly show negative amount in history column
            amount: -businessData.price
        });

        console.log(`🏢 ${player.displayName} купил бизнес: ${businessData.name} (Доход: ${incomeAmount})`);
        return { success: true };
    }

    /**
     * Сопоставить тип ячейки с типом карточки
     */
    mapCellTypeToCardType(cellType) {
        const mapping = {
            'chance': 'chance',
            'news': 'news',
            'expenses': 'expenses',
            'kidsBusiness': 'business'
        };
        return mapping[cellType] || 'chance';
    }

    /**
     * Добавить навык игроку
     */
    addSkill(playerId, skillName) {
        const player = this.players[playerId];
        if (!player) return false;

        // Проверяем, нет ли уже этого навыка
        if (!player.assets.skills.includes(skillName)) {
            player.assets.skills.push(skillName);

            // Логируем получение навыка
            this.addToHistory({
                action: 'skill_acquired',
                actorId: playerId,
                actorName: player.displayName,
                details: {
                    skill: skillName,
                    message: `Получен навык: ${this.getSkillDisplayName(skillName)}`
                }
            });

            console.log(`📚 ${player.displayName} получил навык: ${skillName}`);
            return true;
        }
        return false; // Навык уже есть
    }

    /**
     * Проверить наличие навыка у игрока
     */
    hasSkill(playerId, skillName) {
        const player = this.players[playerId];
        if (!player) return false;
        return player.assets.skills.includes(skillName);
    }

    /**
     * Получить читаемое название навыка
     */
    getSkillDisplayName(skillId) {
        const skillNames = {
            'translator_german': 'Переводчик (Немецкий)',
            'translator_french': 'Переводчик (Французский)',
            'translator_chinese': 'Переводчик (Китайский)',
            'translator_english': 'Переводчик (Английский)',
            'computer_repair': 'Ремонт компьютеров',
            'designer': 'Дизайнер',
            'smm': 'SMM-специалист',
            'web_designer': 'Веб-дизайнер'
        };
        return skillNames[skillId] || skillId;
    }

    /**
     * Обновить финансы игрока (введенные игроком)
     */
    updatePlayerFinances(playerId, financesData) {
        const player = this.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        player.playerEnteredFinances = {
            ...player.playerEnteredFinances,
            ...financesData
        };

        // Сравнить с автоматическими
        const comparison = this.compareFinances(playerId);

        this.addToHistory({
            action: 'player_entered_finances',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                enteredData: financesData,
                message: 'Игрок обновил финансовую карточку'
            },
            autoCalculated: comparison
        });

        return comparison;
    }

    /**
     * Сравнить финансы игрока с автоматическими
     */
    compareFinances(playerId) {
        const player = this.players[playerId];
        const autoFinance = this.autoFinanceCards[playerId];
        const entered = player.playerEnteredFinances;

        const discrepancies = [];

        // Сравнить копилки
        Object.keys(entered.wallets).forEach(wallet => {
            const enteredAmount = entered.wallets[wallet];
            const calculatedAmount = autoFinance.calculatedWallets[wallet];

            if (enteredAmount !== calculatedAmount) {
                discrepancies.push({
                    field: `wallets.${wallet}`,
                    entered: enteredAmount,
                    expected: calculatedAmount,
                    difference: enteredAmount - calculatedAmount
                });
            }
        });

        autoFinance.discrepancies = {
            hasDiscrepancies: discrepancies.length > 0,
            details: discrepancies
        };

        return {
            hasDiscrepancies: discrepancies.length > 0,
            discrepancies,
            entered: entered.wallets,
            expected: autoFinance.calculatedWallets
        };
    }

    // =========================================================================
    // WALLET MANAGEMENT METHODS (логика копилок)
    // =========================================================================

    /**
     * Собрать доход от всех бизнесов и активов игрока
     * Вызывается при попадании на клетку "Деньги"
     * @returns {number} - Общий собранный доход
     */
    collectBusinessIncome(playerId) {
        const player = this.players[playerId];
        const autoFinance = this.autoFinanceCards[playerId];
        if (!player) return 0;

        let totalIncome = 0;

        // Собираем доход от бизнесов
        // Бизнес имеет поле income или cashflow (ежемесячный доход)
        if (player.assets.businesses && player.assets.businesses.length > 0) {
            player.assets.businesses.forEach(business => {
                // Проверяем оба поля для совместимости
                const cashflow = Number(business.income) || Number(business.cashflow) || 0;
                totalIncome += cashflow;
            });
        }

        // TODO: Доход от других активов (skills, etc.) если таковые дают доход

        // Распределяем по правилам 10/20/10/60
        if (totalIncome > 0) {
            this.distributeMonthlyIncome(playerId, totalIncome);

            this.addToHistory({
                action: 'business_income_collected',
                actorId: playerId,
                actorName: player.displayName,
                details: {
                    totalIncome,
                    businessCount: player.assets.businesses?.length || 0,
                    message: `💰 ${player.displayName} собрал доход: ${totalIncome} монет`
                }
            });
        }

        return totalIncome;
    }

    /**
     * Умное списание денег с копилок
     * Приоритет: Savings (сбережения) -> потом равномерно с остальных
     * Charity и Dream НЕ трогаем для обычных расходов!
     * 
     * @param {string} playerId
     * @param {number} amount - Сумма к списанию (положительное число)
     * @param {object} options - { forCharity: bool, forDream: bool, forBusiness: bool }
     * @returns {boolean} - true если хватило денег
     */
    spendFromWallets(playerId, amount, options = {}) {
        const autoFinance = this.autoFinanceCards[playerId];
        const wallets = autoFinance.calculatedWallets;
        let remaining = amount;

        // ОСОБЫЙ СЛУЧАЙ: Траты ТОЛЬКО из Charity
        if (options.forCharity) {
            if (wallets.charity >= remaining) {
                wallets.charity -= remaining;
                return true;
            } else {
                return false; // Нехватка в копилке благотворительности
            }
        }

        // ОСОБЫЙ СЛУЧАЙ: Траты ТОЛЬКО из Dream
        if (options.forDream) {
            if (wallets.dream >= remaining) {
                wallets.dream -= remaining;
                return true;
            } else {
                return false; // Нехватка в копилке мечты
            }
        }

        // ОСОБЫЙ СЛУЧАЙ: Покупка бизнеса - сперва из Investments
        if (options.forBusiness) {
            // 1. Сначала из инвестиций
            if (wallets.investments >= remaining) {
                wallets.investments -= remaining;
                return true;
            } else {
                remaining -= wallets.investments;
                wallets.investments = 0;
            }
            // 2. Потом равномерно со Savings (и если не хватит - возвращаем false)
            if (wallets.savings >= remaining) {
                wallets.savings -= remaining;
                return true;
            } else {
                remaining -= wallets.savings;
                wallets.savings = 0;
            }
            // Если не хватает - возвращаем неуспех (можно добавить долг)
            return remaining <= 0;
        }

        // ОБЫЧНЫЙ РАСХОД: Сперва из Savings, потом равномерно
        // 1. Сначала из сбережений
        if (wallets.savings >= remaining) {
            wallets.savings -= remaining;
            this.recordExpense(playerId, amount, 'savings');
            return true;
        } else {
            remaining -= wallets.savings;
            wallets.savings = 0;
        }

        // 2. Потом равномерно из Investments (Charity и Dream не трогаем!)
        if (wallets.investments >= remaining) {
            wallets.investments -= remaining;
            this.recordExpense(playerId, amount, 'investments');
            return true;
        } else {
            remaining -= wallets.investments;
            wallets.investments = 0;
        }

        // Если не хватило - игрок в минусе (долг)
        if (remaining > 0) {
            // Записываем долг
            this.players[playerId].debts.push({
                amount: remaining,
                reason: 'expense_shortfall',
                timestamp: new Date().toISOString()
            });
            console.log(`⚠️ ${this.players[playerId].displayName} не хватило ${remaining} монет! Записан долг.`);
        }

        this.recordExpense(playerId, amount - remaining, 'mixed');
        return true; // Списали сколько могли
    }

    /**
     * Записать расход в историю
     */
    recordExpense(playerId, amount, source) {
        const autoFinance = this.autoFinanceCards[playerId];
        autoFinance.expensesHistory.push({
            timestamp: new Date().toISOString(),
            type: 'expense',
            amount,
            source
        });
    }

    /**
     * Купить бизнес
     * @param {string} playerId
     * @param {object} businessData - { name, price, cashflow }
     * @returns {boolean}
     */
    buyBusiness(playerId, businessData) {
        const player = this.players[playerId];
        const autoFinance = this.autoFinanceCards[playerId];

        // Проверяем достаточность средств (из investments + savings)
        const totalAvailable = autoFinance.calculatedWallets.investments + autoFinance.calculatedWallets.savings;
        if (totalAvailable < businessData.price) {
            return { success: false, error: 'Недостаточно средств' };
        }

        // Списываем (forBusiness = true означает приоритет из investments)
        this.spendFromWallets(playerId, businessData.price, { forBusiness: true });

        // Добавляем бизнес игроку
        player.assets.businesses.push({
            id: uuidv4(),
            name: businessData.name,
            price: businessData.price,
            cashflow: businessData.cashflow || 0,
            acquiredAt: new Date().toISOString()
        });

        // Обновляем кэшфлоу
        autoFinance.calculatedBusinessCashFlow += (businessData.cashflow || 0);

        this.addToHistory({
            action: 'business_purchased',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                businessName: businessData.name,
                price: businessData.price,
                cashflow: businessData.cashflow,
                message: `🏢 ${player.displayName} купил бизнес: ${businessData.name}`
            }
        });

        return { success: true, business: player.assets.businesses[player.assets.businesses.length - 1] };
    }

    /**
     * Установить логгер (функция отправки сообщений в сокет)
     */
    setLogger(callback) {
        this.logger = callback;
    }

    /**
     * Добавить в историю и отправить лог
     */
    addToHistory(entry) {
        this.gameHistory.push({
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            ...entry
        });

        // Отправляем лог клиентам, если логгер установлен
        if (this.logger && entry.details && entry.details.message) {
            // Формируем текст лога
            let logText = entry.details.message;

            let isAlert = false;

            // Если есть дополнительные детали, можно их добавить
            if (entry.action === 'turn_skipped') {
                logText = `🚫 ${entry.actorName} пропускает ход (осталось: ${entry.details.remainingSkips})`;
                isAlert = true;
            } else if (entry.action === 'income_blocked') {
                logText = `🛑 ${entry.actorName} лишен зарплаты (штраф)`;
                isAlert = true;
            }

            this.logger({
                text: logText,
                type: 'system', // или 'action' в зависимости от типа
                playerId: entry.actorId, // ID игрока
                isAlert: isAlert // Флаг важности для отображения уведомления
            });
        }
    }

    /**
     * Применить эффект к игроку (Основная логика правил)
     * @param {string} playerId - ID игрока
     * @param {string} action - Тип действия (pay, skip_turn, etc)
     * @param {number|string} value - Значение (сумма, кол-во ходов или "50%")
     * @param {object} options - Дополнительные параметры
     */
    applyEffect(playerId, action, value, options = {}) {
        const player = this.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        console.log(`⚡ Применяем эффект для ${player.displayName}: ${action} (${value})`);

        switch (action) {
            case 'pay':
                // Обычная оплата (value = число)
                // Если value строка с %, перенаправляем в pay_percent
                if (typeof value === 'string' && value.includes('%')) {
                    return this.applyEffect(playerId, 'pay_percent', value, options);
                }
                // Списываем через умную логику копилок
                // (Savings -> Investments, Charity и Dream не трогаем)
                this.spendFromWallets(playerId, Number(value), {
                    forCharity: options.forCharity || false,
                    forDream: options.forDream || false
                });
                break;

            case 'pay_percent':
                // Оплата процента от наличных (value = "50%")
                // В данной реализации у нас нет поля "cash", но есть calculatedWallets.
                // Будем считать от суммы всех копилок (или капитала)
                // Для простоты берем "Capital" (сумма всех кошельков)
                const autoFinance = this.autoFinanceCards[playerId];
                const totalCash = Object.values(autoFinance.calculatedWallets).reduce((a, b) => a + b, 0);

                const percent = parseInt(value); // "50%" -> 50
                const amountToPay = Math.round(totalCash * (percent / 100));

                // Списываем
                this.applyMoneyChange(playerId, -amountToPay);
                break;

            case 'skip_turn':
                // Пропуск хода
                player.status.skippedTurns += Number(value);
                console.log(`🚫 ${player.displayName} пропускает следующие ${value} хода`);
                break;

            case 'block_income':
                // Блокировка дохода на круги
                player.status.incomeBlockedTurns += Number(value);
                console.log(`🛑 ${player.displayName} лишен дохода на ${value} круга`);
                break;

            case 'pay_from_savings':
                // Оплата конкретно из копилки (Savings)
                // В нашей упрощенной модели applyMoneyChange распределяет расходы,
                // но можно сделать точечное списание.
                this.applyMoneyChange(playerId, -Number(value), { savings: -Number(value) });
                break;

            case 'multi_effect':
                // Несколько эффектов сразу (рекурсия)
                // Ожидаем, что value или options содержит массив эффектов
                const effects = options.effects || (Array.isArray(value) ? value : []);
                effects.forEach(effect => {
                    this.applyEffect(playerId, effect.action, effect.value, { ...options, ...effect });
                });
                break;

            case 'none':
            default:
                console.log('Нет эффекта или неизвестный эффект');
                break;
        }

        this.addToHistory({
            action: 'effect_applied',
            actorId: playerId,
            actorName: player.displayName,
            details: { action, value, message: `Применен эффект: ${action}` }
        });
    }

    /**
     * Рассчитать длительность игры
     */
    calculateGameDuration() {
        if (!this.startedAt) return 0;
        const end = this.finishedAt ? new Date(this.finishedAt) : new Date();
        const start = new Date(this.startedAt);
        return Math.round((end - start) / 1000 / 60); // минуты
    }

    /**
     * Сгенерировать отчет для куратора
     */
    generateReport() {
        return {
            gameInfo: {
                status: this.status,
                startedAt: this.startedAt,
                finishedAt: this.finishedAt,
                duration: this.calculateGameDuration()
            },
            curator: this.curator,
            players: this.players,
            autoFinanceCards: this.autoFinanceCards,
            gameHistory: this.gameHistory,
            statistics: this.calculateStatistics()
        };
    }

    /**
     * Рассчитать статистику
     */
    calculateStatistics() {
        return {
            totalPlayers: Object.keys(this.players).length,
            totalActions: this.gameHistory.length,
            totalDiceRolls: this.gameHistory.filter(h => h.action === 'roll_dice').length,
            totalCardsDrawn: this.gameHistory.filter(h => h.action === 'card_drawn').length
        };
    }

    /**
     * Получить текущее состояние для клиентов
     */
    getState() {
        return {
            status: this.status,
            startedAt: this.startedAt,
            curator: this.curator,
            players: this.players,
            currentTurn: this.currentTurn,
            hostPlayerId: this.hostPlayerId // ID игрока-хоста
        };
    }

    /**
     * Удалить игрока (при отключении)
     */
    removePlayer(playerId) {
        const player = this.players[playerId];
        if (player) {
            const wasHost = (this.hostPlayerId === playerId);

            this.addToHistory({
                action: 'player_disconnected',
                actorId: playerId,
                actorName: player.displayName,
                details: { message: 'Игрок отключился' }
            });

            console.log(`❌ Игрок отключился: ${player.displayName}`);

            // Полностью удаляем игрока
            delete this.players[playerId];
            delete this.autoFinanceCards[playerId];

            // === ПЕРЕДАЧА ХОСТА ===
            if (wasHost) {
                const remainingPlayers = Object.values(this.players);
                if (remainingPlayers.length > 0) {
                    // Найти игрока с минимальным playerNumber
                    const nextHost = remainingPlayers.reduce((min, p) =>
                        (p.playerNumber < min.playerNumber) ? p : min
                    );
                    this.hostPlayerId = nextHost.id;
                    console.log(`👑 Хост передан: ${nextHost.displayName}`);
                } else {
                    this.hostPlayerId = null;
                }
            }
        }
    }

    /**
     * Выбрать мечту для игрока
     */
    selectDream(playerId, dreamData) {
        const player = this.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        if (player.dream) {
            throw new Error('Мечта уже выбрана! Нельзя изменить.');
        }

        player.dream = {
            id: dreamData.id,
            price: parseInt(dreamData.price),
            name: dreamData.name
        };

        this.addToHistory({
            action: 'dream_selected',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                dreamName: player.dream.name,
                price: player.dream.price,
                message: `${player.displayName} выбрал мечту: ${player.dream.name} (${player.dream.price} ₸)`
            }
        });

        console.log(`⭐ ${player.displayName} выбрал мечту: ${player.dream.name}`);
        return player.dream;
    }

    /**
     * Получить ID текущего хоста
     */
    getHostPlayerId() {
        return this.hostPlayerId;
    }

    /**
     * Проверить, является ли игрок хостом
     */
    isHost(playerId) {
        return this.hostPlayerId === playerId;
    }
}

module.exports = new GameState();