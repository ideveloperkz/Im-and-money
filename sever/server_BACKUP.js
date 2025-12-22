require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const gameState = require('./models/GameState');
const board = require('./board');
const cellsData = require('./data/cells.json');

// Конфигурация
const PORT = process.env.PORT || 8080;
const GAME_PASSWORD = process.env.GAME_PASSWORD || 'game';

// Создать HTTP сервер
const server = http.createServer();

// Создать Socket.IO сервер
const io = new Server(server, {
    cors: {
        origin: "*", // В продакшене указать конкретный домен
        methods: ["GET", "POST"]
    }
});

console.log('🚀 Сервер запускается...');
console.log(`📝 Пароль игры: ${GAME_PASSWORD}`);

// Хелпер для логов
const broadcastGameLog = (logData) => {
    io.emit('game:log', logData);
};

// === ТАЙМЕРА ХОДА (3 минуты) ===
const TURN_TIMEOUT_MS = 3 * 60 * 1000; // 3 минуты
const turnTimers = {}; // { playerId: timerId }

// Функция установки таймера на ход
function startTurnTimer(playerId) {
    // Очищаем предыдущий таймер если есть
    if (turnTimers[playerId]) {
        clearTimeout(turnTimers[playerId]);
    }

    turnTimers[playerId] = setTimeout(() => {
        const player = gameState.players[playerId];
        if (player && gameState.currentPlayer === playerId) {
            // Время вышло - помечаем игрока как спящего
            player.isSleeping = true;
            console.log(`💤 ${player.displayName} уснул (таймаут 3 минуты)`);

            io.emit('game:log', {
                text: `💤 ${player.displayName} уснул - время хода истекло!`,
                type: 'warning'
            });

            io.emit('game:player_sleeping', { playerId, playerName: player.displayName });

            // Передаём ход следующему
            gameState.nextTurn();
            io.emit('game:state_update', gameState.getState());
        }
    }, TURN_TIMEOUT_MS);

    console.log(`⏱️ Таймер хода запущен для ${gameState.players[playerId]?.displayName} (3 мин)`);
}

// Функция отмены таймера
function clearTurnTimer(playerId) {
    if (turnTimers[playerId]) {
        clearTimeout(turnTimers[playerId]);
        delete turnTimers[playerId];
    }
}

// Внедряем логгер в GameState
gameState.setLogger(broadcastGameLog);

/**
 * Подключение клиента
 */
