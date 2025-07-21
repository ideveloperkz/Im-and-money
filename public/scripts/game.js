// Header hide/show on scroll
let lastScrollY = window.scrollY;
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
    lastScrollY = window.scrollY;
});

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
});

// Close mobile menu on click outside or scroll
document.addEventListener('click', (event) => {
    if (!mobileMenu.contains(event.target) && !hamburger.contains(event.target)) {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
    }
});
window.addEventListener('scroll', () => {
    hamburger.classList.remove('active');
    mobileMenu.classList.remove('active');
});

// Chat widget
const chatWidget = document.getElementById('chatWidget');
const chatPopup = document.getElementById('chatPopup');
const chatModal = document.getElementById('chatModal');
chatWidget.addEventListener('click', () => {
    chatModal.style.display = 'flex';
    chatPopup.classList.remove('active'); // Hide popup when modal opens
});

// Close chat modal
function closeChatModal() {
    chatModal.style.display = 'none';
}

// Show chat popup on hover
chatWidget.addEventListener('mouseenter', () => {
    chatPopup.classList.add('active');
});
chatWidget.addEventListener('mouseleave', () => {
    chatPopup.classList.remove('active');
});

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
