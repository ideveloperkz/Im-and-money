/**
 * ИГРОК: Подтвердил прочтение карточки (ОК)
 * Используется для карточек без выбора (новости, просто доход и т.д.)
 */
socket.on('player:acknowledge_card', (data, callback) => {
    if (!playerId) return callback?.({ success: false, error: 'Не авторизован' });
    if (gameState.currentTurn !== playerId) return callback?.({ success: false, error: 'Не ваш ход' });

    try {
        // Просто передаем ход
        gameState.nextTurn();

        // Скрываем карточку у ВСЕХ
        io.emit('game:card_hide');

        // Обновляем состояние
        io.emit('game:state_update', gameState.getState());

        callback?.({ success: true });
    } catch (error) {
        console.error('❌ Ошибка подтверждения карточки:', error.message);
        callback?.({ success: false, error: error.message });
    }
});
