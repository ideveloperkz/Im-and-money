/**
 * Клиент для подключения к серверу игры
 * Управляет авторизацией, синхронизацией состояния и отображением игроков
 */

// Подключение к серверу
// Robust connection logic to support File protocol, Mobile IPs, and disparate ports
const getSocketUrl = () => {
    // === CONFIGURATION ===
    // Для деплоя замените null на URL вашего сервера (например, 'https://my-game.onrender.com')
    // Если null, клиент попытается угадать сам (для локалки)
    const PRODUCTION_SERVER_URL = 'https://my-game-server-acij.onrender.com';

    if (PRODUCTION_SERVER_URL) {
        return PRODUCTION_SERVER_URL;
    }

    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;

    // 1. Filesystem (file://) -> assume localhost:8080
    if (protocol === 'file:') {
        return 'http://localhost:8080';
    }

    // 2. Если мы на Live Server (обычно порт 5500) или другом порту, 
    // но бекенд ожидается на 8080
    if (port && port !== '8080' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.'))) {
        return `${protocol}//${hostname}:8080`;
    }

    // 3. В остальных случаях (Render, или если открыто прямо по порту 8080)
    // используем текущий домен/порт
    return window.location.origin;
};

const socket = io(getSocketUrl());
window.socket = socket; // Expose for board.js

// Глобальное состояние
const gameClient = {
    myPlayerId: null,
    myPlayerData: null,
    allPlayers: {},
    gameState: null,
    isAuthenticated: false,
    mustMoveFirst: false, // New flag: logic protection
    passedMoneyCells: [] // Клетки "Деньги" через которые прошел игрок (для карманных денег)
};

// Инициализация глобальных флагов для обычных игроков
window.isCurator = false;
window.allowPlayerGameControl = true; // По умолчанию разрешено
window.buttonExplicitlyHidden = false; // Флаг явного скрытия кнопки куратором

/**
 * Показать модальное окно авторизации
 */
function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Скрыть модальное окно авторизации
 */
function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Авторизация игрока
 */
function authenticatePlayer() {
    const nameInput = document.getElementById('player-name');
    const passwordInput = document.getElementById('player-password');
    const errorDiv = document.getElementById('auth-error');

    const name = nameInput.value.trim();
    const password = passwordInput.value.trim();

    // Валидация
    if (!name) {
        errorDiv.textContent = 'Введите имя';
        errorDiv.style.display = 'block';
        return;
    }

    if (!password) {
        errorDiv.textContent = 'Введите пароль';
        errorDiv.style.display = 'block';
        return;
    }

    // Отправить запрос авторизации
    socket.emit('player:auth', { name, password }, (response) => {
        if (response.success) {
            // Авторизация успешна
            gameClient.isAuthenticated = true;
            gameClient.myPlayerId = response.player.id;
            gameClient.myPlayerData = response.player;
            gameClient.gameState = response.gameState;

            console.log('✅ Авторизован:', response.player.displayName);

            // Скрыть модалку авторизации
            hideAuthModal();

            // Обновить UI
            updateGameBoard(response.gameState);

            // Показать мою фигурку
            displayAllPlayers(response.gameState.players);

            // Sync buttons immediately!
            updateHostButton(response.gameState);

        } else {
            // Ошибка авторизации
            errorDiv.textContent = response.error;
            errorDiv.style.display = 'block';
            console.error('❌ Ошибка авторизации:', response.error);
        }
    });
}

/**
 * Отобразить всех игроков на поле
 */
/**
 * Отобразить всех игроков на поле
 */
function displayAllPlayers(players) {
    // ... logic ...
    // Instead of hiding static player, let's try to reuse it for the first player found
    // Old static logic removed
    // const staticPlayer = document.getElementById('player1');
    // let staticPlayerUsed = false;

    // Получить список активных ID игроков
    const activePlayerIds = new Set();
    Object.values(players).forEach(p => {
        if (p.isActive) activePlayerIds.add(p.id);
    });

    // Удалить фигурки отключившихся игроков (но не статичную)
    const existingFigures = document.querySelectorAll('.player-figure[data-player-id]');
    existingFigures.forEach(fig => {
        const id = fig.getAttribute('data-player-id');
        if (!activePlayerIds.has(id)) {
            fig.remove();
        }
    });

    // Группировать игроков по ячейкам
    const playersByCell = {};
    Object.values(players).forEach((player) => {
        if (!player.isActive) return;
        const cellKey = player.position.currentCell;
        if (!playersByCell[cellKey]) {
            playersByCell[cellKey] = [];
        }
        playersByCell[cellKey].push(player);
    });

    // Render players
    Object.keys(playersByCell).forEach(cellKey => {
        playersByCell[cellKey].forEach((player, index) => {
            console.log(`RENDER LOOP: Processing player ${player.displayName} on ${cellKey}`);

            // Check if we already have a figure for this player
            let figure = document.querySelector(`.player-figure[data-player-id="${player.id}"]`);

            if (!figure) {
                // 4. СОЗДАНИЕ ФИГУРКИ (КЛИЕНТ)
                // Если фигурки еще нет, мы создаем её с помощью этой функции.
                // Она создаст DIV с картинкой муравья и добавит его на поле.
                createPlayerFigure(player, index);
                return; // createPlayerFigure handles DOM insertion
            }

            // Update existing (or just claimed) figure
            if (figure) {
                // Ensure attribute is set
                if (!figure.getAttribute('data-player-id')) {
                    figure.setAttribute('data-player-id', player.id);
                }

                // Colorize if needed (gentle filter)
                const img = figure.querySelector('img');
                if (img && player.antColor && player.antColor !== 'blue') {
                    // Simple map for safety
                    const colors = {
                        'red': 'hue-rotate(140deg)',
                        'green': 'hue-rotate(260deg)',
                        'yellow': 'hue-rotate(200deg)',
                        'purple': 'hue-rotate(60deg)',
                        'orange': 'hue-rotate(170deg)'
                    };
                    if (colors[player.antColor]) {
                        img.style.filter = `drop-shadow(0 2px 4px rgba(0,0,0,0.3)) ${colors[player.antColor]}`;
                    }
                }

                const cell = document.querySelector(`.${player.position.currentCell}`);
                if (cell) {
                    positionPlayerOnCell(figure, cell, index);
                }
            }
        });
    });
}

/**
 * Создать фигурку игрока
 */
function createPlayerFigure(player, index) {
    // Получить элемент ячейки
    const cell = document.querySelector(`.${player.position.currentCell}`);
    if (!cell) {
        console.warn(`⚠️ Ячейка ${player.position.currentCell} не найдена`);
        // Fallback to start cell if currentCell is not found
        const startCell = document.querySelector('.cell-start');
        if (startCell) {
            console.warn(`⚠️ Используем стартовую ячейку для ${player.displayName}`);
        } else {
            console.error(`❌ Стартовая ячейка также не найдена. Невозможно отобразить игрока ${player.displayName}`);
            return;
        }
    }

    // Создать контейнер для игрока
    console.log(`Creating new figure for ${player.displayName} at ${player.position.currentCell}`);
    const playerContainer = document.createElement('div');
    playerContainer.className = 'player-figure';
    playerContainer.setAttribute('data-player-id', player.id);

    // Добавить изображение
    const playerImg = document.createElement('img');
    // ВАЖНО: Всегда используем ant.png как базовое изображение
    playerImg.src = 'muravei/ant.png';
    playerImg.alt = player.displayName;

    const colors = {
        'red': 'hue-rotate(140deg)',
        'green': 'hue-rotate(260deg)',
        'yellow': 'hue-rotate(200deg)',
        'purple': 'hue-rotate(60deg)',
        'orange': 'hue-rotate(170deg)'
    };
    if (player.antColor && colors[player.antColor]) {
        playerImg.style.filter = `drop-shadow(0 2px 4px rgba(0,0,0,0.3)) ${colors[player.antColor]}`;
    }

    // Добавить имя игрока
    const nameLabel = document.createElement('div');
    nameLabel.className = 'player-name';
    nameLabel.textContent = player.displayName;
    playerContainer.appendChild(nameLabel);

    playerContainer.appendChild(playerImg);
    const container = document.getElementById('fullhd');
    if (!container) {
        console.error('CRITICAL: #fullhd container NOT FOUND!');
    } else {
        container.appendChild(playerContainer);
        console.log(`Appended figure for ${player.displayName} to #fullhd`);
    }

    // Initial position
    let targetCellElement = cell;
    if (!player.position.currentCell || player.position.currentCell === 'cell-start') {
        const start = document.querySelector('.cell-start');
        if (start) targetCellElement = start;
    }

    if (targetCellElement) {
        setTimeout(() => {
            positionPlayerOnCell(playerContainer, targetCellElement, index);
        }, 50);
    } else {
        playerContainer.style.position = 'absolute';
        playerContainer.style.left = '50%';
        playerContainer.style.top = '50%';
    }

    if (player.id === gameClient.myPlayerId && window.PlayerGameInstance) {
        window.PlayerGameInstance.setPlayerAnt(playerContainer);
    }
}

