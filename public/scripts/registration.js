let currentTab = 'login';
let lastScrollY = window.scrollY;
const header = document.getElementById('header');

// Header hide/show on scroll
window.addEventListener('scroll', () => {
    if (window.scrollY > lastScrollY && window.scrollY > 100) {
        header.classList.add('hidden');
    } else {
        header.classList.remove('hidden');
    }
    lastScrollY = window.scrollY;
});

function switchTab(tab) {
    if (currentTab === tab) return;

    const authForm = document.getElementById('authForm');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');

    // Add fade out animation
    authForm.classList.add('fade-out');

    setTimeout(() => {
        // Switch content
        if (tab === 'login') {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            authTitle.textContent = 'С возвращением!';
            authTitle.classList.remove('register');
            authSubtitle.textContent = 'Войдите в свой аккаунт для продолжения игры';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            loginTab.classList.remove('active');
            registerTab.classList.add('active');
            authTitle.textContent = 'Присоединяйтесь!';
            authTitle.classList.add('register');
            authSubtitle.textContent = 'Создайте аккаунт и начните изучать финансы';
        }

        // Remove fade out and add slide in
        authForm.classList.remove('fade-out');
        authForm.classList.add('slide-in');
        
        setTimeout(() => {
            authForm.classList.remove('slide-in');
        }, 300);

        currentTab = tab;
    }, 150);
}

function handleSubmit(event) {
    event.preventDefault();
    
    if (currentTab === 'login') {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        // Simulate login
        showLoading();
        setTimeout(() => {
            hideLoading();
            alert('Вход выполнен успешно! Добро пожаловать в игру!');
            // Redirect to game
        }, 1500);
    } else {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            alert('Пароли не совпадают!');
            return;
        }
        
        // Simulate registration
        showLoading();
        setTimeout(() => {
            hideLoading();
            alert('Регистрация прошла успешно! Добро пожаловать в игру!');
            // Redirect to game
        }, 2000);
    }
}

function socialLogin(provider) {
    showLoading();
    setTimeout(() => {
        hideLoading();
        alert(`Вход через ${provider} выполнен успешно!`);
        // Redirect to game
    }, 1500);
}

function forgotPassword() {
    const email = prompt('Введите ваш email для восстановления пароля:');
    if (email) {
        alert('Инструкции по восстановлению пароля отправлены на ваш email!');
    }
}

function goHome() {
    window.location.href = '#'; // Replace with actual home page URL
}

function showLoading() {
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Загрузка...';
    
    setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }, 2000);
}

function hideLoading() {
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = false;
}

// Add floating animation to form inputs
document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('focus', function() {
        this.style.transform = 'translateY(-2px)';
    });
    
    input.addEventListener('blur', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Add click animation to buttons
document.querySelectorAll('button, .social-btn').forEach(button => {
    button.addEventListener('click', function() {
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = '';
        }, 100);
    });
});
