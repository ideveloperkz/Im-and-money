/**
 * Клиент для подключения к серверу игры
 * Управляет авторизацией, синхронизацией состояния и отображением игроков
 */

// Подключение к серверу
// Robust connection logic to support File protocol, Mobile IPs, and disparate ports
const getSocketUrl = () => {
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

        // Новая логика:Fork -> Coin -> ForkDirection -> Dice
        const forkDirectionSet = (player.forkDirection !== null && player.forkDirection !== undefined);

        // Логика Кубика
        // Активен если: Мой ход И не бросил И (не развилка ИЛИ (развилка И направление выбрано))
        let canRoll = isMyTurn && gameState.status === 'in_progress' && !hasRolled;

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

    // Сбросить флаг броска если ход сменился
    if (gameClient.gameState && state.currentTurn !== gameClient.gameState.currentTurn) {
        if (state.currentTurn === gameClient.myPlayerId) {
            console.log('🔔 Ваш шаг! Кнопка броска активирована.');
            gameClient.hasRolled = false;
        }
    }
    // Также сбросить если впервые получили состояние и это наш ход (на всякий случай)
    if (!gameClient.gameState && state.currentTurn === gameClient.myPlayerId) {
        gameClient.hasRolled = false;
    }

    updateGameBoard(state);
    displayAllPlayers(state.players);

    // === УПРАВЛЕНИЕ КНОПКОЙ ХОСТА ===
    updateHostButton(state);
});

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

    // Обновить кнопку "Начать игру" -> "Завершить игру"
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.textContent = '🏁 Завершить игру';
        startBtn.classList.add('game-running');
    }

    // Можно показать уведомление
    // TODO: показать уведомление "Игра началась"
});

/**
 * Игра автоматически сброшена (все игроки покинули)
 */