/**
 * Позиционировать фигурку игрока на ячейке
 */
window.positionPlayerOnCell = function (playerElement, cellElement, playerIndex = 0) {
    if (!playerElement || !cellElement) return;

    // 1. Get container scale
    let scale = 1;
    // Check #fullhd first as it's the direct parent and scaled on mobile
    const container = document.getElementById('fullhd');
    const gameContainer = document.querySelector('.game-container');

    // Helper to parse scale
    const getScale = (el) => {
        if (!el) return 1;
        const style = window.getComputedStyle(el);
        const transform = style.transform || style.webkitTransform;
        if (transform && transform !== 'none') {
            const values = transform.split('(')[1].split(')')[0].split(',');
            return parseFloat(values[0]); // Scale X
        }
        return 1;
    };

    // If on mobile (or if #fullhd has transform), use that.
    // Otherwise fallback to gameContainer for legacy desktop scaling if any.
    // We multiply scales if both exist? No, usually it's one or the other.
    // In mobile.css: #fullhd is scaled, .game-container is not.
    // In desktop: .game-container is scaled, #fullhd is not.
    // Safest approach: Multiply them (cumulative scale)
    scale = getScale(container) * getScale(gameContainer);


    const cellRect = cellElement.getBoundingClientRect();
    // Container is already defined above
    const containerRect = container.getBoundingClientRect();

    // 2. Calculate Unscaled Deltas
    // The visual difference (rect.left - rect.left) is scaled.
    // We need the internal unscaled pixels for style.left.
    // Therefore: unscaled_pixels = scaled_pixels / scale

    const cellCenterX = (cellRect.left - containerRect.left + cellRect.width / 2) / scale;
    const cellCenterY = (cellRect.top - containerRect.top + cellRect.height / 2) / scale;

    // Размеры фигурки (они внутри #fullhd, поэтому их метрики тоже нужно считать правильно? 
    // offsetWidth уже unscaled, так что все ок)
    const figureWidth = playerElement.offsetWidth || 50;
    const figureHeight = playerElement.offsetHeight || 50;

    // Смещение
    let offsetX = 0;
    let offsetY = 0;

    if (playerIndex > 0) {
        const radius = playerIndex <= 6 ? 15 : 25;
        const angleStep = (2 * Math.PI) / (playerIndex <= 6 ? 6 : (playerIndex));
        const angle = (playerIndex * angleStep);

        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
    }

    // Установить позицию
    playerElement.style.position = 'absolute';
    playerElement.style.left = `${cellCenterX - figureWidth / 2 + offsetX}px`;
    playerElement.style.top = `${cellCenterY - figureHeight / 2 + offsetY}px`;
    playerElement.style.zIndex = `${100 + playerIndex}`;
    playerElement.style.transform = 'none';
};

/**
 * Обновить игровое поле
 */
function updateGameBoard(gameState) {
    gameClient.gameState = gameState;

    // ВАЖНО: Обновляем данные текущего игрока, чтобы валидация колод работала с актуальной позицией
    if (gameClient.myPlayerId && gameState.players[gameClient.myPlayerId]) {
        gameClient.myPlayerData = gameState.players[gameClient.myPlayerId];
    }

    // Обновить статус игры
    console.log('🎮 Статус игры:', gameState.status);

    // Управление кнопкой броска
    // Управление кнопками (Кубик vs Монетка)
    const rollBtn = document.querySelector('.roll-btn');
    const coinBtn = document.getElementById('coin-flip-btn'); // Кнопка монетки (нужен ID в board.html)

    if (rollBtn) {
        const isMyTurn = (gameState.currentTurn === gameClient.myPlayerId);
        const player = gameState.players[gameClient.myPlayerId];
        const currentCell = player ? player.position.currentCell : null;

        // Определяем тип текущей ячейки (нужен доступ к board или cell type в player state)
        // Сервер не присылает type ячейки в player state напрямую?
        // Мы можем добавить type в player.position на сервере или проверять локально если есть board.
        // Но лучше, чтобы сервер присылал.
        // В player:moved мы видим cellType в details? Нет.
        // В gameState.players нет cellType.
        // Но мы можем судить по названию класса? Нет. 
        // Простой хак: если есть prediction? Нет.
        // Сервер должен присылать cellType или мы угадаем по имени 'cell-fork'.

        const isFork = currentCell && (currentCell.includes('fork'));
        // cell-fork, cell-fork1

        const hasRolled = gameClient.hasRolled || false;

        // Новая логика: Fork -> Coin -> ForkDirection -> Dice
        const forkDirectionSet = (player.forkDirection !== null && player.forkDirection !== undefined);
        const isSkipping = player && player.status && player.status.skippedTurns > 0;

        // Логика Кубика
        // Активен если: Мой ход И не бросил И (не развилка ИЛИ (развилка И направление выбрано)) И НЕ ПРОПУСКАЮ ХОД
        let canRoll = isMyTurn && gameState.status === 'in_progress' && !hasRolled && !isSkipping;

        if (isFork && !forkDirectionSet) {
            canRoll = false; // Нужно сперва монетку
        }

        if (canRoll) {
            rollBtn.disabled = false;
            rollBtn.style.opacity = 1;
            rollBtn.style.cursor = 'pointer';
            rollBtn.parentElement.style.filter = "drop-shadow(0 0 10px gold)";
            rollBtn.parentElement.style.pointerEvents = 'auto'; // Ensure clickable
        } else {
            rollBtn.disabled = true;
            rollBtn.style.opacity = 0.5;
            rollBtn.style.cursor = 'not-allowed';
            rollBtn.parentElement.style.filter = "none";
            rollBtn.parentElement.style.pointerEvents = 'none'; // Block clicks
        }

        // Логика Монетки
        // Кнопка монетки должна быть активна ТОЛЬКО если: Мой ход И я на развилке И направление НЕ выбрано
        const coinBtnElement = document.querySelector('.coin-btn');
        if (coinBtnElement) {
            if (isMyTurn && isFork && !forkDirectionSet) {
                coinBtnElement.disabled = false;
                coinBtnElement.style.opacity = 1;
                coinBtnElement.style.cursor = 'pointer';
                coinBtnElement.style.pointerEvents = 'auto';

                if (window.CoinGameInstance && typeof window.CoinGameInstance.showCoinButton === 'function') {
                    window.CoinGameInstance.showCoinButton();
                }
            } else {
                coinBtnElement.disabled = true;
                coinBtnElement.style.opacity = 0.5;
                coinBtnElement.style.cursor = 'not-allowed';
                coinBtnElement.style.pointerEvents = 'none';

                if (window.CoinGameInstance && typeof window.CoinGameInstance.hideCoinButton === 'function') {
                    window.CoinGameInstance.hideCoinButton();
                }
            }
        }
    }

    // Обновить отображение баланса на кнопке финансовой карточки
    updateBalanceDisplay(gameState);
}

/**
 * Обновить отображение общего баланса на кнопке финансовой карточки
 */
function updateBalanceDisplay(gameState) {
    const balanceElement = document.getElementById('total-balance-display');
    if (!balanceElement) return;

    // Если есть данные автофинансов текущего игрока
    if (gameClient.myPlayerId && gameState.autoFinanceCards) {
        const autoFinance = gameState.autoFinanceCards[gameClient.myPlayerId];
        if (autoFinance && autoFinance.calculatedWallets) {
            const total = Object.values(autoFinance.calculatedWallets).reduce((a, b) => a + b, 0);
            balanceElement.textContent = `${total} ₸`;
            return;
        }
    }

    // Fallback: 100 стартовых
    balanceElement.textContent = '100 ₸';
}

/**
 * Переместить фигурку игрока (с анимацией)
 */
function movePlayerFigure(playerId, newCellKey) {
    const playerElement = document.querySelector(`.player-figure[data-player-id="${playerId}"]`);
    const newCell = document.querySelector(`.${newCellKey}`);

    if (!playerElement || !newCell) {
        console.warn(`⚠️ Не найден игрок или ячейка для перемещения`);
        return;
    }

    // Найти индекс игрока на новой ячейке
    const playersOnCell = document.querySelectorAll(`.player-figure`);
    let playerIndex = 0;
    playersOnCell.forEach((p, i) => {
        if (p.getAttribute('data-player-id') === playerId) {
            playerIndex = i;
        }
    });

    // Позиционировать с анимацией
    playerElement.style.transition = 'all 0.5s ease';
    positionPlayerOnCell(playerElement, newCell, playerIndex);
}

