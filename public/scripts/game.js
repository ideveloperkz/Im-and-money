// Убираем всю логику скрытия хедера - оставляем фиксированное меню
const header = document.getElementById('header');
const mobileMenu = document.getElementById('mobileMenu');
const hamburger = document.getElementById('hamburger');

// Mobile menu toggle
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
});

// Close mobile menu
function closeMobileMenu() {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        closeMobileMenu();
    }
});

// Chat widget
const chatWidget = document.getElementById('chatWidget');
const chatPopup = document.getElementById('chatPopup');
const chatModal = document.getElementById('chatModal');

chatWidget.addEventListener('click', () => {
    chatModal.style.display = 'flex';
    chatPopup.classList.remove('active');
});

// Show chat popup on hover
chatWidget.addEventListener('mouseenter', () => {
    chatPopup.classList.add('active');
});
chatWidget.addEventListener('mouseleave', () => {
    chatPopup.classList.remove('active');
});

// Close chat modal
function closeChatModal() {
    chatModal.style.display = 'none';
}

// Reply to message (placeholder)
function replyTo(username) {
    alert(`Ответ для ${username}: Функция в разработке (ждем серверную часть)`);
}

// Send message (placeholder)
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input.value.trim()) {
        alert('Отправка сообщения в разработке (ждем серверную часть)');
        input.value = '';
    }
}

// Game actions (placeholder)
function makeAction(action) {
    let message;
    switch (action) {
        case 'dice':
            message = 'Бросок кубика в разработке';
            break;
        case 'coin':
            message = 'Бросок монетки в разработке';
            break;
        case 'move':
            message = 'Ход в разработке';
            break;
    }
    alert(message);
}

// Navigation
function goHome() {
    window.location.href = '/index.html';
}

function logout() {
    alert('Выход выполнен! (ждем серверную часть)');
    window.location.href = '/index.html';
}

// Button animations
document.querySelectorAll('.play-button, .chat-reply-btn').forEach(button => {
    button.addEventListener('click', function() {
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = '';
        }, 100);
    });
});
