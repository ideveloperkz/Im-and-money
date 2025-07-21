// Header hide/show on scroll - ИСПРАВЛЕННАЯ ВЕРСИЯ
let lastScrollY = window.pageYOffset || document.documentElement.scrollTop;
const header = document.getElementById('header');
const mobileMenu = document.getElementById('mobileMenu');
const hamburger = document.getElementById('hamburger');

// Дебаунсинг для оптимизации
let ticking = false;

function updateHeader() {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Защита от отрицательных значений при "резиновом" скролле
    if (currentScrollY < 0) return;
    
    // Логика скрытия/показа хедера
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Скролл вниз и прошли 100px
        header.classList.add('hidden');
        closeMobileMenu();
    } else if (currentScrollY < lastScrollY) {
        // Скролл вверх
        header.classList.remove('hidden');
    }
    
    lastScrollY = currentScrollY;
    ticking = false;
}

function requestTick() {
    if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
    }
}

// Используем requestAnimationFrame для плавности
window.addEventListener('scroll', requestTick, { passive: true });

// Альтернативный вариант с throttle (раскомментируйте если нужен)
/*
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

window.addEventListener('scroll', throttle(() => {
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    if (currentScrollY < 0) return;
    
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        header.classList.add('hidden');
        closeMobileMenu();
    } else if (currentScrollY < lastScrollY) {
        header.classList.remove('hidden');
    }
    
    lastScrollY = currentScrollY;
}, 16), { passive: true }); // ~60fps
*/

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