// ============================================================================
// События Socket.IO
// ============================================================================

/**
 * Обновление состояния игры
 */
socket.on('game:state_update', (state) => {
    // 3. ПОЛУЧЕНИЕ ОБНОВЛЕНИЯ (КЛИЕНТ)
    // Клиент получает новое состояние игры от сервера.
    // В этом состоянии есть список 'players', где уже есть новый игрок.
    console.log('📡 Обновление состояния игры', state);

    // Сбросить флаг броска
    const isMyTurn = state.currentTurn === gameClient.myPlayerId;
    const turnChanged = gameClient.gameState && state.currentTurn !== gameClient.gameState.currentTurn;
    const playerCount = Object.keys(state.players || {}).length;

    // Для одного игрока: проверяем изменение номера хода через состояние игрока
    const myPlayer = state.players && state.players[gameClient.myPlayerId];
    const prevTurnHistoryLen = gameClient.gameState?.players?.[gameClient.myPlayerId]?.turnHistory?.length || 0;
    const currTurnHistoryLen = myPlayer?.turnHistory?.length || 0;
    const turnHistoryChanged = currTurnHistoryLen > prevTurnHistoryLen;

    // Сбрасываем hasRolled если:
    // 1. Ход сменился и теперь мой ход (для нескольких игроков), ИЛИ
    // 2. Один игрок и история ходов изменилась (новый ход начался), ИЛИ
    // 3. Впервые получили состояние и это мой ход
    if ((turnChanged && isMyTurn) || (playerCount === 1 && turnHistoryChanged && isMyTurn) || (!gameClient.gameState && isMyTurn)) {
        console.log('🔔 Ваш ход! Кнопка броска активирована.');
        gameClient.hasRolled = false;
    }

    updateGameBoard(state);
    displayAllPlayers(state.players);

    // === УПРАВЛЕНИЕ КНОПКОЙ ХОСТА ===
    updateHostButton(state);
});

/**
 * Синхронизация ВСЕХ кнопок управления (Host + Curator)
 */
function updateHostButton(state) {
    if (!state) return;
    const isGameRunning = state.status === 'in_progress';

    // 1. Основная кнопка на поле (#start-game-btn)
    const mainBtn = document.getElementById('start-game-btn');
    if (mainBtn) {
        // ВАЖНО: Если куратор явно скрыл кнопку - НЕ показываем её
        if (window.buttonExplicitlyHidden) {
            console.log('⚠️ Кнопка явно скрыта куратором, пропускаем обновление');
            return; // Выходим, не трогаем кнопку
        }

        const iconSpan = mainBtn.querySelector('.btn-icon');
        const labelSpan = mainBtn.querySelector('.btn-label');

        if (isGameRunning) {
            if (iconSpan) iconSpan.textContent = '🏁';
            if (labelSpan) labelSpan.textContent = 'Завершить игру';
            mainBtn.classList.add('game-running'); // Red style
        } else {
            if (iconSpan) iconSpan.textContent = '🚀';
            if (labelSpan) labelSpan.textContent = 'Начать игру';
            mainBtn.classList.remove('game-running'); // Green style
        }
    }

    // 2. Кнопки в панели куратора (#curator-start-btn, #curator-end-btn)
    const curStart = document.getElementById('curator-start-btn');
    const curEnd = document.getElementById('curator-end-btn');

    if (curStart && curEnd) {
        if (isGameRunning) {
            curStart.classList.add('hidden');
            curEnd.classList.remove('hidden');
        } else {
            curStart.classList.remove('hidden');
            curEnd.classList.add('hidden');
        }
    }

    // 3. Статус в панели
    const statusDisplay = document.getElementById('game-status-display');
    if (statusDisplay) {
        statusDisplay.textContent = isGameRunning ? 'Статус: ИДЕТ ИГРА' : 'Статус: Ожидание начала';
    }
}

/**
 * Игра началась
 */
socket.on('game:started', (state) => {
    console.log('🎮 Игра началась!', state);

    // Сброс флага
    if (state.currentTurn === gameClient.myPlayerId) {
        gameClient.hasRolled = false;
    }

    // ВАЖНО: Если открыта фактическая карточка, обновляем цифры в реал-тайме!
    if (window.refreshFinanceData) {
        // Проверяем, активен ли режим просмотра сервера
        const btnServer = document.getElementById('btn-show-server-data'); // Или другой ID?
        // Проверяем по классу дашборда
        const finDashboard = document.querySelector(".finance-dashboard");
        // Или по кнопке "Actual"
        const actualBtn = document.getElementById("btn-toggle-actual");

        if (actualBtn && actualBtn.classList.contains('active')) {
            // false = не трогать ручные инпуты, только обновить window.serverFinanceData и перерисовать
            window.refreshFinanceData(false);
        }
    }

    updateGameBoard(state);

    updateGameBoard(state);

    // Синхронизация кнопок
    updateHostButton(state);

    // Можно показать уведомление
    // TODO: показать уведомление "Игра началась"

    // Можно показать уведомление
    // TODO: показать уведомление "Игра началась"
});

/**
 * Игра автоматически сброшена (все игроки покинули)
 */
socket.on('game:auto_reset', (data) => {
    console.log('🔄 Авто-сброс:', data.message);

    // Мы ожидаем game:state_update сразу после этого события от сервера, 
    // но на всякий случай сбросим вручную, если состояние не придет
    const mainBtn = document.getElementById('start-game-btn');
    if (mainBtn) {
        mainBtn.classList.remove('game-running');
        const iconSpan = mainBtn.querySelector('.btn-icon');
        const labelSpan = mainBtn.querySelector('.btn-label');
        if (iconSpan) iconSpan.textContent = '🚀';
        if (labelSpan) labelSpan.textContent = 'Начать игру';
    }
});

/**
 * Игра завершена
 */
socket.on('game:ended', (data) => {
    console.log('🏁 Игра завершена', data);
    alert(data.message);

    // Можно показать отчет
    // TODO: показать отчет о игре
});

/**
 * ПРЯМОЕ СКРЫТИЕ кнопки управления куратором
 */
socket.on('game:hide_controls', () => {
    console.log('🚫 Получено событие скрытия кнопки управления');
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.style.cssText = 'display: none !important; visibility: hidden !important;';
        window.buttonExplicitlyHidden = true; // КРИТИЧЕСКИ ВАЖНО: запоминаем что кнопка явно скрыта
        console.log('🚫 Кнопка start-game-btn СКРЫТА (флаг установлен)');
    }
});

/**
 * ПРЯМОЕ ПОКАЗАНИЕ кнопки управления куратором
 */
socket.on('game:show_controls', () => {
    console.log('✅ Получено событие показа кнопки управления');
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.style.cssText = '';
        window.buttonExplicitlyHidden = false; // КРИТИЧЕСКИ ВАЖНО: сбрасываем флаг
        console.log('✅ Кнопка start-game-btn ПОКАЗАНА (флаг сброшен)');
    }
});

/**
 * Принудительное отключение (игра завершена хостом)
 */
socket.on('game:force_disconnect', (data) => {
    console.log('⚠️ Принудительное отключение:', data.message);

    // Показать сообщение
    alert(data.message);

    // Перезагрузить страницу
    window.location.reload();
});

/**
 * Игрок бросил кубик
 */
socket.on('player:dice_rolled', (data) => {
    console.log(`🎲 ${data.playerName} бросил кубик: ${data.result}${data.isPartial ? ' (Бросок 1/2)' : ''}`);

    // Блокируем кнопку, если это мы и бросок завершен
    if (data.playerId === gameClient.myPlayerId) {
        if (!data.isPartial) {
            gameClient.hasRolled = true;
        }

        if (gameClient.gameState) {
            updateGameBoard(gameClient.gameState);
        }
    }

    // Показываем анимацию ВСЕМ игрокам
    const isMyTurn = (data.playerId === gameClient.myPlayerId);

    if (window.DiceGameInstance) {
        window.DiceGameInstance.showDiceAnimation(data.result, isMyTurn, data.prediction, data.isPartial);
    }
});

/**
 * Игрок бросил монетку
 */
