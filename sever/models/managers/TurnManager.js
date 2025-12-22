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
        if (this.gameState.status !== 'waiting') {
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

        const currentIndex = playerIds.indexOf(this.gameState.currentTurn);
        let nextIndex = (currentIndex + 1) % playerIds.length;
        const nextPlayerId = playerIds[nextIndex];
        const nextPlayer = this.gameState.players[nextPlayerId];

        // === ПРОВЕРКА ПРОПУСКА ХОДА ===
        if (nextPlayer.status.skippedTurns > 0) {
            console.log(`⏩ ${nextPlayer.displayName} пропускает ход (осталось: ${nextPlayer.status.skippedTurns - 1})`);
            nextPlayer.status.skippedTurns--;

            this.gameState.addToHistory({
                action: 'turn_skipped',
                actorId: nextPlayerId,
                actorName: nextPlayer.displayName,
                details: { remainingSkips: nextPlayer.status.skippedTurns }
            });

            // Рекурсивно переходим к следующему
            // (но обновляем currentTurn на этого, чтобы рекурсия сработала корректно от него)
            this.gameState.currentTurn = nextPlayerId;
            return this.nextTurn();
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

        // Сбрасываем временные данные хода
        if (nextPlayer.currentTurnData) {
            nextPlayer.currentTurnData = {
                incomeEntries: [], expenseEntries: [],
                walletChanges: { savings: 0, investments: 0, charity: 0, dream: 0 }
            };
        }

        console.log(`➡️ Ход: ${nextPlayer.displayName}`);
        return this.gameState.currentTurn;
    }

    /**
     * Бросить кубик
     */
    rollDice(playerId) {
        const player = this.gameState.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        let result, dice1, dice2, isDoubleDice = false;

        // Бонус двойного кубика (благотворительность)
        if (player.doubleDiceTurnsRemaining > 0) {
            dice1 = Math.floor(Math.random() * 6) + 1;
            dice2 = Math.floor(Math.random() * 6) + 1;
            result = dice1 + dice2;
            isDoubleDice = true;
            player.doubleDiceTurnsRemaining--;
            console.log(`🎲🎲 2 кубика: ${result}`);
        } else {
            result = Math.floor(Math.random() * 6) + 1;
            console.log(`🎲 1 кубик: ${result}`);
        }

        this.gameState.addToHistory({
            action: 'roll_dice',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                diceResult: result,
                isDoubleDice,
                message: isDoubleDice ? `Бонус! Выпало ${result}` : `Выпало: ${result}`
            }
        });

        return result;
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
}

module.exports = TurnManager;
