const board = require('../../board');

/**
 * Менеджер Движения (MovementManager)
 * Отвечает за:
 * - Перемещение фишки по доске
 * - Логику развилок (Fork) и монетки
 * - Предсказание пути (Predict)
 */
class MovementManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Переместить игрока на указанное количество шагов
     * @param {string} playerId 
     * @param {number} steps - Сколько шагов сделать
     * @returns {object} Результат перемещения (новая клетка, эффекты)
     */
    movePlayer(playerId, steps) {
        const player = this.gameState.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        const fromCell = player.position.currentCell;
        let currentCell = fromCell;

        // Список клеток "Деньги", через которые прошел игрок за этот ход
        const passedMoneyCells = [];

        // === ОБРАБОТКА РАЗВИЛКИ (Если было выбрано направление) ===
        if (board[currentCell].type === 'fork' && player.forkDirection !== null) {
            // Используем направление, выбранное монеткой
            const nextIndex = player.forkDirection;
            currentCell = board[currentCell].next[nextIndex]; // Делаем первый шаг туда
            player.forkDirection = null; // Сбрасываем выбор

            // Этот шаг считается частью steps? Да.
            steps--;

            // Проверяем, не попали ли мы сразу на "Деньги" или "Старт"
            if (board[currentCell].type === 'money' || board[currentCell].type === 'start') {
                passedMoneyCells.push(currentCell);
            }
        }

        // === ГЛАВНЫЙ ЦИКЛ ПЕРЕМЕЩЕНИЯ ===
        for (let i = 0; i < steps; i++) {
            const cellData = board[currentCell];
            // Проверка на конец карты (если вдруг)
            if (!cellData || !cellData.next || cellData.next.length === 0) {
                break;
            }

            // Идем по стандартному пути (индекс 0)
            // У обычных клеток next имеет длину 1
            currentCell = cellData.next[0];

            // Если мы ПРОХОДИМ (не останавливаясь) через клетку "Деньги" или "Старт"
            // (i < steps - 1 означает, что это не последний шаг)
            const type = board[currentCell].type;
            if (i < steps - 1 && (type === 'money' || type === 'start')) {
                passedMoneyCells.push(currentCell);
            }
        }

        // Обновляем позицию игрока
        player.position.currentCell = currentCell;
        player.position.currentCellType = board[currentCell].type;

        // Сохраняем пройденные денежные клетки в состояние игрока
        // (Клиент потом запросит сбор денег с них)
        player.passedMoneyCells = passedMoneyCells;
        console.log(`💰 Пройденные клетки "Деньги": ${passedMoneyCells.join(', ') || 'нет'}`);

        // Запись в историю
        this.gameState.addToHistory({
            action: 'player_moved',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                steps,
                fromCell,
                toCell: currentCell,
                cellType: board[currentCell]?.type,
                message: `Переместился на ${board[currentCell]?.name}`
            }
        });

        console.log(`🚶 ${player.displayName}: ${fromCell} → ${currentCell}`);

        // Делегируем обработку попадания на клетку (Event/Cell Manager)
        // В GameState это вызывалось так: this.handleCell(playerId, currentCell);
        // Сейчас мы вернем объект, а GameState вызовет CellManager.
        // Или мы можем вызвать CellManager напрямую если он доступен в gameState.

        let result = {};
        if (this.gameState.cellManager) {
            result = this.gameState.cellManager.handleCell(playerId, currentCell);
        }

        // Добавляем инфо о пройденных деньгах к результату
        result.passedMoneyCells = passedMoneyCells;

        return result;
    }

    /**
     * Предсказать, куда попадет игрок (для подсветки на клиенте)
     */
    predictMove(playerId, steps) {
        const player = this.gameState.players[playerId];
        if (!player) return null;

        let currentCell = player.position.currentCell;
        let forkDir = player.forkDirection;

        let simSteps = steps;

        // Симуляция старта с развилки
        if (board[currentCell].type === 'fork' && forkDir !== null && forkDir !== undefined) {
            currentCell = board[currentCell].next[forkDir];
            simSteps--;
        }

        // Симуляция пути
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
     * Установить направление на развилке (после подбрасывания монетки)
     */
    setForkDirection(playerId, result) {
        const player = this.gameState.players[playerId];
        if (!player) throw new Error('Игрок не найден');

        const currentCell = player.position.currentCell;
        const cellData = board[currentCell];

        if (cellData.type !== 'fork') {
            throw new Error('Игрок не на развилке');
        }

        // Орел (heads) -> Направо (index 0 - короткий путь/меньший id)
        // Решка (tails) -> Налево (index 1)
        // *Логика индексов зависит от структуры board.js, предполагаем 0 и 1*
        const nextIndex = (result === 'heads') ? 0 : 1;

        player.forkDirection = nextIndex;

        this.gameState.addToHistory({
            action: 'fork_direction_set',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                coinResult: result,
                direction: result === 'heads' ? 'Направо' : 'Налево',
                message: `Монетка (${result}): ${player.displayName} выбирает путь ${result === 'heads' ? 'направо' : 'налево'}`
            }
        });

        return { success: true, direction: nextIndex };
    }
}

module.exports = MovementManager;