socket.on('player:coin_flipped', (data) => {
    console.log(`🪙 ${data.playerName} бросил монетку: ${data.result} -> ${data.directionText}`);

    // Запустить анимацию
    if (window.CoinGameInstance) {
        // Передаем результат ('heads'/'tails') и ТЕКСТ ('НАПРАВО'/'НАЛЕВО')
        window.CoinGameInstance.flipCoin(data.result, data.directionText);
    }
});

/**
 * Игрок вытянул карту (синхронизация)
 */
// ============================================================================
// ЕДИНАЯ ОЧЕРЕДЬ СОБЫТИЙ (Unified Event Queue)
// ============================================================================

window.eventQueue = [];
// Флаг теперь управляется и из deckanimation.js
if (typeof window.isEventWindowOpen === 'undefined') {
    window.isEventWindowOpen = false;
}

/**
 * Добавить событие в очередь
 */
window.addToEventQueue = function (eventData) {
    console.log('📥 Event added to queue:', eventData);
    window.eventQueue.push(eventData);
    processEventQueue();
};

/**
 * Обработать очередь событий
 */
window.processEventQueue = function () {
    if (window.eventQueue.length === 0) return;
    if (window.isEventWindowOpen) {
        console.log('⏳ Window open, waiting...');
        return;
    }

    const event = window.eventQueue.shift();
    showUnifiedWindow(event);
};

/**
 * Показать единое модальное окно (использует #card)
 */
window.showUnifiedWindow = function (data) {
    console.log('📺 Showing Unified Window:', data);
    window.isEventWindowOpen = true;

    const cardModal = document.getElementById('card');
    const cardTitle = document.getElementById('card-title');
    const cardText = document.getElementById('card-text');
    const cardExtra = document.getElementById('card-extra-info');
    const cardCloseBtn = document.getElementById('card-close-btn'); // Static button

    if (!cardModal) return;

    // 1. Content
    if (cardTitle) cardTitle.innerHTML = data.title || 'СОБЫТИЕ';
    const description = data.message || data.description || '';
    if (cardText) cardText.innerHTML = description;

    // 2. Buttons & Interaction
    if (cardExtra) cardExtra.innerHTML = '';

    // Скрываем статичную кнопку закрытия ВСЕГДА (управляем сами)
    if (cardCloseBtn) cardCloseBtn.style.display = 'none';

    // Проверка на активного игрока
    // const isMyTurn = (data.playerId === gameClient.myPlayerId); 
    // OR prefer specific flag passed in data
    const isMyTurn = (gameClient.gameState && gameClient.gameState.currentTurn === gameClient.myPlayerId);

    // Если это уведомление (info/error/success), то 'playerId' в данных может быть инициатором
    // Но кнопку "ОК" должен видеть тот, кому адресовано, ИЛИ все, но управлять закрытием может активный?
    // User requested: "Active player controls everything".
    // So usually only Active Player sees buttons.

    if (isMyTurn) {
        // === АКТИВНЫЙ ИГРОК ===

        if (data.action === 'choice' && data.options) {
            // Опции выбора
            data.options.forEach((option, index) => {
                const btn = document.createElement('button');
                btn.className = 'choice-btn';
                btn.textContent = option.text;
                btn.style.cssText = `
                    display: block; width: 100%; margin: 10px 0; padding: 12px;
                    background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
                    color: gold; border: 2px solid gold; border-radius: 8px; cursor: pointer;
                `;
                btn.onclick = () => {
                    socket.emit('player:choice_made', {
                        cellId: gameClient.myPlayerData.position.currentCell,
                        optionIndex: index
                    });
                    // Server emits game:close_active_window
                };
                cardExtra.appendChild(btn);
            });
        }
        else if (data.hasButtons) {
            // Already handled by deckanimation logic usually, but fallback here
        }
        else {
            // Просто кнопка ОК (для уведомлений)
            const btn = document.createElement('button');
            btn.textContent = 'OK';
            btn.style.cssText = `
                display: block; width: 100%; margin: 10px 0; padding: 12px;
                background: #3498db; color: white; border: none; border-radius: 8px; cursor: pointer;
            `;
            btn.onclick = () => {
                // Специализированные действия для интерактивных пропусков и штрафов
                if (data.action === 'interactive_skip') {
                    socket.emit('player:finish_turn');
                } else if (data.action === 'income_blocked_ack') {
                    socket.emit('player:acknowledge_income_block');
                } else if (data.endTurn) {
                    // Если флаг endTurn, то завершаем ход
                    window.finishTurn();
                } else {
                    socket.emit('player:close_window');
                }
            };
            cardExtra.appendChild(btn);
        }

    } else {
        // === ПАССИВНЫЕ ИГРОКИ (Наблюдатели) ===
        const info = document.createElement('div');
        info.innerHTML = `<em>Ожидание ${gameClient.allPlayers[gameClient.gameState.currentTurn]?.displayName || 'игрока'}...</em>`;
        info.style.color = '#aaa';
        info.style.textAlign = 'center';
        if (cardExtra) cardExtra.appendChild(info);
    }

    // 3. Show Window
    cardModal.classList.remove('is-flying');
    cardModal.classList.add('is-window');
    cardModal.style.display = 'block';

    // === ДЕЙСТВИЯ ПРИ ОТКРЫТИИ (SPECIAL EFFECTS) ===
    if (data.action === 'dream_fulfilled') {
        startConfetti();
        // Можно добавить звук если есть
    }

    // Force Reflow & Fade In
    cardModal.style.opacity = '0';
    requestAnimationFrame(() => {
        cardModal.style.transition = 'opacity 0.3s ease';
        cardModal.style.opacity = '1';
        const content = document.getElementById('card-dynamic-content');
        if (content) {
            content.style.opacity = '1';
            content.style.pointerEvents = 'auto'; // Block clicks behind
        }
    });
};

/**
 * Запуск анимации конфетти
 */
function startConfetti() {
    console.log('🎉 Starting Advanced Confetti!');
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#FFD700'];
    const shapes = ['circle', 'star', 'trophy', ''];

    // Создаем 100 частиц, каждая со своим циклом
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        confetti.className = `confetti ${shape}`;

        // Рандомная точка старта салюта (центр взрыва)
        const startX = Math.random() * 100;
        const startY = Math.random() * 60; // Взрывы в верхней половине экрана

        confetti.style.left = startX + 'vw';
        confetti.style.top = startY + 'vh';

        // Сила и направление разлета (в разные стороны)
        const spreadX = (Math.random() - 0.5) * 400 + 'px';
        const spreadY = (Math.random() - 0.5) * 400 + 'px';

        confetti.style.setProperty('--spread-x', spreadX);
        confetti.style.setProperty('--spread-y', spreadY);

        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        // Случайная задержка и скорость, чтобы взрывы не были синхронными
        confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';
        confetti.style.animationDelay = (Math.random() * 5) + 's';

        container.appendChild(confetti);
    }
}

/**
 * Закрыть единое окно
 */
window.closeUnifiedWindow = function () {
    console.log('🔒 closeUnifiedWindow called');

    // === СБРОС АНИМАЦИИ (ОЧИСТКА DOM) ===
    // Удаляем контейнер с конфетти, чтобы не перегружать браузер
    document.querySelector('.confetti-container')?.remove();

    // Используем forceHideCard из deckanimation.js если есть (он сбрасывает флаги)
    if (typeof window.forceHideCard === 'function') {
        window.forceHideCard();
    } else {
        // Fallback
        const cardModal = document.getElementById('card');
        if (cardModal) {
            cardModal.style.display = 'none';
        }
        window.isEventWindowOpen = false;
        // Try next in queue IMMEDIATELY
        if (window.processEventQueue) window.processEventQueue();
    }
};


// --- SOCKET LISTENERS FOR QUEUE ---

// 1. Уведомления (Results, Errors, Info) -> В Очередь
socket.on('game:notification', (data) => {
    addToEventQueue({
        type: data.type || 'info', // 'success', 'error'
        title: data.title,
        message: data.message,
        playerName: data.playerName,
        playerId: data.playerId, // Pass ID for isMyTurn check
        endTurn: data.endTurn // Pass endTurn flag
    });
});

// 2. События клетки (если сервер шлет их отдельно отправкой выбора) -> В Очередь
socket.on('game:cell_event', (data) => {
    // Проверяем, не дубликат ли (иногда сервер шлет card_drawn отдельно)
    addToEventQueue({
        type: 'cell_event',
        title: data.title,
        message: data.description,
        action: data.action,
        options: data.options,
        playerName: gameClient.allPlayers[gameClient.myPlayerId]?.displayName,
        endTurn: data.endTurn // ВАЖНО: флаг окончания хода
    });
});

