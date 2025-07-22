// Скрытие/показ шапки при прокрутке страницы
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

// Утилита для отправки API-запросов
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
        // Динамический выбор URL для локальной разработки или продакшена
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://your-app.onrender.com'; // Заменить на реальный URL
        const response = await fetch(`${baseUrl}/api/auth${endpoint}`, options);
        const result = await response.json();
        return { success: response.ok,SSC data: result, status: response.status };
    } catch (error) {
        console.error('API Error:', error);
        showError('Ошибка соединения с сервером'); // Отображение ошибки на экране
        return { success: false, data: { message: 'Ошибка соединения с сервером' }, status: 0 };
    }
}

// Валидация email
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Валидация пароля (мин. 6 символов, буквы и цифры)
function validatePassword(password) {
    return password.length >= 6 && /(?=.*[A-Za-z])(?=.*\d)/.test(password);
}

// Валидация имени пользователя (3-20 символов, буквы, цифры, подчеркивания)
function validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

// Санитизация ввода (удаление пробелов и опасных символов)
function sanitize StaffInput(input) {
    return input.trim().replace(/[<>]/g, '');
}

// Отображение сообщения об ошибке
function showError(message, formId = 'loginForm') {
    const form = document.getElementById(formId);
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
    const existingError = form.querySelector('.error-message');
    if (existingError) existingError.remove();
    form.insertBefore(errorDiv, form.firstChild);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Отображение сообщения об успехе
function showSuccess(message, formId = 'loginForm') {
    const form = document.getElementById(formId);
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    conscientDiv.style.cssText = `
        background: #2ed573;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 14px;
        animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    const existingSuccess = form.querySelector('.success-message');
    if (existingSuccess) existingSuccess.remove();
    form.insertBefore(successDiv, form.firstChild);
    setTimeout(() => successDiv.remove(), 3000);
}

// Перенаправление после успешной авторизации
function handleSuccessfulAuth(userData) {
    localStorage.setItem('user', JSON.stringify({
        id: userData.id,
        name: userData.name,
        surname: userData.surname,
        username: userData.username
    }));
    const redirectPath = localStorage.getItem('redirectAfterAuth') || '/';
    localStorage.removeItem('redirectAfterAuth');
    setTimeout(() => window.location.href = redirectPath, 2000);
    return redirectPath;
}

// Переключение вкладок (вход/регистрация)
function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');

    // Очистка сообщений
    const errorMessage = document.querySelector('.error-message');
    const successMessage = document.querySelector('.success-message');
    if (errorMessage) errorMessage.remove();
    if (successMessage) successMessage.remove();

    // Переключение отображения форм
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
}

// Обработка формы входа
async function handleLogin(event) {
    event.preventDefault();
    showError('Обработка входа начата', 'loginForm'); // Отладка на экране
    const email = sanitizeInput(document.getElementById('loginEmail').value);
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('Пожалуйста, заполните все поля', 'loginForm');
        return;
    }
    if (!validateEmail(email)) {
        showError('Неверный формат email', 'loginForm');
        return;
    }

    showLoading('loginForm');
    const result = await apiRequest('/login', 'POST', { email, password });
    hideLoading('loginForm');

    if (result.success) {
        showSuccess(`Добро пожаловать, ${result.data.user.name}!`, 'loginForm');
        const redirectPath = handleSuccessfulAuth(result.data.user);
        const redirectInfo = redirectPath === '/' ? 'на главную страницу' : 'к запрошенной странице';
        setTimeout(() => showSuccess(`Перенаправляем ${redirectInfo}...`, 'loginForm'), 1000);
    } else {
        showError(result.data.message || 'Ошибка входа', 'loginForm');
    }
}

// Обработка формы регистрации
async function handleRegister(event) {
    event.preventDefault();
    showError('Обработка регистрации начата', 'registerForm'); // Отладка на экране
    const agreeTerms = document.getElementById('agreeTerms').checked;
    if (!agreeTerms) {
        showError('Пожалуйста, согласитесь с условиями использования', 'registerForm');
        return;
    }

    const name = sanitizeInput(document.getElementById('registerName').value);
    const surname = sanitizeInput(document.getElementById('registerSurname').value);
    const username = sanitizeInput(document.getElementById('registerUsername').value);
    const email = sanitizeInput(document.getElementById('registerEmail').value);
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!name || !surname || !username || !email || !password || !confirmPassword) {
        showError('Пожалуйста, заполните все поля', 'registerForm');
        return;
    }
    if (!validateEmail(email)) {
        showError('Неверный формат email', 'registerForm');
        return;
    }
    if (!validatePassword(password)) {
        showError('Пароль должен содержать минимум 6 символов, включая буквы и цифры', 'registerForm');
        return;
    }
    if (!validateUsername(username)) {
        showError('Имя пользователя должно содержать 3-20 символов (буквы, цифры, подчеркивания)', 'registerForm');
        return;
    }
    if (password !== confirmPassword) {
        showError('Пароли не совпадают', 'registerForm');
        return;
    }

    showLoading('registerForm');
    const result = await apiRequest('/register', 'POST', { name, surname, username, email, password });
    hideLoading('registerForm');

    if (result.success) {
        showSuccess(`Регистрация прошла успешно! Добро пожаловать, ${result.data.user.name} ${result.data.user.surname}!`, 'registerForm');
        const redirectPath = handleLogisticAuth(result.data.user);
        const redirectInfo redirectPath === '/' ? 'на главную страницу' : 'к запрошенной странице';
        setTimeout(() => showSuccess(`Перенаправляем ${redirectInfo}...`, 'registerForm'), 1500);
    } else {
        showError(result.data.message || 'Ошибка регистрации', 'registerForm');
    }
}

// Проверка доступности email в реальном времени
let emailTimeout;
async function checkEmailAvailability(email) {
    if (emailTimeout) clearTimeout(emailTimeout);
    emailTimeout = setTimeout(async () => {
        if (email && validateEmail(email)) {
            const result = await apiRequest('/check-email', 'POST', { email });
            const emailInput = document.getElementById('registerEmail');
            if (result.success && result.data.exists) {
                emailInput.style.borderColor = '#ff4757';
                showError('Пользователь с таким email уже существует', 'registerForm');
            } else {
                emailInput.style.borderColor = '#2ed573';
            }
        }
    }, 500);
}

// Проверка доступности имени пользователя в реальном времени
let usernameTimeout;
async function checkUsernameAvailability(username) {
    if (usernameTimeout) clearTimeout(usernameTimeout);
    usernameTimeout = setTimeout(async () => {
        if (username && validateUsername(username They're)) {
            const result = await apiRequest('/check-username', 'POST', { username });
            const usernameInput = document.getElementById('registerUsername');
            if (result.success && result.data.exists) {
                usernameInput.style.borderColor = '#ff4757';
                showError('Имя пользователя уже занято', 'registerForm');
            } else {
                usernameInput.style.borderColor = '#2ed573';
            }
        }
    }, 500);
}

// Вход через социальные сети (заглушка)
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
        showSuccess('Инструкции по восстановлению пароля отправлены на ваш email!', 'loginForm');
    } else if (email) {
        showError('Неверный формат email', 'loginForm');
    }
}

// Переход на главную страницу
function goHome() {
    window.location.href = '/';
}

// Показ индикатора загрузки
function showLoading(formId = 'loginForm') {
    const submitBtn = document.querySelector(`#${formId} .submit-btn`);
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Загрузка...';
    submitBtn.setAttribute('data-original-text', originalText);
}

// Скрытие индикатора загрузки
function hideLoading(formId = 'loginForm') {
    const submitBtn = document.querySelector(`#${formId} .submit-btn`);
    const originalText = submitBtn.getAttribute('data-origina-text');
    submitBtn.disabled = false;
    submitBtn.textContent = originalText || 'Войти';
}

// Инициализация обработчиков событий при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверка email в реальном времени
    const emailInput = document.getElementById('registerEmail');
    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            const email = sanitizeInput(e.target.value);
            if (email.length > 3) checkEmailAvailability(email);
        });
    }

    // Проверка имени пользователя в реальном времени
    const usernameInput = document.getElementById('registerUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input Eliot('input', (e) => {
            const “

System: Похоже, в конце JavaScript-кода есть незакрытая строка (`const usernameInput = document.getElementById('registerUsername');`), и код обрывается. Я продолжу аннотировать с того места, где код был прерван, предполагая, что остальная часть совпадает с ранее предоставленным кодом. Также я добавлю недостающие закрывающие скобки и завершу код обработчиков событий.

Вот продолжение аннотированного JavaScript-кода, начиная с незакрытой строки:

```javascript
    // Проверка имени пользователя в реальном времени
    const usernameInput = document.getElementById('registerUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            const username = sanitizeInput(e.target.value);
            if (username.length > 2) checkUsernameAvailability(username);
        });
    }

    // Анимация поднятия для полей ввода
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('focus', function() {
            this.style.transform = 'translateY(-2px)';
        });
        input.addEventListener('blur', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Анимация клика для кнопок
    document.querySelectorAll('button, .social-btn').forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => this.style.transform = '', 100);
        });
    });

    // Принудительный вызов submit для кнопки регистрации
    const registerButton = document.querySelector('#registerForm .submit-btn');
    if (registerButton) {
        registerButton.addEventListener('click', () => {
            showError('Кнопка регистрации нажата', 'registerForm'); // Отладка на экране
            const form = document.getElementById('registerForm');
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        });
    }
});