socket.on('game:auto_reset', (data) => {
    console.log('🔄 Авто-сброс:', data.message);

    // Сбросить UI
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.textContent = '🚀 Начать игру';
        startBtn.classList.remove('game-running');
    }

    const gameStatusDisplay = document.getElementById('game-status-display');
    if (gameStatusDisplay) {
        gameStatusDisplay.textContent = 'Статус: Ожидание';
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
    console.log(`🎲 ${data.playerName} бросил кубик: ${data.result}`);

    // Блокируем кнопку, если это мы
    if (data.playerId === gameClient.myPlayerId) {
        gameClient.hasRolled = true;
        if (gameClient.gameState) {
            updateGameBoard(gameClient.gameState);
        }
    }

    // Показываем анимацию ВСЕМ игрокам
    const isMyTurn = (data.playerId === gameClient.myPlayerId);

    if (!window.DiceGameInstance) {
        console.error('❌ DiceGameInstance not found! Animation cannot start.');
    } else {
        console.log('🎲 Starting dice animation...');
    }

    if (window.DiceGameInstance) {
        window.DiceGameInstance.showDiceAnimation(data.result, isMyTurn, data.prediction);
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
socket.on('game:card_drawn', (data) => {
    console.log(`🃏 Игрок ${data.playerName} вытянул карту из колоды ${data.deckId}`);

    const isMyTurn = (data.playerId === gameClient.myPlayerId);

    if (isMyTurn) {
        // Активный игрок - запускаем полную анимацию
        if (window.animateCardDraw) {
            window.animateCardDraw(data.deckId, data.card, data.playerName, true);
        }
    } else {
        // НАБЛЮДАТЕЛИ - ПРИНУДИТЕЛЬНОЕ отображение окна БЕЗ сложной анимации
        console.log('👁️ OBSERVER: Forcing card window display');
        forceShowCardForObserver(data.card, data.playerName, data.deckId);
    }
});

/**
 * ПРИНУДИТЕЛЬНОЕ отображение карточки для наблюдателей
 * Использует ОТДЕЛЬНЫЙ модальный элемент #observer-card-modal
 * Полностью независим от deckanimation.js и анимации #card
 */
function forceShowCardForObserver(cardData, playerName, deckId) {
    // Используем ОТДЕЛЬНЫЙ модальный элемент для наблюдателей
    const observerModal = document.getElementById('observer-card-modal');
    const observerTitle = document.getElementById('observer-card-title');
    const observerText = document.getElementById('observer-card-text');
    const observerExtra = document.getElementById('observer-card-extra');
    const observerPlayer = document.getElementById('observer-card-player');

    if (!observerModal) {
        console.error('❌ Observer modal not found!');
        return;
    }

    // Заголовок
    const titles = { '1': 'РАСХОДЫ', '2': 'БИЗНЕС', '3': 'НОВОСТИ', '4': 'ШАНС' };
    if (observerTitle) observerTitle.textContent = cardData.title || titles[deckId] || 'КАРТОЧКА';

    // Текст (для наблюдателей)
    let description = '';
    if (cardData.description_others) {
        description = cardData.description_others
            .replace(/{player}/g, playerName)
            .replace(/{Player}/g, playerName);
    } else {
        description = cardData.text || cardData.description || '...';
    }
    if (observerText) observerText.textContent = description;

    // Доп. инфо
    let extraInfo = '';
    if (cardData.cost) extraInfo += `Цена: ${cardData.cost} | `;
    if (cardData.price) extraInfo += `Цена: ${cardData.price} | `;
    if (cardData.income) extraInfo += `Доход: ${cardData.income} | `;
    if (cardData.money) extraInfo += `Сумма: ${cardData.money} | `;
    if (observerExtra) observerExtra.textContent = extraInfo;

    // Инфо о игроке
    if (observerPlayer) observerPlayer.textContent = `${playerName} вытянул карту...`;

    // ПОКАЗЫВАЕМ модальное окно
    observerModal.style.display = 'block';

    console.log('✅ OBSERVER: Separate modal displayed');
}

/**
 * Скрыть окно наблюдателя
 */
function hideObserverCardModal() {
    const observerModal = document.getElementById('observer-card-modal');
    if (observerModal) {
        observerModal.style.display = 'none';
    }
}


socket.on('game:close_all_windows', () => {
    // Close Dice Modal
    const diceModal = document.getElementById('diceResultModal');
    if (diceModal) diceModal.classList.remove('show');

    // Close Card Modal (for active player)
    if (window.forceHideCard) window.forceHideCard();

    // Close Observer Card Modal (for observers)
    hideObserverCardModal();
});

socket.on('game:hide_dice_modal', () => {
    // Legacy support or specific use
    const diceModal = document.getElementById('diceResultModal');
    if (diceModal) diceModal.classList.remove('show');
});

/**
 * Игрок переместился
 */
/**
 * Игрок переместился
 */
socket.on('player:moved', (data) => {
    console.log(`🚶 ${data.playerName} переместился на ${data.position.currentCell}`);

    // Обновить позицию игрока
    if (gameClient.gameState && gameClient.gameState.players[data.playerId]) {
        gameClient.gameState.players[data.playerId].position = data.position;
    }

    // Переместить фигурку с анимацией
    movePlayerFigure(data.playerId, data.position.currentCell);

    // Если это я переместился, обработать результат ячейки (для развилок)
    if (data.playerId === gameClient.myPlayerId) {
        handleCellResult(data.cellResult);

        // === НОВОЕ: Обработка пройденных клеток "Деньги" ===
        if (data.passedMoneyCells && data.passedMoneyCells.length > 0) {
            console.log(`💰 Пройдены клетки "Деньги": ${data.passedMoneyCells.join(', ')}`);
            gameClient.passedMoneyCells = data.passedMoneyCells;
            enableMoneyCellsClick(data.passedMoneyCells);
        } else {
            gameClient.passedMoneyCells = [];
        }
    }
});

/**
 * СОБЫТИЕ КЛЕТКИ (Личное для активного игрока)
 */
socket.on('game:cell_event', (data) => {
    console.log('🔔 Событие клетки:', data);
    const isMyTurn = (gameClient.myPlayerId === gameClient.gameState.currentTurn);

    // Показываем модальное окно события (то же, что и карточка)
    showEventModal(data, isMyTurn);
});

/**
 * УВЕДОМЛЕНИЕ (Для остальных игроков) - ИСПОЛЬЗУЕТ ОТДЕЛЬНЫЙ МОДАЛЬНЫЙ ЭЛЕМЕНТ
 */
socket.on('game:notification', (data) => {
    console.log('📢 Уведомление (OBSERVER):', data);

    // Наблюдатели используют отдельный модальный элемент как для карточек
    showObserverCellEvent(data.title, data.message, data.playerName);
});

/**
 * Показать событие клетки для наблюдателей (отдельный модальный элемент)
 */
function showObserverCellEvent(title, message, playerName) {
    const observerModal = document.getElementById('observer-card-modal');
    const observerTitle = document.getElementById('observer-card-title');
    const observerText = document.getElementById('observer-card-text');
    const observerExtra = document.getElementById('observer-card-extra');
    const observerPlayer = document.getElementById('observer-card-player');

    if (!observerModal) {
        console.error('❌ Observer modal not found!');
        return;
    }

    // Заголовок
    if (observerTitle) observerTitle.textContent = title || 'СОБЫТИЕ';

    // Текст события
    if (observerText) observerText.textContent = message || '';

    // Очистить доп. инфо
    if (observerExtra) observerExtra.textContent = '';

    // Инфо о игроке
    if (observerPlayer && playerName) {
        observerPlayer.textContent = `${playerName} попал на клетку...`;
    } else if (observerPlayer) {
        observerPlayer.textContent = '';
    }

    // ПОКАЗЫВАЕМ модальное окно с легкой анимацией
    observerModal.style.display = 'block';
    observerModal.style.opacity = '0';
    observerModal.style.transition = 'opacity 0.5s ease';

    // Force reflow
    void observerModal.offsetWidth;
    observerModal.style.opacity = '1';

    console.log('✅ OBSERVER: Cell event modal displayed');

    // АВТО-ЗАКРЫТИЕ ЧЕРЕЗ 4 СЕКУНДЫ
    if (window.observerModalTimer) clearTimeout(window.observerModalTimer);
    window.observerModalTimer = setTimeout(() => {
        observerModal.style.opacity = '0';
        setTimeout(() => {
            observerModal.style.display = 'none';
        }, 500);
    }, 4000);
}


/**
 * Обработать результат ячейки (Старая логика для Fork)
 */
function handleCellResult(cellResult) {
    if (!cellResult) return;
    console.log('📍 Результат ячейки:', cellResult);

    // Только для развилки используем старую логику с алертом
    if (cellResult.action === 'choose_path') {
        setTimeout(() => {
            alert('Вы на развилке! На следующем ходу вы бросите монетку, чтобы выбрать путь.\n\nНажмите ОК, чтобы передать ход.');
            if (gameClient.myPlayerId === gameClient.gameState.currentTurn) {
                window.finishTurn();
            }
        }, 500);
    }
}


/**
 * Показать модальное окно события/карточки
 */
function showEventModal(data, isActivePlayer) {
    const cardModal = document.getElementById('card');
    const cardTitle = document.getElementById('card-title');
    const cardText = document.getElementById('card-text');
    const cardExtra = document.getElementById('card-extra-info'); // Контейнер для кнопок
    const closeBtn = document.getElementById('card-close-btn'); // Стандартная кнопка закрытия
    const cardImage = document.getElementById('cardImage');

    if (!cardModal) return;

    // 1. Установка контента
    cardTitle.textContent = data.title || 'Событие';
    cardText.textContent = data.description || '';

    // Сброс
    cardExtra.innerHTML = '';
    closeBtn.classList.add('hidden'); // Скрываем стандартную, будем управлять сами или покажем в конце
    closeBtn.onclick = null; // Сброс обработчиков

    // 2. Генерация кнопок действий
    if (isActivePlayer && data.action === 'choice' && data.options) {
        // РЕЖИМ ВЫБОРА - показываем кнопки с опциями
        console.log('📋 Показываем выбор с опциями:', data.options);

        data.options.forEach((option, index) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = option.text;
            btn.style.cssText = `
                display: block;
                width: 100%;
                margin: 10px 0;
                padding: 12px 20px;
                font-size: 16px;
                font-weight: bold;
                border: 2px solid #ffd700;
                border-radius: 8px;
                background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
                color: #ffd700;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            btn.onmouseover = () => {
                btn.style.background = 'linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)';
                btn.style.color = '#000';
            };
            btn.onmouseout = () => {
                btn.style.background = 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)';
                btn.style.color = '#ffd700';
            };

            btn.onclick = () => {
                console.log(`✅ Игрок выбрал опцию ${index}: ${option.text}`);

                // Отправляем выбор на сервер
                socket.emit('player:choice_made', {
                    cellId: gameClient.myPlayerData.position.currentCell,
                    optionIndex: index
                }, (response) => {
                    if (response && !response.success) {
                        console.error('❌ Ошибка выбора:', response.error);
                    }
                });

                // Закрываем окно (сервер уже сам передаст ход после выбора)
                hideCardModal();
                // НЕ вызываем finishTurn - сервер уже вызвал nextTurn() в player:choice_made
            };
            cardExtra.appendChild(btn);
        });

    } else if (isActivePlayer && data.action === 'offer_buy_dream_item') {
        // РЕЖИМ ПРЕДЛОЖЕНИЯ ПОКУПКИ (ЧУЖАЯ МЕЧТА)
        console.log('🛒 Предложение покупки:', data);

        // Кнопка "Купить"
        const btnBuy = document.createElement('button');
        btnBuy.className = 'choice-btn';
        btnBuy.innerHTML = `Купить за ${data.price} ₸<br><small>(из инвестиций)</small>`;
        btnBuy.style.cssText = `
            display: block; width: 100%; margin: 10px 0; padding: 12px;
            font-size: 16px; font-weight: bold;
            border: 2px solid #2ecc71; border-radius: 8px;
            background: #27ae60; color: white; cursor: pointer;
        `;
        btnBuy.onclick = () => {
            socket.emit('player:purchase_choice', {
                accept: true,
                price: data.price,
                name: data.name,
                walletSource: data.walletSource || 'investments',
                isAsset: data.isAsset
            }, (res) => {
                if (!res.success) alert(res.error);
                hideCardModal();
                // Server calls nextTurn
            });
        };
        cardExtra.appendChild(btnBuy);

        // Кнопка "Отказаться"
        const btnPass = document.createElement('button');
        btnPass.className = 'choice-btn';
        btnPass.textContent = 'Отказаться';
        btnPass.style.cssText = `
            display: block; width: 100%; margin: 5px 0; padding: 10px;
            font-size: 14px; border: 1px solid #7f8c8d; border-radius: 8px;
            background: transparent; color: #bdc3c7; cursor: pointer;
        `;
        btnPass.onclick = () => {
            socket.emit('player:purchase_choice', {
                accept: false,
                price: data.price,
                name: data.name
            }, () => {
                hideCardModal();
            });
        };
        cardExtra.appendChild(btnPass);

    } else if (!isActivePlayer && data.action === 'choice') {
        // Другие игроки видят, что кто-то выбирает
        const waitingText = document.createElement('div');
        waitingText.style.cssText = 'text-align: center; color: #aaa; font-style: italic; margin-top: 15px;';
        waitingText.textContent = 'Игрок делает выбор...';
        cardExtra.appendChild(waitingText);

    } else {
        // РЕЖИМ ИНФОРМАЦИИ (Или уведомление)
        if (isActivePlayer) {
            closeBtn.classList.remove('hidden');
            closeBtn.textContent = 'OK (Завершить ход)';
            closeBtn.onclick = () => {
                hideCardModal();
                window.finishTurn();
            };
        } else {
            // Наблюдатели просто видят информацию, кнопка не нужна
            // Окно закроется когда активный игрок закроет своё
        }
    }

    // 3. Показать окно (анимация)
    cardModal.style.display = 'block';

    // Анимация показа контента
    const content = document.getElementById('card-dynamic-content');
    content.style.opacity = '0';

    cardModal.classList.add('active');

    // Плавное появление текста
    setTimeout(() => {
        content.style.opacity = '1';
    }, 300);
}


function hideCardModal() {
    const cardModal = document.getElementById('card');
    if (cardModal) {
        cardModal.style.display = 'none';
        cardModal.classList.remove('active');
    }
}

// Глобальная функция завершения хода
window.finishTurn = function () {
    console.log('🏁 Завершаем ход...');
    socket.emit('player:finish_turn', (res) => {
        if (!res.success) console.warn(res.error);
    });
};

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
 * Обновить видимость и состояние кнопки хоста (Начать/Завершить игру)
 */
function updateHostButton(state) {
    const startBtn = document.getElementById('start-game-btn');
    if (!startBtn) return;

    const isHost = state.hostPlayerId === gameClient.myPlayerId;

    // Кнопка видна всегда, но активна только для хоста
    if (isHost) {
        // Хост - кнопка активна
        startBtn.disabled = false;
        startBtn.classList.remove('disabled');

        // Обновляем текст и стиль в зависимости от статуса игры
        if (state.status === 'in_progress') {
            startBtn.textContent = '🏁 Завершить игру';
            startBtn.classList.add('game-running');
        } else {
            startBtn.textContent = '🚀 Начать игру';
            startBtn.classList.remove('game-running');
        }

        console.log('👑 Вы хост - кнопка управления активна');
    } else {
        // Не хост - кнопка неактивна (disabled)
        startBtn.disabled = true;
        startBtn.classList.add('disabled');

        // Текст все равно обновляем
        if (state.status === 'in_progress') {
            startBtn.textContent = '🏁 Игра идёт';
            startBtn.classList.add('game-running');
        } else {
            startBtn.textContent = '🚀 Ожидание';
            startBtn.classList.remove('game-running');
        }

        console.log('👤 Вы не хост - кнопка неактивна');
    }
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
    const endGameBtn = document.getElementById('end-game-btn');

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

                    // Обновить UI панели
                    updateCuratorPanel(response.gameState);
                } else {
                    errorDiv.textContent = response.error;
                    errorDiv.style.display = 'block';
                }
            });
        });
    }

    // Начать/Завершить игру (может любой игрок) - ОДНА КНОПКА-ПЕРЕКЛЮЧАТЕЛЬ
    if (startGameBtn) {
        startGameBtn.addEventListener('click', () => {
            const isGameRunning = gameClient.gameState && gameClient.gameState.status === 'in_progress';

            if (!isGameRunning) {
                // НАЧАТЬ ИГРУ
                if (confirm('Начать игру? Все игроки получат уведомление.')) {
                    socket.emit('curator:start_game', (response) => {
                        if (response.success) {
                            alert('Игра началась!');
                            startGameBtn.textContent = '🏁 Завершить игру';
                            startGameBtn.classList.add('game-running');
                            // Обновить статус в панели куратора если она открыта
                            const gameStatusDisplay = document.getElementById('game-status-display');
                            if (gameStatusDisplay) {
                                gameStatusDisplay.textContent = 'Статус: ИДЕТ ИГРА';
                            }
                            if (endGameBtn) {
                                endGameBtn.classList.remove('hidden');
                            }
                        } else {
                            alert('Ошибка: ' + (response.error || 'Не удалось начать игру'));
                        }
                    });
                }
            } else {
                // ЗАВЕРШИТЬ ИГРУ
                if (confirm('Завершить игру?')) {
                    socket.emit('curator:end_game', (response) => {
                        if (response.success) {
                            alert('Игра завершена!');
                            startGameBtn.textContent = '🚀 Начать игру';
                            startGameBtn.classList.remove('game-running');
                            const gameStatusDisplay = document.getElementById('game-status-display');
                            if (gameStatusDisplay) {
                                gameStatusDisplay.textContent = 'Статус: ЗАВЕРШЕНА';
                            }
                            if (endGameBtn) {
                                endGameBtn.classList.add('hidden');
                            }
                        }
                    });
                }
            }
        });
    }

    // Завершить игру (кнопка в панели куратора - оставляем для совместимости)
    if (endGameBtn) {
        endGameBtn.addEventListener('click', () => {
            if (confirm('Завершить игру?')) {
                socket.emit('curator:end_game', (response) => {
                    if (response.success) {
                        alert('Игра завершена!');
                        endGameBtn.classList.add('hidden');
                        startGameBtn.textContent = '🚀 Начать игру';
                        startGameBtn.classList.remove('game-running');
                        const gameStatusDisplay = document.getElementById('game-status-display');
                        if (gameStatusDisplay) {
                            gameStatusDisplay.textContent = 'Статус: ЗАВЕРШЕНА';
                        }
                    }
                });
            }
        });
    }

    function updateCuratorPanel(state) {
        if (!state) return;

        // Статус
        const statusDisplay = document.getElementById('game-status-display');
        if (state.status === 'waiting') {
            statusDisplay.textContent = 'Статус: Ожидание начала';
            startGameBtn.classList.remove('hidden');
            endGameBtn.classList.add('hidden');
        } else if (state.status === 'in_progress') {
            statusDisplay.textContent = 'Статус: ИДЕТ ИГРА';
            startGameBtn.classList.add('hidden');
            endGameBtn.classList.remove('hidden');
        }

        // Список игроков
        const list = document.getElementById('curator-players-list');
        list.innerHTML = '';

        Object.values(state.players).forEach(player => {
            if (!player.isActive) return;
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <span class="player-status-dot"></span>
                    ${player.displayName} (${player.firstName})
                </div>
                <div>${player.position.currentCell}</div>
            `;
            list.appendChild(li);
        });
    }

    // Слушать обновления для панели куратора
    socket.on('game:state_update', (state) => {
        // Если панель открыта, обновляем её
        if (!curatorPanelModal.classList.contains('hidden')) {
            updateCuratorPanel(state);
        }
    });

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
 * Получение специального уведомления (Alert)
 * Используется для важных событий: покупка, продажа, банкротство и т.д.
 */
socket.on('game:notification', (data) => {
    console.log('🔔 Notification:', data);
    // Возвращаем "специальное окошко" (showSystemAlert)
    if (data.message) {
        showSystemAlert(data.message);
    }
});

/**
 * Получение системного лога (только в главный чат + облачко)
 */
socket.on('game:log', (data) => {
    addMessageToChat('main-chat-messages', data, 'system');

    // Важные уведомления теперь приходят через game:notification -> showSpeechBubble
    // Поэтому здесь убираем дублирование алертов

});

/**
 * Показать системное уведомление (по центру экрана)
 */

/**
 * Показать системное уведомление (по центру экрана)
 * "Специальное окошко", стили заданы в JS.
 */
function showSystemAlert(text) {
    let alertContainer = document.getElementById('system-alerts-container');

    // Создаем контейнер, если нет
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'system-alerts-container';
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '20%';
        alertContainer.style.left = '50%';
        alertContainer.style.transform = 'translate(-50%, -50%)';
        alertContainer.style.zIndex = '10000';
        alertContainer.style.pointerEvents = 'none';
        document.body.appendChild(alertContainer);
    }

    const alertBox = document.createElement('div');
    alertBox.className = 'game-alert-box';
    alertBox.textContent = text;

    // Стили прямо здесь
    Object.assign(alertBox.style, {
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#ff4444',
        padding: '15px 30px',
        marginBottom: '10px',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 'bold',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
        border: '2px solid #ff4444',
        opacity: '0',
        transition: 'opacity 0.3s ease-in-out, transform 0.3s ease'
    });

    alertContainer.appendChild(alertBox);

    // Анимация появления
    requestAnimationFrame(() => {
        alertBox.style.opacity = '1';
        alertBox.style.transform = 'translateY(10px)';
    });

    // Удаление через 4 секунды
    setTimeout(() => {
        alertBox.style.opacity = '0';
        alertBox.style.transform = 'translateY(-20px)';
        setTimeout(() => alertBox.remove(), 300);
    }, 4000);
}


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


