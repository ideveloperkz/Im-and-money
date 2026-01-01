/**
 * Показать системное уведомление (по центру экрана)
 * Используется для уведомлений о результатах хода (покупки, штрафы и т.д.)
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
        alertContainer.style.pointerEvents = 'none'; // Чтобы клики проходили сквозь
        document.body.appendChild(alertContainer);
    }

    const alertBox = document.createElement('div');
    alertBox.className = 'game-alert-box';
    alertBox.textContent = text;

    // Стили прямо здесь (как и просил пользователь - "стили в JS")
    Object.assign(alertBox.style, {
        background: 'rgba(0, 0, 0, 0.85)',
        color: '#ff4444', // Красный текст для важных сообщений
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

    // Удаление через 4 секунды (как просил пользователь 3-4 сек)
    setTimeout(() => {
        alertBox.style.opacity = '0';
        alertBox.style.transform = 'translateY(-20px)';
        setTimeout(() => alertBox.remove(), 300);
    }, 4000);
}