// 3. Закрытие окон (Синхронизация)
socket.on('game:close_active_window', () => {
    console.log('🔒 Server requested close active window');
    closeUnifiedWindow();
    if (typeof hideObserverCardModal === 'function') hideObserverCardModal();
});

// 4. Скрытие всех окон (Legacy/Reset)
socket.on('game:close_all_windows', () => {
    closeUnifiedWindow();
    const diceModal = document.getElementById('diceResultModal');
    if (diceModal) diceModal.classList.remove('show');
});


// --- LEGACY HANDLERS REPLACEMENT ---

socket.on('player:moved', (data) => {
    console.log(`🚶 ${data.playerName} переместился на ${data.position.currentCell}`);

    // Обновить позицию
    if (gameClient.gameState && gameClient.gameState.players[data.playerId]) {
        gameClient.gameState.players[data.playerId].position = data.position;
    }

    // Анимация
    movePlayerFigure(data.playerId, data.position.currentCell);

    // Логика прохождения через клетки (только для себя)
    if (data.playerId === gameClient.myPlayerId) {
        // Развилка (Fork) Handler - Logic now handled via game:cell_event
        if (data.cellResult && data.cellResult.action === 'choose_path') {
            // Ожидаем событие game:cell_event от сервера
        }

        // Клетки Деньги
        if (data.passedMoneyCells && data.passedMoneyCells.length > 0) {
            gameClient.passedMoneyCells = data.passedMoneyCells;
            // Assuming enableMoneyCellsClick is defined later in file
            if (typeof enableMoneyCellsClick === 'function') enableMoneyCellsClick(data.passedMoneyCells);
        } else {
            gameClient.passedMoneyCells = [];
        }
    }
});

// Глобальная функция завершения хода
// Duplicate finishTurn removed. Using the one at end of file.

// ============================================================================
// КАРМАННЫЕ ДЕНЬГИ (Pocket Money) - Логика клеток "Деньги"
// ============================================================================

/**
 * Активировать возможность клика на клетки "Деньги" для получения карманных денег
 */
function enableMoneyCellsClick(moneyCells) {
    // Сначала очищаем старые обработчики
    document.querySelectorAll('.money-cell-claimable').forEach(cell => {
        cell.classList.remove('money-cell-claimable');
    });

    moneyCells.forEach(cellKey => {
        const cellElement = document.querySelector(`.${cellKey}`);
        if (cellElement) {
            cellElement.classList.add('money-cell-claimable');

            // Добавляем обработчик клика (используем data-атрибут для проверки)
            if (!cellElement.hasAttribute('data-money-listener')) {
                cellElement.setAttribute('data-money-listener', 'true');
                cellElement.addEventListener('click', handleMoneyCellClick);
            }
        }
    });
}

/**
 * Обработчик клика на клетку "Деньги"
 */
function handleMoneyCellClick(event) {
    const cellElement = event.currentTarget;
    const cellKey = Array.from(cellElement.classList).find(c => c.startsWith('cell-'));

    if (!cellKey) return;

    // Проверяем, есть ли эта клетка в списке доступных
    if (gameClient.passedMoneyCells.includes(cellKey)) {
        claimPocketMoney(cellKey);
    }
}

/**
 * Запросить карманные деньги за клетку "Деньги"
 */
function claimPocketMoney(cellKey) {
    console.log(`💰 Запрос карманных денег за ${cellKey}...`);

    socket.emit('player:claim_pocket_money', { cellKey }, (response) => {
        if (response.success) {
            console.log(`✅ Получено ${response.amount}č карманных денег!`);

            // Показываем специальное уведомление
            showSystemAlert(`💰 Вам зачислено ${response.amount}č карманных денег!`);

            // Удаляем клетку из списка
            const index = gameClient.passedMoneyCells.indexOf(cellKey);
            if (index > -1) {
                gameClient.passedMoneyCells.splice(index, 1);
            }

            // Убираем визуальное выделение
            const cellElement = document.querySelector(`.${cellKey}`);
            if (cellElement) {
                cellElement.classList.remove('money-cell-claimable');
            }
        } else {
            console.warn('❌ Ошибка получения карманных денег:', response.error);
        }
    });
}

/**
 * Деактивировать возможность получения карманных денег (когда игрок тянет карту)
 */
window.deactivateMoneyCellClaim = function () {
    if (gameClient.passedMoneyCells.length > 0) {
        console.log('💔 Карманные деньги упущены! Игрок не запросил деньги перед вытягиванием карты.');
    }

    // Очищаем массив
    gameClient.passedMoneyCells = [];

    // Убираем визуальное выделение со всех клеток
    document.querySelectorAll('.money-cell-claimable').forEach(cell => {
        cell.classList.remove('money-cell-claimable');
    });
};

/**
 * Обновить видимость и состояние кнопки (Начать/Завершить игру)
 * КРИТИЧЕСКИ ВАЖНО: НЕ трогать кнопку если она была ЯВНО скрыта куратором
 */
function updateHostButton(state) {
    const startBtn = document.getElementById('start-game-btn');
    if (!startBtn) return;

    console.log(`🔘 [updateHostButton] allowControl=${state.allowPlayerGameControl}, explicitlyHidden=${window.buttonExplicitlyHidden}`);

    // КРИТИЧЕСКИ ВАЖНО: Если кнопка была ЯВНО скрыта куратором - НЕ ТРОГАЕМ её
    if (window.buttonExplicitlyHidden) {
        console.log('🚫 [updateHostButton] Кнопка явно скрыта - пропускаем обновление');
        return;
    }

    // Обновляем текст и стиль в зависимости от статуса игры
    const iconSpan = startBtn.querySelector('.btn-icon');
    const labelSpan = startBtn.querySelector('.btn-label');

    if (state.status === 'in_progress') {
        if (iconSpan) iconSpan.textContent = '🏁';
        if (labelSpan) labelSpan.textContent = 'Завершить игру';
        startBtn.classList.add('game-running');
    } else {
        if (iconSpan) iconSpan.textContent = '🚀';
        if (labelSpan) labelSpan.textContent = 'Начать игру';
        startBtn.classList.remove('game-running');
    }

    console.log('✅ [updateHostButton] Кнопка обновлена');
}