io.on('connection', (socket) => {
    console.log(`🔌 Новое подключение: ${socket.id}`);

    let playerId = null;
    let isCurator = false;

    /**
     * АВТОРИЗАЦИЯ: Вход игрока
     */
    socket.on('player:auth', (data, callback) => {
        const { name, password } = data;

        // Проверка пароля
        if (password !== GAME_PASSWORD) {
            console.warn(`⛔ Неверный пароль от ${name}`);
            callback({
                success: false,
                error: 'Неверный пароль'
            });
            return;
        }

        try {
            // Проверка статуса игры
            if (gameState.status === 'finished') {
                callback({
                    success: false,
                    error: 'Игра завершена. Дождитесь новой игры.'
                });
                return;
            }

            // 1. РЕГИСТРАЦИЯ ИГРОКА (СЕРВЕР)
            // Здесь мы добавляем данные нового игрока в глобальное состояние (GameState)
            // Мы сохраняем его имя, socketId для связи и назначаем начальную позицию.
            const player = gameState.addPlayer({
                name,
                socketId: socket.id
            });

            playerId = player.id;

            console.log(`✅ Игрок авторизован: ${player.displayName}`);

            // Отправить данные игроку
            callback({
                success: true,
                player,
                gameState: gameState.getState()
            });

            // 2. УВЕДОМЛЕНИЕ ВСЕХ (СЕРВЕР)
            // После успешного добавления, мы отправляем событие 'game:state_update' 
            // ВСЕМ подключенным клиентам (io.emit). Это заставит их фронтенд перерисоваться
            // и показать новую фигурку.
            io.emit('game:state_update', gameState.getState());

            // Уведомить куратора
            if (gameState.curator.socketId) {
                io.to(gameState.curator.socketId).emit('curator:player_joined', player);
            }

        } catch (error) {
            console.error('❌ Ошибка авторизации игрока:', error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * АВТОРИЗАЦИЯ: Вход куратора
     */
    socket.on('curator:auth', (data, callback) => {
        const { name, password } = data;
        const CURATOR_PASSWORD = process.env.CURATOR_PASSWORD || 'curator';

        // Проверка пароля
        if (password !== CURATOR_PASSWORD) {
            console.warn(`⛔ Неверный пароль куратора от ${name}`);
            callback({
                success: false,
                error: 'Неверный пароль куратора'
            });
            return;
        }

        try {
            // Подключить куратора
            const curator = gameState.connectCurator({
                name,
                socketId: socket.id
            });

            isCurator = true;

            console.log(`✅ Куратор авторизован: ${curator.name}`);

            callback({
                success: true,
                curator,
                gameState: gameState.getState(),
                report: gameState.generateReport()
            });

        } catch (error) {
            console.error('❌ Ошибка авторизации куратора:', error.message);
            callback({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Начать игру (может любой игрок)
     */
    socket.on('curator:start_game', (callback) => {
        // Убрана проверка на куратора - теперь любой может начать игру

        try {
            const result = gameState.startGame();

            console.log('🎮 Игра начата');

            callback({ success: true, result });

            // Уведомить всех
            io.emit('game:started', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка начала игры:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * Завершить игру (куратор или хост)
     */
    socket.on('curator:end_game', (callback) => {
        // Разрешаем завершить игру куратору ИЛИ хосту
        const isHost = playerId && gameState.isHost(playerId);

        if (!isCurator && !isHost) {
            callback({ success: false, error: 'Только куратор или хост может завершить игру' });
            return;
        }

        try {
            const report = gameState.endGame();
            const endedBy = isCurator ? 'Куратор' : gameState.players[playerId]?.displayName || 'Хост';

            console.log(`🏁 ${endedBy} завершил игру`);

            callback({ success: true, report });

            // Уведомить ВСЕХ о завершении игры и выкинуть из комнаты
            io.emit('game:force_disconnect', {
                message: `Игра завершена! ${endedBy} завершил игру. Страница будет перезагружена.`,
                reason: 'game_ended'
            });

            // Отключить все сокеты через 2 секунды (дать время показать сообщение)
            setTimeout(() => {
                // Сбросить состояние игры
                gameState.reset();
                console.log('🔄 Состояние игры сброшено');

                // Принудительно отключить все сокеты
                io.disconnectSockets(true);
                console.log('👋 Все игроки отключены');
            }, 2000);

        } catch (error) {
            console.error('❌ Ошибка завершения игры:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Запрос на бросок кубика
     */
    socket.on('player:request_roll', (callback) => {
        if (!playerId) return;

        // Проверка статуса игры
        if (gameState.status !== 'in_progress') {
            if (callback) callback({ success: false, error: 'Игра не начата' });
            return;
        }

        // Проверка очереди
        // Проверка очереди
        if (gameState.currentTurn !== playerId) {
            console.log(`🚫 Игрок ${playerId} пытался бросить кубик не в свой ход`);
            if (callback) callback({ success: false, error: 'Сейчас не ваш ход' });
            return;
        }

        const player = gameState.players[playerId];

        // === ВАЖНО: Игрок обязан выбрать мечту перед началом игры (первым ходом) ===
        if (!player.dream) {
            if (callback) callback({ success: false, error: '⛔ Выберите МЕЧТУ в финансовой карточке перед тем, как ходить!' });
            return;
        }

        // === БЛОКИРОВКА: Игрок должен заполнить карточку после хода ===
        // Пропускаем проверку на первом ходу (когда turnHistory пуста)
        if (player.turnHistory.length > 0 && !player.cardFilledThisTurn) {
            if (callback) callback({ success: false, error: '⛔ Заполните финансовую карточку перед следующим ходом! (Нажмите "Подтвердить" в карточке)' });
            return;
        }

        // Сбросить флаг для следующего хода
        player.cardFilledThisTurn = false;

        // Проверка: Если на развилке, нужно сперва монетку?
        // Assuming global 'board' is available in context or via gameState
        if (board[player.position.currentCell].type === 'fork') {
            if (player.forkDirection === null || player.forkDirection === undefined) {
                if (callback) callback({ success: false, error: 'Сначала подбросьте монетку!' });
                return;
            }
        }

        try {
            const result = gameState.rollDice(playerId);

            // Предсказать, куда попадет игрок, чтобы клиент мог подсветить
            const prediction = gameState.predictMove(playerId, result);

            callback({ success: true, result });

            // Уведомить всех о броске (с предсказанием)
            io.emit('player:dice_rolled', {
                playerId,
                playerName: gameState.players[playerId].displayName,
                result,
                prediction
            });

            // LOG
            io.emit('game:log', {
                text: `${gameState.players[playerId].displayName} выбросил 🎲 ${result}`,
                type: 'system'
            });

            // === ЗАПУСК ТАЙМЕРА ХОДА (3 минуты) ===
            startTurnTimer(playerId);

            // Задержка перед ходом (анимация)
            // Клиент сам запросит move или мы ждем?
            // "игрок нажал на клетку, фигурка переместилась" -> Клиент шлет player:move.

        } catch (error) {
            console.error('❌ Ошибка броска:', error.message);
            if (callback) callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Подтверждение броска (OK)
     */
    socket.on('player:confirm_dice', (callback) => {
        // Уведомляем всех закрыть модалку
        io.emit('game:hide_dice_modal');
        if (callback) callback({ success: true });
    });

    /**
     * ИГРОК: Переместиться
     */
    socket.on('player:move', (data, callback) => {
        if (!playerId) {
            callback({ success: false, error: 'Не авторизован' });
            return;
        }

        const { steps } = data;

        if (gameState.currentTurn !== playerId) {
            callback({ success: false, error: 'Сейчас не ваш ход' });
            return;
        }

        try {
            const result = gameState.movePlayer(playerId, steps);

            console.log(`🚶 ${gameState.players[playerId].displayName} переместился`);

            // === ОТМЕНЯЕМ ТАЙМЕР ХОДА ===
            clearTurnTimer(playerId);

            callback({ success: true, result });

            // 1. Уведомить ВСЕХ о перемещении (только анимация и позиция)
            io.emit('player:moved', {
                playerId,
                playerName: gameState.players[playerId].displayName,
                position: gameState.players[playerId].position,
                cellResult: result, // Восстановлено для логики развилок
                passedMoneyCells: result.passedMoneyCells || [] // Клетки "Деньги" через которые прошел игрок
            });

            // LOG перемещения
            io.emit('game:log', {
                text: `${gameState.players[playerId].displayName} переместился на ${result.cellName || 'новую клетку'}`,
                type: 'system'
            });

            // 2. ОБРАБОТКА ЭФФЕКТОВ КЛЕТКИ (Dual Description & Logic)

            // === НОВОЕ: Обработка динамических экшенов из GameState (Мечта-Товар) ===
            // Если GameState вернул специальный экшен, мы его приоритезируем
            if (result.action === 'offer_buy_dream_item') {
                const cellData = cellsData[result.cellId] || {}; // Берем базу для картинки и тайтла

                // Формируем кастомное событие покупки
                socket.emit('game:cell_event', {
                    title: `КУПИТЬ ${result.name.toUpperCase()}`,
                    description: `Вы попали на чужую мечту (${result.name}). Вы можете купить этот предмет как актив, используя средства Инвестиций.`,
                    action: 'purchase_choice', // Клиент знает что делать с choice
                    value: result.price,
                    // Данные для кнопок покупки (deckanimation.js)
                    purchasePrice: result.price,
                    purchaseName: result.name,
                    isAssetPurchase: true,
                    walletSource: result.walletSource, // 'investments'
                    img: cellData.image || null
                });

                // Уведомление другим
                socket.broadcast.emit('game:notification', {
                    title: 'ВОЗМОЖНОСТЬ ПОКУПКИ',
                    message: `${gameState.players[playerId].displayName} рассматривает покупку: ${result.name}`,
                    playerName: gameState.players[playerId].displayName,
                    type: 'info'
                });

            } else if (result.action === 'monthly_income') {
                // === КЛЕТКА ДЕНЬГИ (АВТОМАТИЧЕСКАЯ ОБРАБОТКА) ===
                // GameState уже начислил деньги и переключил ход
                const income = result.moneyChange || 0;
                const player = gameState.players[playerId];

                if (income > 0) {
                    // Успех
                    socket.emit('game:notification', {
                        title: 'ДЕНЬГИ',
                        message: `💰 Вы получили доход: ${income}₽`,
                        type: 'success'
                    });

                    socket.broadcast.emit('game:notification', {
                        title: 'ДЕНЬГИ',
                        message: `💰 ${player.displayName} получил доход: ${income}₽`,
                        playerName: player.displayName,
                        type: 'success'
                    });
                } else {
                    // Нет дохода (0)
                    socket.emit('game:notification', {
                        title: 'ДЕНЬГИ',
                        message: `📭 У вас нет бизнесов. Доход: 0₽`,
                        type: 'warning'
                    });

                    socket.broadcast.emit('game:notification', {
                        title: 'ДЕНЬГИ',
                        message: `📭 У ${player.displayName} нет бизнесов. Доход: 0₽`,
                        playerName: player.displayName,
                        type: 'info'
                    });
                }

            } else {
                // СТАНДАРТНАЯ ЛОГИКА (из JSON)
                const cellId = result.cellId; // 'cell-13', etc.
                const cellData = cellsData[cellId] || cellsData[cellId.replace('cell-', '')];

                if (cellData) {
                    const player = gameState.players[playerId];

                    // Подготовка текстов
                    const descSelf = cellData.description_self;
                    const descOthers = cellData.description_others.replace('{player}', player.displayName).replace('{Player}', player.displayName);

                    // A. Личное событие игроку (с выбором или действием)
                    socket.emit('game:cell_event', {
                        title: cellData.title,
                        description: descSelf,
                        action: cellData.action,
                        value: cellData.value,
                        options: cellData.options, // Для choice
                        effects: cellData.effects, // Для multi_effect
                        img: cellData.image || null
                    });

                    // B. Публичное уведомление остальным
                    socket.broadcast.emit('game:notification', {
                        title: cellData.title,
                        message: descOthers,
                        playerName: player.displayName, // Добавлено для отображения в модальном окне наблюдателей
                        type: 'info' // или 'warning' если негативное
                    });

                    console.log(`📍 Event processing for ${cellId}: ${cellData.action}`);

                } else {
                    // Если клетки нет в JSON, но есть базовая логика (например, Start)
                    // Можно отправить дефолтное событие или ничего не делать (игрок просто закончит ход)
                    socket.emit('game:cell_event', {
                        title: result.cellName || 'Клетка',
                        description: 'Вы попали на обычную клетку.',
                        action: 'none'
                    });
                }
            }

            // Обновить состояние (деньги, позиция и т.д. могли измениться в movePlayer, но основные эффекты будут после выбора)
            io.emit('game:state_update', gameState.getState());

            // Обновить куратора
            if (gameState.curator.socketId) {
                io.to(gameState.curator.socketId).emit('curator:history_update',
                    gameState.gameHistory[gameState.gameHistory.length - 1]
                );
            }

        } catch (error) {
            console.error('❌ Ошибка перемещения:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Сделал выбор (Choice)
     */
    socket.on('player:choice_made', (data, callback) => {
        if (!playerId || gameState.currentTurn !== playerId) return;

        const { optionIndex, cellId } = data;
        // Здесь должна быть логика применения эффекта выбранной опции
        // Для простоты, мы доверяем клиенту прислать action и value выбранной опции, 
        // ИЛИ (надежнее) берем из cells.json по индексу.

        // Давайте брать из cells.json
        const cellData = cellsData[cellId] || cellsData[cellId.replace('cell-', '')];
        if (!cellData || cellData.action !== 'choice' || !cellData.options[optionIndex]) {
            callback({ success: false, error: 'Invalid choice' });
            return;
        }

        const selectedOption = cellData.options[optionIndex];
        const player = gameState.players[playerId];
        console.log(`🤔 ${player.displayName} выбрал: ${selectedOption.text}`);

        try {
            // Применяем эффект
            gameState.applyEffect(playerId, selectedOption.action, selectedOption.value, selectedOption.buff);

            // Сообщение в чат
            io.emit('game:chat_message', {
                sender: 'Система',
                message: `${player.displayName} выбрал: ${selectedOption.text}`,
                timestamp: new Date().toISOString(),
                isSystem: true
            });

            // Уведомление всем игрокам (4 секунды)
            io.emit('game:notification', {
                title: cellData.title,
                message: `${player.displayName} выбрал: ${selectedOption.text}`,
                playerName: player.displayName,
                type: 'info'
            });

            // АВТОМАТИЧЕСКАЯ ПЕРЕДАЧА ХОДА ПОСЛЕ ВЫБОРА
            gameState.nextTurn();

            // Обновляем состояние
            io.emit('game:state_update', gameState.getState());

            callback({ success: true });

        } catch (e) {
            console.error('Error applying choice:', e);
            callback({ success: false, error: e.message });
        }
    });

    /**
     * ИГРОК: Завершить ход (явно)
     */
    socket.on('player:finish_turn', (callback) => {
        if (!playerId || gameState.currentTurn !== playerId) return;

        console.log(`🏁 ${gameState.players[playerId].displayName} завершает ход`);
        gameState.nextTurn();

        io.emit('game:state_update', gameState.getState());

        if (callback) callback({ success: true });
    });

    /**
     * ИГРОК: Запросить карманные деньги (за прохождение через клетку "Деньги")
     */
    socket.on('player:claim_pocket_money', (data, callback) => {
        if (!playerId) {
            if (callback) callback({ success: false, error: 'Не авторизован' });
            return;
        }

        const { cellKey } = data;
        const player = gameState.players[playerId];

        if (!player || !player.passedMoneyCells) {
            if (callback) callback({ success: false, error: 'Нет доступных клеток для получения денег' });
            return;
        }

        // Проверяем, что клетка была пройдена
        const cellIndex = player.passedMoneyCells.indexOf(cellKey);
        if (cellIndex === -1) {
            if (callback) callback({ success: false, error: 'Эта клетка не была пройдена' });
            return;
        }

        // === РАССЧИТАТЬ ДОХОД ОТ ВСЕХ БИЗНЕСОВ ===
        let totalBusinessIncome = 0;
        const businesses = player.assets?.businesses || [];

        if (businesses.length > 0) {
            businesses.forEach(biz => {
                const income = Number(biz.income) || Number(biz.cashflow) || 0;
                totalBusinessIncome += income;
            });
            console.log(`🏪 Доход от ${businesses.length} бизнесов: ${totalBusinessIncome}₴`);
        }

        // Удаляем клетку из списка (деактивируем)
        player.passedMoneyCells.splice(cellIndex, 1);

        // Если нет бизнесов или дохода
        if (totalBusinessIncome === 0) {
            io.emit('game:log', {
                text: `📭 ${player.displayName}: Нет активных бизнесов - доход 0`,
                type: 'info'
            });
            console.log(`📭 ${player.displayName}: нет бизнесов - доход 0 за ${cellKey}`);
            if (callback) callback({ success: true, amount: 0, remainingCells: player.passedMoneyCells });
            io.emit('game:state_update', gameState.getState());
            return;
        }

        // Применяем доход (автораспределение 10/20/10/60)
        gameState.applyMoneyChange(playerId, totalBusinessIncome);

        console.log(`💰 ${player.displayName} получил ${totalBusinessIncome}₴ от бизнесов за ${cellKey}`);

        // Логируем
        io.emit('game:log', {
            text: `💰 ${player.displayName} получил ${totalBusinessIncome}₴ от бизнесов`,
            type: 'success'
        });

        // Обновляем состояние
        io.emit('game:state_update', gameState.getState());

        if (callback) callback({
            success: true,
            amount: totalBusinessIncome,
            remainingCells: player.passedMoneyCells
        });
    });



    /**
     * ИГРОК: Закрыть глобальное окно (у всех)
     */
    socket.on('player:close_window', (data) => {
        // Проверяем, что это активный игрок командует
        if (gameState.currentTurn === playerId) {
            io.emit('game:close_all_windows');
        }
    });

    /**
     * ИГРОК: Обновить финансовую карточку
     */
    /**
     * ИГРОК: Обновить финансовую карточку (LEGACY/COMPATIBILITY)
     */
    socket.on('player:update_finances', (data, callback) => {
        // ... (Keep existing logic if needed, or redirect)
        if (!playerId) return callback({ success: false, error: 'Auth' });
        try {
            const comparison = gameState.updatePlayerFinances(playerId, data);
            callback({ success: true, comparison });
        } catch (e) {
            callback({ success: false, error: e.message });
        }
    });

    /**
     * === NEW: PURE MANUAL DATA HANDLERS ===
     */

    /**
     * ИГРОК: Обновить значения копилок (Ручной ввод)
     */
    socket.on('player:update_wallets', (wallets, callback) => {
        if (!playerId || !gameState.players[playerId]) return;

        const player = gameState.players[playerId];
        // Валидация и защита типов
        player.playerEnteredFinances.wallets = {
            charity: Number(wallets.charity) || 0,
            dream: Number(wallets.dream) || 0,
            savings: Number(wallets.savings) || 0,
            investments: Number(wallets.investments) || 0
        };

        console.log(`📝 ${player.displayName} обновил ручные копилки.`);

        // Можно запустить проверку расхождений здесь или отложить
        if (callback) callback({ success: true });
    });

    /**
     * ИГРОК: Добавить запись дохода (Ручной ввод)
     */
    socket.on('player:add_income', (entry, callback) => {
        if (!playerId || !gameState.players[playerId]) return;
        const player = gameState.players[playerId];

        const newEntry = {
            id: Date.now().toString(),
            name: entry.name || 'Доход',
            amount: Number(entry.amount) || 0,
            timestamp: new Date().toISOString()
        };

        player.playerEnteredFinances.incomeEntries.push(newEntry);
        console.log(`📝 ${player.displayName} добавил ручной доход: ${newEntry.name}`);

        if (callback) callback({ success: true, entry: newEntry });
    });

    /**
     * ИГРОК: Добавить запись расхода (Ручной ввод)
     */
    socket.on('player:add_expense', (entry, callback) => {
        if (!playerId || !gameState.players[playerId]) return;
        const player = gameState.players[playerId];

        const newEntry = {
            id: Date.now().toString(),
            name: entry.name || 'Расход',
            amount: Number(entry.amount) || 0,
            timestamp: new Date().toISOString()
        };

        player.playerEnteredFinances.expenseEntries.push(newEntry);
        console.log(`📝 ${player.displayName} добавил ручной расход: ${newEntry.name}`);

        if (callback) callback({ success: true, entry: newEntry });
    });

    /**
     * ИГРОК: Автозаполнение текущего хода
     */
    socket.on('player:autofill_current_turn', (data, callback) => {
        if (!playerId || !gameState.players[playerId]) {
            callback({ success: false, error: 'Игрок не найден' });
            return;
        }

        const player = gameState.players[playerId];
        const currentTurn = player.currentTurnData;

        if (!currentTurn) {
            callback({ success: false, error: 'Нет данных текущего хода' });
            return;
        }

        try {
            let addedIncome = 0;
            let addedExpenses = 0;

            // Копируем записи доходов
            if (currentTurn.incomeEntries && currentTurn.incomeEntries.length > 0) {
                currentTurn.incomeEntries.forEach(entry => {
                    player.playerEnteredFinances.incomeEntries.push({
                        ...entry,
                        id: Date.now().toString() + Math.random() // Новый ID
                    });
                    addedIncome += entry.amount;
                });
            }

            // Копируем записи расходов
            if (currentTurn.expenseEntries && currentTurn.expenseEntries.length > 0) {
                currentTurn.expenseEntries.forEach(entry => {
                    player.playerEnteredFinances.expenseEntries.push({
                        ...entry,
                        id: Date.now().toString() + Math.random() // Новый ID
                    });
                    addedExpenses += entry.amount;
                });
            }

            // Прибавляем изменения копилок
            if (currentTurn.walletChanges) {
                for (const [wallet, change] of Object.entries(currentTurn.walletChanges)) {
                    if (player.playerEnteredFinances.wallets[wallet] !== undefined) {
                        player.playerEnteredFinances.wallets[wallet] += change;
                    }
                }
            }

            console.log(`⚡ ${player.displayName} автозаполнил текущий ход: +${addedIncome}₴ доходов, +${addedExpenses}₴ расходов`);

            // Обновляем состояние
            io.emit('game:state_update', gameState.getState());

            callback({
                success: true,
                addedIncome,
                addedExpenses,
                incomeCount: currentTurn.incomeEntries.length,
                expenseCount: currentTurn.expenseEntries.length
            });

        } catch (error) {
            console.error('❌ Ошибка автозаполнения:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Выбрать мечту
     */
    socket.on('player:select_dream', (data, callback) => {
        if (!playerId) {
            callback({ success: false, error: 'Не авторизован' });
            return;
        }

        try {
            const { id, price, name } = data;
            const dream = gameState.selectDream(playerId, { id, price, name });

            callback({ success: true, dream });

            // Уведомить всех (чтобы в логах появилось)
            io.emit('game:log', {
                text: `${gameState.players[playerId].displayName} выбрал мечту: ${name}`,
                type: 'system'
            });

            // Обновить состояние
            io.emit('game:state_update', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка выбора мечты:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Купить бизнес
     */
    socket.on('player:buy_business', (data, callback) => {
        if (!playerId) {
            callback({ success: false, error: 'Не авторизован' });
            return;
        }

        try {
            const result = gameState.buyBusiness(playerId, data);

            if (result.success) {
                callback({ success: true, business: result.business });

                // Уведомить всех
                io.emit('game:log', {
                    text: `🏢 ${gameState.players[playerId].displayName} купил бизнес: ${data.name}`,
                    type: 'action'
                });

                // Обновить состояние
                io.emit('game:state_update', gameState.getState());
            } else {
                callback({ success: false, error: result.error });
            }
        } catch (error) {
            console.error('❌ Ошибка покупки бизнеса:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Вытянуть карточку из колоды (напрямую)
     */
    socket.on('player:draw_card_from_deck', (data, callback) => {
        if (!playerId) {
            callback({ success: false, error: 'Не авторизован' });
            return;
        }

        if (gameState.status !== 'in_progress') {
            callback({ success: false, error: 'Игра не начата' });
            return;
        }

        const { deckId } = data;
        let cardType = 'chance';

        // Маппинг ID колод на типы карточек
        switch (String(deckId)) {
            case '1': cardType = 'expenses'; break;
            case '2': cardType = 'business'; break;
            case '3': cardType = 'news'; break;
            case '4': cardType = 'chance'; break;
            default:
                callback({ success: false, error: 'Неизвестная колода' });
                return;
        }

        // ВАЛИДАЦИЯ: Проверяем, стоит ли игрок на клетке этого типа
        // (Исключение: kidsBusiness на доске = business колоде)
        const playerCellType = gameState.players[playerId].position.currentCellType;

        let valid = false;
        if (playerCellType === cardType) valid = true;

        // Маппинг для KidsBusiness -> Business
        if (playerCellType === 'kidsBusiness' && cardType === 'business') valid = true;

        if (!valid) {
            console.warn(`🛑 Игрок ${gameState.players[playerId].displayName} пытается взять карту ${cardType}, но стоит на ${playerCellType}`);
            callback({ success: false, error: 'Вы не стоите на клетке этого типа!' });
            return;
        }

        try {
            // === ДЕАКТИВИРОВАТЬ КЛЕТКИ "ДЕНЬГИ" ===
            // Игрок нажал на колоду - он потерял возможность забрать деньги
            if (gameState.players[playerId].passedMoneyCells?.length > 0) {
                console.log(`💸 ${gameState.players[playerId].displayName} потерял возможность забрать деньги с ${gameState.players[playerId].passedMoneyCells.length} клеток`);
                gameState.players[playerId].passedMoneyCells = [];
            }

            const card = gameState.drawCard(playerId, cardType);

            if (!card) {
                callback({ success: false, error: 'Не удалось вытянуть карточку' });
                return;
            }

            // === REMOVED SPECIAL LOGIC: News #29 (Phone Auto Sell) ===
            // This is now handled generically by gameState.drawCard() which checks offer_asset_name
            // for ALL news cards and sets appropriate flags (isSaleChoice or assetCheckFailed).


            // Store last drawn card for context in choice handlers
            gameState.players[playerId].lastDrawnCard = card;

            console.log(`🃏 ${gameState.players[playerId].displayName} вытянул из колоды ${cardType}`);

            // Отправляем ответ инициатору (чтобы он знал, что успешно)
            callback({ success: true, card });

            // ГЛАВНОЕ: Уведомляем ВСЕХ игроков, чтобы проиграть анимацию
            io.emit('game:card_drawn', {
                playerId,
                playerName: gameState.players[playerId].displayName,
                deckId,
                card
            });

            // === ПРОВЕРКА ПРОВАЛА УСЛОВИЙ (НЕТ НАВЫКА / АКТИВА) ===
            // Если проверка провалилась - отправляем уведомление и автоматически завершаем ход
            if (card.skillCheckFailed || card.assetCheckFailed) {
                let notificationMessage = '';
                let notificationTitle = card.title || 'СОБЫТИЕ';

                if (card.assetCheckFailed) {
                    // Нет актива для продажи
                    notificationMessage = `❌ У вас нет предмета "${card.offer_asset_name || 'актив'}" для продажи.`;
                } else if (card.skillCheckFailed && card.requiresSkill) {
                    // Нет навыка
                    const skillName = gameState.getSkillDisplayName(card.requiresSkill);
                    notificationMessage = `❌ У вас нет навыка "${skillName}". Доход не зачислен.`;
                }

                if (notificationMessage) {
                    // Отправляем уведомление ВСЕМ
                    io.emit('game:notification', {
                        title: notificationTitle,
                        message: notificationMessage,
                        type: 'error',
                        playerName: gameState.players[playerId].displayName
                    });

                    // Автоматически завершаем ход
                    gameState.nextTurn();
                    io.emit('game:state_update', gameState.getState());
                }
            } else {
                // Standard Log
                io.emit('game:log', {
                    text: `${gameState.players[playerId].displayName} вытянул карту: ${card.text || card.title}`,
                    type: 'system'
                });
            }

            // Обновить состояние
            io.emit('game:state_update', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка вытягивания карты:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    // =========================================================================
    // БЛАГОТВОРИТЕЛЬНОСТЬ - Выбор игрока
    // =========================================================================



    // =========================================================================
    // ПОКУПКА БИЗНЕСА/НАВЫКА - Выбор игрока
    // =========================================================================

    /**
     * ИГРОК: Подтвердить или отклонить покупку бизнеса/курса
     */
    socket.on('player:purchase_choice', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];
            const { accept, price, name, income, skill, isAsset } = data;
            const lastCard = player.lastDrawnCard || {};

            if (accept) {
                // Игрок согласился купить
                const walletType = data.walletSource || 'savings'; // По умолчанию сбережения
                const currentBalance = gameState.autoFinanceCards[playerId]?.calculatedWallets?.[walletType] || 0;

                if (currentBalance >= price) {
                    // Хватает средств - списываем через applyMoneyChange для истории
                    const walletChanges = {};
                    walletChanges[walletType] = -price;

                    // Используем applyMoneyChange чтобы записать в History расходов сервера
                    gameState.applyMoneyChange(playerId, -price, walletChanges, `Покупка: ${name}`);

                    if (isAsset) {
                        // Это АКТИВ (вещь, можно продать)
                        player.assets.items.push({
                            id: `item_${Date.now()}`,
                            name: name,
                            price: price,
                            acquiredAt: new Date().toISOString()
                        });

                        // История хода (-сумма)
                        gameState.addToHistory({
                            action: 'purchase',
                            actorId: playerId,
                            actorName: player.displayName,
                            details: { message: `Куплен актив: ${name}`, item: name },
                            amount: -price
                        });

                        const template = lastCard.msg_success_others || `📦 {Player} приобрел "{CardName}" за ${price}₴!`;
                        const message = template.replace('{Player}', player.displayName).replace('{CardName}', name);

                        io.emit('game:log', { text: message, type: 'success' });

                        // Уведомление
                        io.emit('game:notification', {
                            title: 'НОВАЯ ПОКУПКА',
                            message: message,
                            playerName: player.displayName
                        });

                    } else {
                        // Это БИЗНЕС (приносит доход)
                        // Fix: Parse string income if needed
                        let incomeAmount = income;
                        if (typeof incomeAmount === 'string') {
                            incomeAmount = parseInt(incomeAmount) || 0;
                        }

                        player.assets.businesses.push({
                            id: `business_${Date.now()}`,
                            name: name,
                            price: price,
                            income: incomeAmount,
                            acquiredAt: new Date().toISOString()
                        });

                        // Обновляем авто-доход
                        if (gameState.autoFinanceCards[playerId]) {
                            gameState.autoFinanceCards[playerId].calculatedMonthlyIncome += (incomeAmount || 0);
                            gameState.autoFinanceCards[playerId].calculatedBusinessCashFlow += (incomeAmount || 0);
                        }

                        // История хода (-сумма)
                        gameState.addToHistory({
                            action: 'business_bought',
                            actorId: playerId,
                            actorName: player.displayName,
                            details: {
                                message: `Куплен бизнес: ${name}. Доход: ${incomeAmount}₴/мес`,
                                business: name,
                                income: incomeAmount
                            },
                            amount: -price
                        });

                        // Если это курс с навыком - добавляем навык
                        if (skill) {
                            gameState.addSkill(playerId, skill);
                        }

                        const template = lastCard.msg_success_others || `🏢 {Player} купил бизнес: {CardName}!`;
                        const message = template.replace('{Player}', player.displayName).replace('{CardName}', name);

                        io.emit('game:log', { text: message, type: 'success' });

                        // Уведомление
                        io.emit('game:notification', {
                            title: 'НОВЫЙ БИЗНЕС',
                            message: message,
                            playerName: player.displayName
                        });
                    }

                    // === FIX: Add to Player Turn History for Client Display ===
                    // Client reads player.turnHistory for the table
                    player.turnHistory.push({
                        turnNumber: player.turnHistory.length + 1,
                        dice: '-', // Aysnc action, no dice context easily available or relevant
                        cellKey: player.position.currentCell,
                        cellName: 'News/Shop',
                        cardTitle: isAsset ? 'Покупка Актива' : 'Покупка Бизнеса',
                        cardDescription: name,
                        result: 'purchase',
                        amount: -price
                    });

                    console.log(`✅ ${player.displayName} купил ${name} за ${price}₴`);
                    callback?.({ success: true, purchased: true, newBalance: currentBalance - price });

                } else {
                    // Не хватает средств - отправляем уведомление
                    const errorMessage = `❌ Недостаточно средств в копилке "${walletType}". Требуется ${price}₴, доступно ${currentBalance}₴.`;

                    io.emit('game:notification', {
                        title: 'ОШИБКА ПОКУПКИ',
                        message: errorMessage,
                        type: 'error',
                        playerName: player.displayName
                    });

                    callback?.({ success: false, error: errorMessage });
                }
            } else {
                // Игрок отказался
                gameState.addToHistory({
                    action: 'purchase_declined',
                    actorId: playerId,
                    actorName: player.displayName,
                    details: { message: `Отказался от покупки: ${name}`, item: name }
                });

                const template = lastCard.msg_decline_others || `Игрок {Player} отказался от покупки {CardName}.`;
                const message = template.replace('{Player}', player.displayName).replace('{CardName}', name);

                // NOTIFICATION FOR DECLINE
                io.emit('game:notification', {
                    title: 'ОТКАЗ',
                    message: message,
                    playerName: player.displayName,
                    type: 'info'
                });
                io.emit('game:log', { text: message, type: 'info' });

                console.log(`${player.displayName} отказался от покупки ${name}`);
                callback?.({ success: true, purchased: false });
            }

            // Обновить состояние
            io.emit('game:state_update', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка покупки:', error.message);
            callback?.({ success: false, error: error.message });
        }
    });


    /**
                        // Хватает средств - списываем из Charity
                        wallets.charity -= donationAmount;

                        // === SPECIAL LOGIC: Chance #7 (Buff instead of payment) ===
                if (lastCard.id === 'chance_help_transport') {
                    // Apply buff logic via GameState (like skills)
                    if (lastCard.buff) {
                         const buffData = {
                             type: lastCard.buff.type || 'double_dice',
                             duration: lastCard.buff.duration || 2
                         };

                         gameState.addBuff(playerId, buffData);

                         const message = (lastCard.msg_success_others || 'Игрок {Player} помог другу.')
                            .replace('{Player}', player.displayName);

                         io.emit('game:notification', {
                            title: 'ПОМОЩЬ ДРУГУ',
                            message: message,
                            playerName: player.displayName
                         });
                         io.emit('game:log', { text: message, type: 'success' });
                    }
                    callback?.({ success: true, donated: true });
                } else {
                        // Записываем расход
                        autoFinance.expensesHistory.push({
                            timestamp: new Date().toISOString(),
                            type: 'charity_donation',
                            amount: donationAmount
                        });

                        // Увеличиваем счетчик
                        player.charityDonationsMade++;

                        // Custom message
                        const template = lastCard.msg_success_others || `💝 {Player} пожертвовал ${donationAmount}₴ на благотворительность!`;
                        const message = template.replace('{Player}', player.displayName).replace('{CardName}', lastCard.title || 'Благотворительность');

                        io.emit('game:log', { text: message, type: 'success' });
                        io.emit('game:notification', {
                            title: 'БЛАГОТВОРИТЕЛЬНОСТЬ',
                            message: message,
                            playerName: player.displayName
                        });
                        console.log(message);

                        callback?.({ success: true, donated: true });
                    }
                } else {
                        // Не хватает средств
                        const message = `⚠️ Недостаточно средств в копилке Благотворительности (${wallets.charity}₴ из ${donationAmount}₴)`;
                        callback?.({ success: false, error: message });
                    }
                }

            } else {
                // Игрок отказался
                const template = lastCard.msg_decline_others || `${player.displayName} отказался от пожертвования`;
                const message = template.replace('{Player}', player.displayName).replace('{CardName}', lastCard.title || 'пожертвования');

                io.emit('game:log', { text: message, type: 'info' });

                // Уведомление всем
                io.emit('game:notification', {
                    title: 'ОТКАЗ',
                    message: message,
                    playerName: player.displayName
                });

                console.log(`${player.displayName} отказался от пожертвования`);
                callback?.({ success: true, donated: false });
            }

            // Обновить состояние
            io.emit('game:state_update', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка благотворительности:', error.message);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Выбор продажи актива (Продать / Оставить)
     */
    socket.on('player:sale_choice', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });
        if (gameState.currentTurn !== playerId) return callback?.({ success: false, error: 'Не ваш ход' });

        const { accept, assetId, salePrice } = data;
        const player = gameState.players[playerId];
        const lastCard = player.lastDrawnCard || {};

        try {
            if (accept) {
                // Игрок согласился продать
                // 1. Проверяем наличие актива
                const assetIndex = player.assets.items.findIndex(item => item.id === assetId);
                // Note: For News #29 'sale_choice', the assetId might come from client selection if we implemented that UI.
                // If specific assetId is missing, we might need robust finding by name (TODO), 
                // but for now relying on client sending correct assetId (or if News logic is improved later).

                if (assetIndex === -1) {
                    return callback?.({ success: false, error: 'Актив не найден (возможно, уже продан)' });
                }

                const assetName = player.assets.items[assetIndex].name;

                // 2. Удаляем актив
                player.assets.items.splice(assetIndex, 1);

                // 3. Начисляем деньги (автораспределение по правилам дохода)
                const price = Number(salePrice) || 0;
                gameState.applyMoneyChange(playerId, price);

                const template = lastCard.msg_success_others || `💰 {Player} продал "{CardName}" за ${price}¢!`;
                const message = template.replace('{Player}', player.displayName).replace('{CardName}', assetName);

                io.emit('game:log', { text: message, type: 'success' });

                // Уведомление всем
                io.emit('game:notification', {
                    title: 'ПРОДАЖА АКТИВА',
                    message: message,
                    playerName: player.displayName
                });

                console.log(`💰 ${player.displayName} продал ${assetName} за ${price}¢`);
                callback?.({ success: true, sold: true });

            } else {
                // Игрок отказался продавать
                const template = lastCard.msg_decline_others || `${player.displayName} решил оставить актив себе.`;
                const message = template.replace('{Player}', player.displayName).replace('{CardName}', lastCard.offer_asset_name || 'актив');

                io.emit('game:log', { text: message, type: 'info' });

                // Уведомление всем
                io.emit('game:notification', {
                    title: 'ОТКАЗ ОТ ПРОДАЖИ',
                    message: message,
                    playerName: player.displayName
                });

                console.log(`${player.displayName} отказался продавать актив`);
                callback?.({ success: true, sold: false });
            }

            // Обновить состояние
            io.emit('game:state_update', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка продажи актива:', error.message);
            callback?.({ success: false, error: error.message });
        }
    });

    // =========================================================================
    // СПЯЩИЙ ИГРОК - Пробуждение
    // =========================================================================

    /**
     * ИГРОК: Проснуться и вернуться в игру
     */
    socket.on('player:wake_up', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];

            if (!player.isSleeping) {
                callback?.({ success: false, error: 'Вы не спите' });
                return;
            }

            // Просыпаемся!
            player.isSleeping = false;

            io.emit('game:log', {
                text: `☀️ ${player.displayName} проснулся и вернулся в игру!`,
                type: 'success'
            });

            io.emit('game:player_awake', { playerId, playerName: player.displayName });

            console.log(`☀️ ${player.displayName} проснулся!`);
            callback?.({ success: true });

            // Обновить состояние
            io.emit('game:state_update', gameState.getState());

        } catch (error) {
            console.error('❌ Ошибка пробуждения:', error.message);
            callback?.({ success: false, error: error.message });
        }
    });

    // =========================================================================
    // ФИНАНСОВАЯ КАРТОЧКА - Синхронизация данных
    // =========================================================================

    /**
     * ИГРОК: Обновить значения копилок (ручной ввод)
     */
    socket.on('player:update_wallets', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];
            const { charity, dream, savings, investments } = data;

            // Обновить ручные записи игрока
            player.playerEnteredFinances.wallets = {
                charity: Number(charity) || 0,
                dream: Number(dream) || 0,
                savings: Number(savings) || 0,
                investments: Number(investments) || 0
            };

            // Пересчитать капитал
            player.playerEnteredFinances.capital =
                player.playerEnteredFinances.wallets.charity +
                player.playerEnteredFinances.wallets.dream +
                player.playerEnteredFinances.wallets.savings +
                player.playerEnteredFinances.wallets.investments;

            console.log(`💰 ${player.displayName} обновил копилки:`, player.playerEnteredFinances.wallets);

            callback?.({ success: true, wallets: player.playerEnteredFinances.wallets });

            // Broadcast update
            io.emit('game:state_update', gameState.getState());
        } catch (error) {
            console.error('❌ Ошибка обновления копилок:', error.message);
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Добавить запись дохода
     */
    socket.on('player:add_income', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];
            const { name, amount } = data;

            const entry = {
                id: uuidv4(),
                name: name || 'Доход',
                amount: Number(amount) || 0,
                timestamp: new Date().toISOString()
            };

            player.playerEnteredFinances.incomeEntries.push(entry);
            player.playerEnteredFinances.monthlyIncome += entry.amount;

            console.log(`📈 ${player.displayName} добавил доход: ${entry.name} (+${entry.amount})`);

            callback?.({ success: true, entry });
            io.emit('game:state_update', gameState.getState());
        } catch (error) {
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Добавить запись расхода
     */
    socket.on('player:add_expense', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];
            const { name, amount } = data;

            const entry = {
                id: uuidv4(),
                name: name || 'Расход',
                amount: Number(amount) || 0,
                timestamp: new Date().toISOString()
            };

            player.playerEnteredFinances.expenseEntries.push(entry);
            player.playerEnteredFinances.monthlyExpenses += entry.amount;

            console.log(`📉 ${player.displayName} добавил расход: ${entry.name} (-${entry.amount})`);

            callback?.({ success: true, entry });
            io.emit('game:state_update', gameState.getState());
        } catch (error) {
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Обновить (редактировать) список ручных записей (Bulk Update)
     */
    socket.on('player:update_manual_entries', (data, callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Auth' });

        try {
            const player = gameState.players[playerId];
            if (data.incomeEntries) {
                player.playerEnteredFinances.incomeEntries = data.incomeEntries;
            }
            if (data.expenseEntries) {
                player.playerEnteredFinances.expenseEntries = data.expenseEntries;
            }
            // Также обновляем суммарные значения, которые посчитал клиент (или пересчитываем тут)
            if (typeof data.monthlyIncome === 'number') player.playerEnteredFinances.monthlyIncome = data.monthlyIncome;
            if (typeof data.monthlyExpenses === 'number') player.playerEnteredFinances.monthlyExpenses = data.monthlyExpenses;

            console.log(`💾 ${player.displayName} сохранил ручные записи (${data.incomeEntries?.length} д., ${data.expenseEntries?.length} р.)`);

            callback?.({ success: true });
        } catch (e) {
            console.error(e);
            callback?.({ success: false, error: e.message });
        }
    });

    /**
     * ИГРОК: Получить полные данные финансов
     */
    socket.on('player:get_finance_data', (callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];
            const autoFinance = gameState.autoFinanceCards[playerId];

            // Преобразуем навыки из ID в объекты с именами для UI
            const skillsWithNames = (player.assets.skills || []).map(skillId => ({
                id: skillId,
                name: gameState.getSkillDisplayName(skillId),
                level: 'Базовый'
            }));

            // Создаем копию assets для отправки
            const assetsToSend = {
                ...player.assets,
                skills: skillsWithNames
            };

            callback?.({
                success: true,
                manual: player.playerEnteredFinances,
                auto: autoFinance,
                assets: assetsToSend,
                turnHistory: player.turnHistory,
                dream: player.dream
            });
        } catch (error) {
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Подтвердить заполнение карточки (разблокировать следующий ход)
     */
    socket.on('player:confirm_card', (callback) => {
        if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });

        try {
            const player = gameState.players[playerId];
            player.cardFilledThisTurn = true;

            console.log(`✅ ${player.displayName} подтвердил заполнение карточки`);

            callback?.({ success: true, message: 'Карточка подтверждена! Можно ходить.' });
            io.emit('game:state_update', gameState.getState());
        } catch (error) {
            callback?.({ success: false, error: error.message });
        }
    });

    /**
     * КУРАТОР: Запрос отчета
     */
    socket.on('curator:get_report', (callback) => {
        if (!isCurator) {
            callback({ success: false, error: 'Только куратор может запросить отчет' });
            return;
        }

        try {
            const report = gameState.generateReport();
            callback({ success: true, report });
        } catch (error) {
            console.error('❌ Ошибка генерации отчета:', error.message);
            callback({ success: false, error: error.message });
        }
    });

    /**
     * ИГРОК: Бросить монетку (на развилке)
     */
    socket.on('player:flip_coin', (callback) => {
        if (!playerId) return callback({ success: false, error: 'Не авторизован' });
        if (gameState.currentTurn !== playerId) return callback({ success: false, error: 'Не ваш ход' });

        const player = gameState.players[playerId];
        // Note: board is defined in scope
        const cell = board[player.position.currentCell];

        if (!cell || (cell.type !== 'fork')) {
            return callback({ success: false, error: 'Вы не на развилке' });
        }

        try {
            // 1. Logic 50/50
            const isHeads = Math.random() < 0.5;
            const result = isHeads ? 'heads' : 'tails';

            // 2. Set direction in state (Heads->0, Tails->1)
            const outcome = gameState.setForkDirection(playerId, result);
            const directionText = (outcome.direction === 0) ? 'НАПРАВО' : 'НАЛЕВО';

            // 3. Emit event to ALL clients for animation
            io.emit('player:coin_flipped', {
                playerId,
                playerName: player.displayName,
                result,       // 'heads' | 'tails' 
                directionText, // 'НАПРАВО' | 'НАЛЕВО'
                directionIndex: outcome.direction
            });

            // LOG
            io.emit('game:log', {
                text: `${gameState.players[playerId].displayName} подбросил монетку: ${result === 'heads' ? 'Орел' : 'Решка'} -> ${directionText}`,
                type: 'system'
            });

            // 4. Update Game State (so buttons unlock on client)
            io.emit('game:state_update', gameState.getState());

            if (callback) callback({ success: true, result, directionText });
        } catch (error) {
            console.error('❌ Error flipping coin:', error);
            if (callback) callback({ success: false, error: error.message });
        }
    });
    /**
     * ЧАТ: Отправка сообщения игроком
     */
    socket.on('player:send_chat_message', (data) => {
        if (!playerId) return;

        const { text } = data;
        const player = gameState.players[playerId];

        if (!player || !text) return;

        // Отправляем всем (включая отправителя)
        io.emit('chat:broadcast', {
            playerId: player.id,
            playerName: player.displayName,
            antColor: player.antColor,
            text,
            timestamp: new Date().toISOString()
        });
    });

    /**
     * Отключение клиента
     */
    socket.on('disconnect', () => {
        console.log(`🔌 Отключение: ${socket.id}`);

        if (playerId) {
            const playerName = gameState.players[playerId]?.displayName;
            gameState.removePlayer(playerId);

            // Уведомить всех
            io.emit('game:state_update', gameState.getState());

            // Уведомить куратора
            if (gameState.curator.socketId) {
                io.to(gameState.curator.socketId).emit('curator:player_left', {
                    playerId,
                    playerName
                });
            }

            // === АВТО-СБРОС: Если все игроки покинули игру ===
            const remainingPlayers = Object.keys(gameState.players).length;
            console.log(`👥 Осталось игроков: ${remainingPlayers}`);

            if (remainingPlayers === 0 && gameState.status !== 'waiting') {
                console.log('🔄 Все игроки покинули игру. Автоматический сброс...');

                // Сбросить состояние игры
                gameState.reset();

                // Уведомить всех (включая куратора) о сбросе
                io.emit('game:auto_reset', {
                    message: 'Игра автоматически сброшена - все игроки покинули комнату.'
                });

                io.emit('game:state_update', gameState.getState());

                console.log('✅ Игра сброшена. Готова к новой игре.');
            }
        }
    });
});




/**
 * Запуск сервера
 */
server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log('');
    console.log('События клиент → сервер:');
    console.log('  - player:auth');
    console.log('  - curator:auth');
    console.log('  - curator:start_game');
    console.log('  - curator:end_game');
    console.log('  - player:request_roll');
    console.log('  - player:move');
    console.log('  - player:update_finances');
    console.log('  - curator:get_report');
    console.log('');
    console.log('События сервер → клиент:');
    console.log('  - game:state_update');
    console.log('  - game:started');
    console.log('  - game:ended');
    console.log('  - player:dice_rolled');
    console.log('  - player:moved');
    console.log('');
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('❌ Необработанная ошибка:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Необработанное отклонение промиса:', error);
});
