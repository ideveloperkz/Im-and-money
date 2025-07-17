// Header hide/show on scroll
let lastScrollY = window.scrollY;
const header = document.getElementById('header');
const mobileMenu = document.getElementById('mobileMenu');
const hamburger = document.getElementById('hamburger');

window.addEventListener('scroll', () => {
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
        header.classList.add('hidden');
        closeMobileMenu();
    } else {
        header.classList.remove('hidden');
    }
    lastScrollY = window.scrollY;
});

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

// Game start function
function startGame() {
    alert('Игра скоро начнется! Подготовьте игральные кости и выберите фишку.');
}

// Smooth animations on page load
window.addEventListener('load', () => {
    document.body.style.opacity = '1';
});
