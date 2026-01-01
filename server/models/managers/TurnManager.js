const cardService = require('../../services/CardService');

/**
 * Менеджер Хода (TurnManager)
 * Отвечает за:
 * - Запуск и завершение игры
 * - Очередность ходов (Next Turn)
 * - Таймеры ходов
 * - Бросок кубика
 * - Статистику игры
 */
class TurnManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Начать игру
     */
    startGame() {
        if (this.gameState.status === 'in_progress') {
            throw new Error('Игра уже начата');
        }

        this.gameState.status = 'in_progress';
        this.gameState.startedAt = new Date().toISOString();

        // Создаем колоды
        this.gameState.decks = cardService.createGameDecks();

        // Определяем первый ход (хост/первый игрок)
        const playerIds = Object.keys(this.gameState.players);
        if (playerIds.length > 0) {
            this.gameState.currentTurn = playerIds[0];
            // Сброс флага автозаполнения
            const firstPlayer = this.gameState.players[this.gameState.currentTurn];
            if (firstPlayer) {
                if (!firstPlayer.status) firstPlayer.status = {};
                firstPlayer.status.isAutofilledThisTurn = false;
            }
        }

        this.gameState.addToHistory({
            action: 'game_started',
            actorId: this.gameState.curator.id,
            actorName: this.gameState.curator.name,
            details: { message: 'Игра началась' }
        });

        console.log('🎮 Игра началась! Первый ход:', this.gameState.players[this.gameState.currentTurn]?.displayName);
        return { status: this.gameState.status, currentTurn: this.gameState.currentTurn };
    }

    /**
     * Передать ход следующему игроку
     */
    nextTurn() {
        const playerIds = Object.keys(this.gameState.players);
        if (playerIds.length === 0) return;

        // Если только один игрок - передаём ход ему же
        if (playerIds.length === 1) {
            const singlePlayerId = playerIds[0];
            const singlePlayer = this.gameState.players[singlePlayerId];

            console.log(`🔄 Один игрок (${singlePlayer.displayName}) - ход передаётся ему же`);

            // Сбрасываем только флаги, НЕ сбрасываем currentTurnData (для автозаполнения)
            singlePlayer.status.isAutofilledThisTurn = false;
            singlePlayer.status.isManuallyUpdatedThisTurn = false;
            this.gameState.currentTurn = singlePlayerId;
            return singlePlayerId;
        }

        const currentIndex = playerIds.indexOf(this.gameState.currentTurn);
        // Если currentTurn не найден (например первый ход) - начинаем с первого игрока
        let nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % playerIds.length;
        const nextPlayerId = playerIds[nextIndex];
        const nextPlayer = this.gameState.players[nextPlayerId];

        // === ПРОВЕРКА ПРОПУСКА ХОДА (Интерактивная логика) ===
        if (nextPlayer.status.skippedTurns > 0) {
            console.log(`⏩ Остановка на ${nextPlayer.displayName} для уведомления о пропуске хода (осталось: ${nextPlayer.status.skippedTurns})`);
            this.gameState.currentTurn = nextPlayerId;
            return nextPlayerId;
        }

        // === ПРОВЕРКА СПЯЩЕГО ИГРОКА ===
        if (nextPlayer.isSleeping) {
            console.log(`💤 Игрок ${nextPlayer.displayName} спит - пропускаем`);

            this.gameState.addToHistory({
                action: 'sleeping_player_skipped',
                actorId: nextPlayerId,
                actorName: nextPlayer.displayName,
                details: { message: 'Игрок спит, ход пропущен' }
            });

            this.gameState.currentTurn = nextPlayerId;
            return this.nextTurn();
        }

        // Назначаем ход
        this.gameState.currentTurn = nextPlayerId;

        // Сбрасываем только флаги, НЕ сбрасываем currentTurnData (для автозаполнения)
        nextPlayer.status.isAutofilledThisTurn = false;
        nextPlayer.status.isManuallyUpdatedThisTurn = false;

        console.log(`➡️ Ход: ${nextPlayer.displayName}`);
        return this.gameState.currentTurn;
    }

    /**
     * Бросить кубик
     */
    rollDice(playerId) {
        const player = this.gameState.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        let result, isDoubleDice = false, isPartial = false;

        // Бонус двойного кубика (благотворительность)
        if (player.status.doubleDiceTurnsRemaining > 0) {
            isDoubleDice = true;

            if (player.status.pendingDoubleRoll !== null) {
                // ВТОРОЙ бросок
                const dice2 = Math.floor(Math.random() * 6) + 1;
                const dice1 = player.status.pendingDoubleRoll;
                result = dice1 + dice2;

                console.log(`🎲🎲 Второй бросок: ${dice2}. Итого (сумма): ${result}`);

                // Очищаем и уменьшаем счетчик ходов
                player.status.pendingDoubleRoll = null;
                player.status.doubleDiceTurnsRemaining--;

                isPartial = false;
            } else {
                // ПЕРВЫЙ бросок
                result = Math.floor(Math.random() * 6) + 1;
                player.status.pendingDoubleRoll = result;

                console.log(`🎲 Бросок 1: ${result}. Ожидание броска 2...`);

                isPartial = true;
            }
        } else {
            // Обычный бросок
            result = Math.floor(Math.random() * 6) + 1;
            console.log(`🎲 Обычный бросок: ${result}`);
            isPartial = false;
        }

        this.gameState.addToHistory({
            action: 'roll_dice',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                diceResult: result,
                isDoubleDice,
                isPartial,
                message: isPartial
                    ? `Первый бросок: ${result}. Нужно бросить еще раз!`
                    : (isDoubleDice ? `Бонус! Сумма: ${result}` : `Выпало: ${result}`)
            }
        });

        return { result, isDoubleDice, isPartial };
    }

    /**
     * Завершение игры
     */
    endGame() {
        this.gameState.status = 'finished';
        this.gameState.finishedAt = new Date().toISOString();

        this.gameState.addToHistory({
            action: 'game_ended',
            actorId: this.gameState.curator.id,
            actorName: this.gameState.curator.name,
            details: { message: 'Игра завершена' }
        });

        return this.generateReport();
    }

    /**
     * Генерация отчета
     */
    generateReport() {
        return {
            gameInfo: {
                status: this.gameState.status,
                startedAt: this.gameState.startedAt,
                duration: this.calculateGameDuration()
            },
            players: this.gameState.players,
            gameHistory: this.gameState.gameHistory,
            statistics: this.calculateStatistics()
        };
    }

    calculateGameDuration() {
        if (!this.gameState.startedAt) return 0;
        const end = this.gameState.finishedAt ? new Date(this.gameState.finishedAt) : new Date();
        const start = new Date(this.gameState.startedAt);
        return Math.round((end - start) / 1000 / 60);
    }

    calculateStatistics() {
        return {
            totalPlayers: Object.keys(this.gameState.players).length,
            totalActions: this.gameState.gameHistory.length,
            totalDiceRolls: this.gameState.gameHistory.filter(h => h.action === 'roll_dice').length,
            totalCardsDrawn: this.gameState.gameHistory.filter(h => h.action === 'card_drawn').length
        };
    }

    /**
     * Вспомогательный метод для сброса данных хода игрока
     */
    resetPlayerTurnData(player) {
        if (!player) return;

        // Сбрасываем флаги
        player.status.isAutofilledThisTurn = false;
        player.status.isManuallyUpdatedThisTurn = false;

        // Очищаем данные текущего хода
        player.currentTurnData = {
            incomeEntries: [],
            expenseEntries: [],
            walletChanges: {
                savings: 0,
                investments: 0,
                charity: 0,
                dream: 0
            }
        };

        console.log(`🔄 Данные хода сброшены для ${player.displayName}`);
    }
}

module.exports = TurnManager;
