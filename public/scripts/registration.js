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

// API утилиты
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`/api/auth${endpoint}`, options);
        const result = await response.json();

        return {
            success: response.ok,
            data: result,
            status: response.status
        };
    } catch (error) {
        console.error('API Error:', error);
        return {
            success: false,
            data: { message: 'Ошибка соединения с сервером' },
            status: 0
        };
    }
}

// Валидация на фронтенде
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 6 && /(?=.*[A-Za-z])(?=.*\d)/.test(password);
}

function validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

function sanitizeInput(input) {
    return input.trim().replace(/[<>]/g, '');
}

// Показать ошибку
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background: #ff4757;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    errorDiv.textContent = message;

    const form = document.getElementById('authForm');
    const existingError = form.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }

    form.insertBefore(errorDiv, form.firstChild);

    // Автоудаление через 5 секунд
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

// Показать успех
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        background: #2ed573;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;

    const form = document.getElementById('authForm');
    const existingSuccess = form.querySelector('.success-message');
    if (existingSuccess) {
        existingSuccess.remove();
    }

    form.insertBefore(successDiv, form.firstChild);

    // Автоудаление через 3 секунды
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

// Функция для перенаправления после успешной авторизации
function handleSuccessfulAuth(userData) {
    // Сохранение данных пользователя
    localStorage.setItem('user', JSON.stringify({
        id: userData.id,
        name: userData.name,
        surname: userData.surname,
        username: userData.username
    }));

    // Проверяем, есть ли сохранённая страница для редиректа
    const redirectPath = localStorage.getItem('redirectAfterAuth');
    
    if (redirectPath && redirectPath !== '/pages/registration.html') {
        // Удаляем сохранённый путь
        localStorage.removeItem('redirectAfterAuth');
        
        // Перенаправляем на сохранённую страницу
        setTimeout(() => {
            window.location.href = redirectPath;
        }, 2000);
        
        return redirectPath;
    } else {
        // Перенаправляем на главную страницу
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
        
        return '/';
    }
}