// ============================================================================
// Инициализация при загрузке страницы
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Инициализация клиента игры...');

    // Инициализация чата (Wrapped in try-catch)
    try {
        if (typeof initChat === 'function') {
            initChat();
        } else {
            console.warn('⚠️ initChat function is missing');
        }
    } catch (e) {
        console.error('❌ Error initializing chat:', e);
    }

    // Показать модалку авторизации при загрузке
    showAuthModal();

    // Обработчик кнопки авторизации
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
        // Remove old listeners by cloning
        const newBtn = authBtn.cloneNode(true);
        if (authBtn.parentNode) {
            authBtn.parentNode.replaceChild(newBtn, authBtn);
        }

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔘 Auth button clicked');
            authenticatePlayer();
        });
    } else {
        console.error('❌ Login button (auth-btn) not found!');
    }

    // Enter для авторизации
    const passwordInput = document.getElementById('player-password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                authenticatePlayer();
            }
        });
    }

    console.log('✅ Клиент готов к подключению');

    // ==========================================================
    // ЛОГИКА КУРАТОРА
    // ==========================================================

    const curatorTriggerBtn = document.getElementById('curator-btn-trigger');
    const curatorAuthModal = document.getElementById('curator-auth-modal');
    const curatorPanelModal = document.getElementById('curator-panel-modal');
    const curatorLoginBtn = document.getElementById('curator-login-btn');
    const curatorCancelBtn = document.getElementById('curator-cancel-btn');
    const curatorPanelClose = document.getElementById('curator-panel-close');
    const startGameBtn = document.getElementById('start-game-btn');
    const curatorStartBtn = document.getElementById('curator-start-btn');
    const curatorEndBtn = document.getElementById('curator-end-btn');
    const curatorHideControlsBtn = document.getElementById('curator-hide-controls-btn');
    const curatorShowControlsBtn = document.getElementById('curator-show-controls-btn');

    // Диагностика: проверка что кнопки найдены
    console.log('🔍 [ДИАГНОСТИКА КУРАТОРА]');
    console.log('  curatorHideControlsBtn:', curatorHideControlsBtn ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА');
    console.log('  curatorShowControlsBtn:', curatorShowControlsBtn ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА');
    console.log('  startGameBtn:', startGameBtn ? 'НАЙДЕНА' : 'НЕ НАЙДЕНА');

    // Открыть вход для куратора
    if (curatorTriggerBtn) {
        curatorTriggerBtn.addEventListener('click', () => {
            curatorAuthModal.classList.remove('hidden');
        });
    }

    // Закрыть вход
    if (curatorCancelBtn) {
        curatorCancelBtn.addEventListener('click', () => {
            curatorAuthModal.classList.add('hidden');
        });
    }

    // Закрыть панель
    if (curatorPanelClose) {
        curatorPanelClose.addEventListener('click', () => {
            curatorPanelModal.classList.add('hidden');
        });
    }

    // Вход куратора
    if (curatorLoginBtn) {
        curatorLoginBtn.addEventListener('click', () => {
            const password = document.getElementById('curator-password').value;
            // Имя куратора фиксировано, поле ввода удалено
            const name = 'Куратор';
            const errorDiv = document.getElementById('curator-auth-error');

            socket.emit('curator:auth', { name, password }, (response) => {
                if (response.success) {
                    console.log('👨‍💼 Куратор авторизован');
                    curatorAuthModal.classList.add('hidden');
                    curatorPanelModal.classList.remove('hidden');
                    window.isCurator = true; // Глобальный флаг для UI

                    // Обновить UI панели
                    updateCuratorPanel(response.gameState);
                    updateHostButton(response.gameState); // <-- SYNC BUTTONS IMMEDIATELY
                } else {
                    errorDiv.textContent = response.error;
                    errorDiv.style.display = 'block';
                }
            });
        });
    }

    // === ЕДИНАЯ ЛОГИКА ДЛЯ ВСЕХ КНОПОК ===
    // Эта функция определяет, что делать (начать или завершить) на основе состояния
    function toggleGameLogic() {
        // Определяем текущий статус
        const isGameRunning = gameClient.gameState && gameClient.gameState.status === 'in_progress';

        if (isGameRunning) {
            // ---> ЗАВЕРШЕНИЕ ИГРЫ
            if (confirm('🏁 Завершить игру? Это действие остановит процесс для ВСЕХ.')) {
                console.log('Отправка запроса на завершение игры...');
                socket.emit('curator:end_game', (response) => {
                    if (response.success) {
                        console.log('✅ Запрос на завершение отправлен успешно.');
                        // Ждем события game:game_over от сервера
                    } else {
                        alert('❌ Ошибка: ' + (response.error || 'Не удалось завершить игру'));
                    }
                });
            }
        } else {
            // ---> НАЧАЛО ИГРЫ
            if (confirm('🚀 Начать игру? Все игроки получат уведомление.')) {
                console.log('Отправка запроса на начало игры...');
                socket.emit('curator:start_game', (response) => {
                    if (response.success) {
                        console.log('✅ Запрос на старт отправлен успешно.');
                        // Ждем события game:started от сервера
                    } else {
                        alert('❌ Ошибка: ' + (response.error || 'Не удалось начать игру'));
                    }
                });
            }
        }
    }

    // 1. Основная кнопка на поле (Start/End)
    if (startGameBtn) {
        // Удаляем старые листенеры через клон
        const newStartBtn = startGameBtn.cloneNode(true);
        startGameBtn.parentNode.replaceChild(newStartBtn, startGameBtn);

        newStartBtn.addEventListener('click', () => {
            console.log('Нажата основная кнопка управления');
            toggleGameLogic();
        });
    }

    // 2. Кнопка "Начать" в панели куратора
    if (curatorStartBtn) {
        const newCurStart = curatorStartBtn.cloneNode(true);
        curatorStartBtn.parentNode.replaceChild(newCurStart, curatorStartBtn);

        newCurStart.addEventListener('click', () => {
            console.log('Нажата кнопка START в панели куратора');
            // Принудительно вызываем ту же логику. 
            // Т.к. эта кнопка видна только когда игра НЕ идет, логика сработает верно (на старт).
            toggleGameLogic();
        });
    }

    // 3. Кнопка "Завершить" в панели куратора
    if (curatorEndBtn) {
        const newCurEnd = curatorEndBtn.cloneNode(true);
        curatorEndBtn.parentNode.replaceChild(newCurEnd, curatorEndBtn);

        newCurEnd.addEventListener('click', () => {
            console.log('Нажата кнопка END в панели куратора');
            // Т.к. эта кнопка видна только когда игра ИДЕТ, логика сработает верно (на стоп).
            toggleGameLogic();
        });
    }

    // 4. Кнопка СКРЫТЬ управление у игроков
    if (curatorHideControlsBtn) {
        curatorHideControlsBtn.addEventListener('click', () => {
            console.log('🚫 Куратор скрывает кнопку управления у игроков');
            socket.emit('curator:hide_game_controls', (response) => {
                if (response && response.success) {
                    console.log('✅ Кнопка управления скрыта у всех игроков');
                    alert('✅ Кнопка управления скрыта у всех игроков');
                } else {
                    console.error('❌ Ошибка скрытия кнопки:', response?.error);
                    alert('❌ Ошибка: ' + (response?.error || 'Не удалось скрыть кнопку'));
                }
            });
        });
    }

    // 5. Кнопка ПОКАЗАТЬ управление у игроков
    if (curatorShowControlsBtn) {
        curatorShowControlsBtn.addEventListener('click', () => {
            console.log('✅ Куратор показывает кнопку управления у игроков');
            socket.emit('curator:show_game_controls', (response) => {
                if (response && response.success) {
                    console.log('✅ Кнопка управления показана у всех игроков');
                    alert('✅ Кнопка управления показана у всех игроков');
                } else {
                    console.error('❌ Ошибка показа кнопки:', response?.error);
                    alert('❌ Ошибка: ' + (response?.error || 'Не удалось показать кнопку'));
                }
            });
        });
    }

    function updateCuratorPanel(state) {
        if (!state) return;

        // ВАЖНО: Синхронизируем ВСЕ кнопки (не только в панели)
        updateHostButton(state);

        // Статус
        const statusDisplay = document.getElementById('game-status-display');
        const curStart = document.getElementById('curator-start-btn');
        const curEnd = document.getElementById('curator-end-btn');

        if (state.status === 'waiting') {
            if (statusDisplay) statusDisplay.textContent = 'Статус: Ожидание начала';
            if (curStart) curStart.classList.remove('hidden');
            if (curEnd) curEnd.classList.add('hidden');
        } else if (state.status === 'in_progress') {
            if (statusDisplay) statusDisplay.textContent = 'Статус: ИДЕТ ИГРА';
            if (curStart) curStart.classList.add('hidden');
            if (curEnd) curEnd.classList.remove('hidden');
        }

        // Список игроков
        const list = document.getElementById('curator-players-list');
        list.innerHTML = '';

        Object.values(state.players).forEach(player => {
            if (!player.isActive) return;
            const li = document.createElement('li');

            // Default permissions if not present
            const canSeeAutofill = player.permissions ? player.permissions.canSeeAutofill : true;
            const canSeeActual = player.permissions ? player.permissions.canSeeActual : true;

            li.innerHTML = `
                <div style="flex: 1; cursor: pointer;" class="inspect-trigger" data-player-id="${player.id}" title="Нажмите, чтобы проверить финансы">
                    <span class="player-status-dot"></span>
                    <span style="font-weight: bold; text-decoration: underline; text-decoration-color: #718096;">${player.displayName}</span> (${player.firstName})
                    <div style="font-size: 11px; color: #718096; margin-top: 2px;">${player.position.currentCell}</div>
                </div>
                
                <div class="player-controls-group">
                    <button class="inspect-btn" data-player-id="${player.id}" title="Проверить финансы">
                        👁️
                    </button>

                    <div class="permission-toggle">
                        <span class="permission-label">Авто</span>
                        <label class="switch">
                            <input type="checkbox" class="perm-toggle-input" 
                                data-player-id="${player.id}" 
                                data-perm="canSeeAutofill" 
                                ${canSeeAutofill ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div class="permission-toggle">
                        <span class="permission-label">Факт</span>
                        <label class="switch">
                            <input type="checkbox" class="perm-toggle-input" 
                                data-player-id="${player.id}" 
                                data-perm="canSeeActual" 
                                ${canSeeActual ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            `;
            list.appendChild(li);
        });

        // Add Event Listeners for Toggles
        document.querySelectorAll('.perm-toggle-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const playerId = e.target.getAttribute('data-player-id');
                const permission = e.target.getAttribute('data-perm');
                const value = e.target.checked;

                console.log(`🔌 Curator toggling ${permission} for ${playerId} to ${value}`);

                socket.emit('curator:toggle_permission', { playerId, permission, value }, (res) => {
                    if (!res || !res.success) {
                        // Revert if failed
                        e.target.checked = !value;
                        console.error('Failed to toggle permission');
                    }
                });
            });
        });

        // Add Event Listener for Name Click (Inspection)
        document.querySelectorAll('.inspect-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                const playerId = e.currentTarget.getAttribute('data-player-id');
                if (window.inspectPlayer) {
                    window.inspectPlayer(playerId);
                } else {
                    console.error('Function inspectPlayer not found in window');
                }
            });
        });

        // Add Event Listener for Inspect Button
        document.querySelectorAll('.inspect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerId = e.currentTarget.getAttribute('data-player-id');
                if (window.inspectPlayer) {
                    window.inspectPlayer(playerId);
                } else {
                    console.error('Function inspectPlayer not found in window');
                }
            });
        });
    }

    // Слушать обновления для панели куратора
    socket.on('game:state_update', (state) => {
        // Если панель открыта, обновляем её
        if (!curatorPanelModal.classList.contains('hidden')) {
            updateCuratorPanel(state);
        }
    });

    // === GAME OVER LOGIC ===
    socket.on('game:game_over', (data) => {
        console.log('🏆 GAME OVER! Winners:', data.winners);
        // Temporary Debug Alert
        // alert('DEBUG: Game Over event received! Modal should appear.'); 
        // Commenting out alert to avoid annoyance, but console is key. 
        // User asked for "where is modal", it's in JS.
        showGameOverModal(data.winners);
    });

    function showGameOverModal(winners) {
        console.log('🏆 === ПОКАЗ МОДАЛКИ GAME OVER ===');
        console.log('Победители:', winners);

        // 0. ЗАКРЫВАЕМ ПАНЕЛЬ КУРАТОРА если она открыта
        const curatorPanelModal = document.getElementById('curator-panel-modal');
        if (curatorPanelModal && !curatorPanelModal.classList.contains('hidden')) {
            console.log('🚪 Закрываем панель куратора перед показом модалки победы');
            curatorPanelModal.classList.add('hidden');
        }

        // 1. Get Static Modal
        const modal = document.getElementById('game-over-modal');
        if (!modal) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Элемент #game-over-modal не найден в DOM!');
            console.log('Проверьте board.html - должен быть элемент с id="game-over-modal"');
            return;
        }

        console.log('✅ Модалка найдена в DOM');

        // Bind finish button (ensure single listener using cloneNode or check)
        const btn = document.getElementById('btn-force-finish');
        if (btn) {
            console.log('✅ Кнопка "Завершить игру" найдена, привязываем обработчик');
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => {
                console.log('🔄 Нажата кнопка полного сброса игры');
                if (confirm('Это полностью сбросит игру для всех. Продолжить?')) {
                    console.log('Отправка события curator:force_reset');
                    socket.emit('curator:force_reset', () => {
                        console.log('Перезагрузка страницы...');
                        window.location.reload();
                    });
                }
            });
        } else {
            console.warn('⚠️ Кнопка #btn-force-finish не найдена');
        }

        // 2. Populate Winners
        console.log('Заполняем список победителей...');
        const list = document.getElementById('winners-list');
        if (!list) {
            console.error('❌ Элемент #winners-list не найден!');
            return;
        }

        list.innerHTML = winners.map(w => {
            let icon = '';
            let style = '';

            if (w.rank === 1) { icon = '🥇'; style = 'color: #ffd700; font-weight: bold; font-size: 1.5rem; border: 1px solid #ffd700; background: rgba(255, 215, 0, 0.1);'; }
            else if (w.rank === 2) { icon = '🥈'; style = 'color: #c0c0c0; font-weight: bold; font-size: 1.3rem; border: 1px solid #c0c0c0; background: rgba(192, 192, 192, 0.1);'; }
            else if (w.rank === 3) { icon = '🥉'; style = 'color: #cd7f32; font-weight: bold; font-size: 1.2rem; border: 1px solid #cd7f32; background: rgba(205, 127, 50, 0.1);'; }
            else { icon = '❤️'; style = 'color: #cbd5e0; font-size: 1rem;'; }

            return `
                <div style="display: flex; align-items: center; padding: 10px; margin-bottom: 8px; border-radius: 8px; ${style}">
                    <span style="font-size: 2rem; margin-right: 15px;">${icon}</span>
                    <div style="text-align: left; flex: 1;">
                        <div style="font-size: 1.2em;">${w.name}</div>
                        <div style="font-size: 0.8em; opacity: 0.8;">
                            ${w.dreamAchieved ? '✨ Мечта исполнена!' : 'Мечта не достигнута'} | 💰 ${w.totalMoney} ₸
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        console.log(`✅ Список победителей заполнен (${winners.length} игроков)`);

        // 3. СНАЧАЛА ЗАПУСКАЕМ САЛЮТ (до показа модалки!)
        console.log('🎉 Запускаем салют ПЕРЕД показом модалки...');
        launchCelebration();

        // 4. ПОТОМ показываем модалку (с небольшой задержкой для эффекта)
        setTimeout(() => {
            console.log('📋 Показываем модалку...');
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            console.log('✅ Модалка показана');
        }, 500); // Задержка 0.5 сек чтобы салют начался первым
    }

    function launchCelebration() {
        console.log('🎉 === ЗАПУСК САЛЮТА ===');

        // Проверяем наличие библиотеки confetti
        if (!window.confetti) {
            console.error('❌ ОШИБКА: Библиотека canvas-confetti не загружена!');
            console.log('Проверьте подключение скрипта в board.html');
            return;
        }

        console.log('✅ Библиотека confetti найдена, запускаем анимацию...');

        // Немедленный залп для мгновенного эффекта
        try {
            window.confetti({
                particleCount: 150,
                spread: 100,
                origin: { y: 0.6 },
                colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731'],
                zIndex: 999999 // МАКСИМАЛЬНЫЙ z-index чтобы быть поверх ВСЕХ модалок
            });
            console.log('✅ Первый залп запущен');
        } catch (e) {
            console.error('❌ Ошибка при запуске первого залпа:', e);
        }

        // Продолжительная анимация (15 секунд)
        const duration = 15 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = {
            startVelocity: 30,
            spread: 360,
            ticks: 60,
            zIndex: 999999, // МАКСИМАЛЬНЫЙ z-index
            colors: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#ff9ff3']
        };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                console.log('🎉 Салют завершен');
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);

            try {
                window.confetti(Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                }));
                window.confetti(Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                }));
            } catch (e) {
                console.error('❌ Ошибка в цикле салюта:', e);
                clearInterval(interval);
            }
        }, 250);

        console.log('✅ Цикл салюта запущен на 15 секунд');
    }

    // --- RESPONSIVE FIX: Reposition players on resize ---
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log('🔄 Window resized. Recalculating player positions...');
            if (gameClient.gameState && gameClient.gameState.players) {
                // Reuse the existing display logic which handles positioning
                // Or call positionPlayerOnCell directly for existing figures
                const players = gameClient.gameState.players;

                // Optimized loop: just update positions of existing DOM elements
                Object.values(players).forEach((player) => {
                    if (!player.isActive) return;

                    const figure = document.querySelector(`.player-figure[data-player-id="${player.id}"]`);
                    const cell = document.querySelector(`.${player.position.currentCell}`);

                    if (figure && cell) {
                        // Find index (hacky recalc or store it?) 
                        // positionPlayerOnCell needs index for offsets.
                        // Let's recalculate index simply.
                        const playersOnThisCell = Object.values(players).filter(p =>
                            p.isActive && p.position.currentCell === player.position.currentCell
                        );
                        // Sort by ID to ensure consistent order
                        playersOnThisCell.sort((a, b) => a.id.localeCompare(b.id));
                        const index = playersOnThisCell.findIndex(p => p.id === player.id);

                        window.positionPlayerOnCell(figure, cell, index !== -1 ? index : 0);
                    }
                });
            }
        }, 100); // Debounce 100ms
    });

});

// Экспорт для использования в других модулях
window.gameClient = gameClient;
window.authenticatePlayer = authenticatePlayer;
window.requestDiceRoll = function () {
    console.log('🎲 Запрос броска кубика...');
    socket.emit('player:request_roll', (response) => {
        if (!response.success) {
            console.error('Ошибка броска:', response.error);
            alert(response.error);
        }
    });
};

window.sendMoveRequest = function (steps) {
    console.log(`📤 Отправка хода: ${steps} шагов`);
    socket.emit('player:move', { steps }, (response) => {
        if (!response.success) {
            console.error('Ошибка хода:', response.error);
            alert(response.error);
        }
    });
};

/**
 * Запросить вытягивание карты из колоды
 */
window.drawCardFromDeck = function (deckId) {
    return new Promise((resolve, reject) => {
        console.log(`🃏 Запрос карты из колоды ${deckId}...`);
        socket.emit('player:draw_card_from_deck', { deckId }, (response) => {
            if (response.success) {
                resolve(response.card);
            } else {
                console.error('Ошибка вытягивания карты:', response.error);
                alert(response.error);
                reject(response.error);
            }
        });
    });
};

window.sendCloseWindowSignal = function () {
    socket.emit('player:close_window');
};

window.finishTurn = function () {
    socket.emit('player:finish_turn');
};

/**
 * Запрос на бросок монетки
 */
window.requestCoinFlip = function () {
    socket.emit('player:flip_coin', (response) => {
        if (!response.success) {
            console.error('❌ Ошибка броска монетки:', response.error);
            alert(response.error || 'Ошибка броска монетки');
        }
    });
};

// ============================================================================
// CHAT SYSTEM
// ============================================================================

function initChat() {
    console.log('💬 Инициализация чата...');

    // Only one input source now: The "Players Chat Panel" (bottom left)
    const playersInput = document.getElementById('players-chat-input');
    const playersSend = document.getElementById('players-chat-send');

    // Хелпер отправки
    const sendMessage = () => {
        if (!playersInput) return;
        const text = playersInput.value.trim();
        if (text) {
            socket.emit('player:send_chat_message', { text });
            playersInput.value = '';

            // Add fun animation to button
            if (playersSend) {
                playersSend.classList.add('animate__animated', 'animate__rubberBand');
                setTimeout(() => playersSend.classList.remove('animate__animated', 'animate__rubberBand'), 1000);
            }
        }
    };

    // Слушатели событий
    if (playersSend) playersSend.onclick = sendMessage;

    if (playersInput) {
        playersInput.onkeypress = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }
    // Collapse logic is handled in board.js
}

/**
 * КАРТА ВЫТЯНУТА (Hybrid Handler)
 * Приоритет: animateCardDraw для немедленного отображения (по требованию пользователя),
 * но с обязательным управлением флагом isEventWindowOpen (внутри animateCardDraw).
 */
socket.on('game:card_drawn', (data) => {
    console.log(`🃏 Игрок ${data.playerName} вытянул карту:`, data);

    const isMyTurn = (data.playerId === gameClient.myPlayerId);

    // 1. Попытка использовать восстановленную анимацию (прямой показ)
    if (typeof window.animateCardDraw === 'function') {
        // Это откроет окно и выставит isEventWindowOpen = true
        window.animateCardDraw(data.deckId, data.card, data.playerName, isMyTurn);
    }
    // 2. Fallback: Если вдруг скрипт не загружен, добавляем в очередь
    else if (typeof addToEventQueue === 'function') {
        const event = {
            type: 'card',
            title: data.card.title || 'Карточка',
            message: isMyTurn ?
                (data.card.descriptionSelf || data.card.description) :
                (data.card.descriptionOthers || data.card.description),
            playerName: data.playerName,
            // ... minimal data for fallback
            hasButtons: isMyTurn && data.card.hasButtons,
            action: data.card.action
            // (Full mapping omitted for brevity as animateCardDraw is primary)
        };
        addToEventQueue(event);
    }
});


/**
 * Скрыть все модальные окна карточек (синхронизация)
 */
socket.on('game:card_hide', () => {
    // 1. Скрываем модалку активного игрока (используем хелпер из deckanimation.js)
    if (typeof window.forceHideCard === 'function') {
        window.forceHideCard();
    } else {
        // Fallback если функция не загружена (или неправильный порядок скриптов)
        const activeCard = document.getElementById('card');
        if (activeCard) {
            activeCard.style.display = 'none'; // или удаление классов
            activeCard.classList.remove('is-window', 'is-flying');
        }
    }

    // 2. Скрываем модалку наблюдателя
    const observerModal = document.getElementById('observer-card-modal');
    if (observerModal) {
        observerModal.style.display = 'none';
    }

    console.log('🙈 Карточка скрыта по команде сервера');
});

/**
 * Получение сообщения чата (от игроков)
 */
socket.on('chat:broadcast', (data) => {
    // 1. Добавить только в ГЛАВНЫЙ чат (так как второго окна сообщений нет)
    addMessageToChat('main-chat-messages', data, 'player');

    // 2. Показать облачко над фигуркой (Speech Bubble)
    showSpeechBubble(data.playerId, data.text);
});

/**
 * Получение системного лога (только в главный чат)
 */




/**
 * Добавить сообщение в UI
 */
function addMessageToChat(containerId, data, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message message-${type}`;

    if (type === 'player') {
        if (data.playerId === gameClient.myPlayerId) {
            msgDiv.classList.add('my-message');
        }

        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author';
        authorSpan.textContent = data.playerName;

        // Цвет имени (опционально, можно добавить)

        msgDiv.appendChild(authorSpan);
        msgDiv.appendChild(document.createTextNode(data.text)); // Text node for safety

        // Добавить эмодзи к тексту если надо (простая реализация)
    } else {
        // System message
        msgDiv.innerHTML = data.text; // Allow HTML in system messages? Careful.
        // Let's stick to text content for safety unless we trust server styling
        // msgDiv.textContent = data.text; 
        // But we might want bold text. Let's trust local generation.
        // For now, innerHTML is fine as server generates it.
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

/**
 * Показать облачко над игроком
 */
function showSpeechBubble(playerId, text) {
    const figure = document.querySelector(`.player-figure[data-player-id="${playerId}"]`);

    if (!figure) return;

    // Удалить старое облачко если есть
    const existing = figure.querySelector('.speech-bubble');
    if (existing) existing.remove();

    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';
    bubble.textContent = text;

    figure.appendChild(bubble);

    // Удалить через 5 секунд
    setTimeout(() => {
        bubble.style.opacity = '0';
        bubble.style.transform = 'translate(-50%, -80%) scale(0.5)';
        setTimeout(() => bubble.remove(), 500); // Wait for animation
    }, 4500);
}

// Глобальная функция завершения хода
window.finishTurn = function () {
    console.log('🏁 Завершаем ход...');
    if (window.forceHideCard) window.forceHideCard();
    socket.emit('player:finish_turn');
};

// ============================================================================
// PERMISSIONS HANDLER
// ============================================================================

/**
 * Применить права доступа (скрыть/показать кнопки)
 */
function applyPermissions(permissions) {
    if (!permissions) return;

    console.log('🔒 Применение прав доступа:', permissions);

    // 1. Автозаполнение
    const autofillBtn = document.getElementById('btn-autofill-turn');
    if (autofillBtn) {
        if (permissions.canSeeAutofill) {
            autofillBtn.style.display = ''; // Restore default
            autofillBtn.classList.remove('hidden-by-perm');
        } else {
            autofillBtn.style.display = 'none';
            autofillBtn.classList.add('hidden-by-perm');
        }
    }

    // 2. Фактическая карточка
    const actualBtn = document.getElementById('btn-toggle-actual');
    if (actualBtn) {
        if (permissions.canSeeActual) {
            actualBtn.style.display = '';
            actualBtn.classList.remove('hidden-by-perm');
        } else {
            actualBtn.style.display = 'none';
            actualBtn.classList.add('hidden-by-perm');

            // Если была открыта фактическая карточка - закрыть её и вернуться в ручной
            // Но только если мы уже не в ручном (проверка класса)
            // Реализуем мягко: просто скрываем кнопку. Если игрок уже там - пусть сидит пока не закроет модалку?
            // Лучше принудительно вернуть в ручной режим если активен
            if (actualBtn.classList.contains('active')) {
                // Триггерим клик чтобы вернуть
                // Но лучше вызвать функцию board.js... но у нас нет доступа напрямую удобно
                // Просто скрываем кнопку.
            }
        }
    }
}

/**
 * Получение обновления прав
 */
socket.on('player:permissions_update', (permissions) => {
    // Обновляем локальные данные
    if (gameClient.myPlayerData) {
        gameClient.myPlayerData.permissions = permissions;
    }
    applyPermissions(permissions);
});

// Добавляем вызов applyPermissions при обновлении состояния (чтобы синхронизировать при реконнекте)
const originalUpdateGameBoard = window.updateGameBoard;
window.updateGameBoard = function (gameState) {
    if (originalUpdateGameBoard) originalUpdateGameBoard(gameState);

    // Проверяем свои права
    if (gameClient.myPlayerId && gameState.players && gameState.players[gameClient.myPlayerId]) {
        const myPlayer = gameState.players[gameClient.myPlayerId];
        if (myPlayer.permissions) {
            applyPermissions(myPlayer.permissions);
        }
    }
};