// Переключение табов
function switchTab(tab) {
    if (currentTab === tab) return;

    const authForm = document.getElementById('authForm');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');

    // Очистка сообщений об ошибках
    const errorMessage = authForm.querySelector('.error-message');
    const successMessage = authForm.querySelector('.success-message');
    if (errorMessage) errorMessage.remove();
    if (successMessage) successMessage.remove();

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

// Обработка отправки формы
async function handleSubmit(event) {
    event.preventDefault();
    
    // Очистка предыдущих сообщений
    const form = document.getElementById('authForm');
    const errorMessage = form.querySelector('.error-message');
    const successMessage = form.querySelector('.success-message');
    if (errorMessage) errorMessage.remove();
    if (successMessage) successMessage.remove();

    if (currentTab === 'login') {
        await handleLogin();
    } else {
        await handleRegister();
    }
}

// Обработка входа
async function handleLogin() {
    const email = sanitizeInput(document.getElementById('loginEmail').value);
    const password = document.getElementById('loginPassword').value;
    
    // Валидация на фронтенде
    if (!email || !password) {
        showError('Пожалуйста, заполните все поля');
        return;
    }

    if (!validateEmail(email)) {
        showError('Неверный формат email');
        return;
    }

    // Показать загрузку
    showLoading();

    // Отправка запроса на сервер
    const result = await apiRequest('/login', 'POST', { email, password });

    hideLoading();

    if (result.success) {
        showSuccess(`Добро пожаловать, ${result.data.user.name}!`);
        
        // Используем новую функцию для обработки успешной авторизации
        const redirectPath = handleSuccessfulAuth(result.data.user);
        
        // Обновляем сообщение с информацией о редиректе
        const redirectInfo = redirectPath === '/' ? 'на главную страницу' : 'к запрошенной странице';
        setTimeout(() => {
            showSuccess(`Перенаправляем ${redirectInfo}...`);
        }, 1000);
        
    } else {
        showError(result.data.message || 'Ошибка входа');
    }
}

// Обработка регистрации
async function handleRegister() {
    const name = sanitizeInput(document.getElementById('registerName').value);
    const surname = sanitizeInput(document.getElementById('registerSurname').value);
    const username = sanitizeInput(document.getElementById('registerUsername').value);
    const email = sanitizeInput(document.getElementById('registerEmail').value);
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Валидация на фронтенде
    if (!name || !surname || !username || !email || !password || !confirmPassword) {
        showError('Пожалуйста, заполните все поля');
        return;
    }

    if (!validateEmail(email)) {
        showError('Неверный формат email');
        return;
    }

    if (!validatePassword(password)) {
        showError('Пароль должен содержать минимум 6 символов, включая буквы и цифры');
        return;
    }

    if (!validateUsername(username)) {
        showError('Имя пользователя должно содержать 3-20 символов (буквы, цифры, подчеркивания)');
        return;
    }

    if (password !== confirmPassword) {
        showError('Пароли не совпадают');
        return;
    }

    // Показать загрузку
    showLoading();

    // Отправка запроса на сервер
    const result = await apiRequest('/register', 'POST', {
        name,
        surname,
        username,
        email,
        password
    });

    hideLoading();

    if (result.success) {
        showSuccess(`Регистрация прошла успешно! Добро пожаловать, ${result.data.user.name} ${result.data.user.surname}!`);
        
        // Используем новую функцию для обработки успешной авторизации
        const redirectPath = handleSuccessfulAuth(result.data.user);
        
        // Обновляем сообщение с информацией о редиректе
        const redirectInfo = redirectPath === '/' ? 'на главную страницу' : 'к запрошенной странице';
        setTimeout(() => {
            showSuccess(`Перенаправляем ${redirectInfo}...`);
        }, 1500);
        
    } else {
        showError(result.data.message || 'Ошибка регистрации');
    }
}

// Проверка доступности email в реальном времени
let emailTimeout;
async function checkEmailAvailability(email) {
    if (emailTimeout) {
        clearTimeout(emailTimeout);
    }

    emailTimeout = setTimeout(async () => {
        if (email && validateEmail(email)) {
            const result = await apiRequest('/check-email', 'POST', { email });
            const emailInput = document.getElementById('registerEmail');
            
            if (result.success && result.data.exists) {
                emailInput.style.borderColor = '#ff4757';
                showError('Пользователь с таким email уже существует');
            } else {
                emailInput.style.borderColor = '#2ed573';
            }
        }
    }, 500);
}

// Проверка доступности username в реальном времени
let usernameTimeout;
async function checkUsernameAvailability(username) {
    if (usernameTimeout) {
        clearTimeout(usernameTimeout);
    }

    usernameTimeout = setTimeout(async () => {
        if (username && validateUsername(username)) {
            const result = await apiRequest('/check-username', 'POST', { username });
            const usernameInput = document.getElementById('registerUsername');
            
            if (result.success && result.data.exists) {
                usernameInput.style.borderColor = '#ff4757';
                showError('Имя пользователя уже занято');
            } else {
                usernameInput.style.borderColor = '#2ed573';
            }
        }
    }, 500);
}

// Социальный вход (заглушка)
function socialLogin(provider) {
    showLoading();
    setTimeout(() => {
        hideLoading();
        showError(`Вход через ${provider} временно недоступен`);
    }, 1500);
}

// Восстановление пароля (заглушка)
function forgotPassword() {
    const email = prompt('Введите ваш email для восстановления пароля:');
    if (email && validateEmail(email)) {
        showSuccess('Инструкции по восстановлению пароля отправлены на ваш email!');
    } else if (email) {
        showError('Неверный формат email');
    }
}

function goHome() {
    window.location.href = '/';
}

function showLoading() {
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Загрузка...';
    submitBtn.setAttribute('data-original-text', originalText);
}

function hideLoading() {
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.getAttribute('data-original-text');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText || 'Войти';
}

// Добавление слушателей событий при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Добавление проверки email в реальном времени
    const emailInput = document.getElementById('registerEmail');
    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            const email = sanitizeInput(e.target.value);
            if (email.length > 3) {
                checkEmailAvailability(email);
            }
        });
    }

    // Добавление проверки username в реальном времени
    const usernameInput = document.getElementById('registerUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            const username = sanitizeInput(e.target.value);
            if (username.length > 2) {
                checkUsernameAvailability(username);
            }
        });
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
});
