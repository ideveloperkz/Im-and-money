// Универсальная система защиты страниц
(function() {
    'use strict';

    // Проверка авторизации
    function isUserAuthenticated() {
        try {
            const userData = localStorage.getItem('user');
            if (!userData) return false;
            
            const user = JSON.parse(userData);
            return user && user.id && user.name;
        } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
            localStorage.removeItem('user'); // Удаляем некорректные данные
            return false;
        }
    }

    // Создание модального окна с предупреждением
    function createAuthModal() {
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(10px);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            max-width: 400px;
            width: 90%;
            transform: scale(0.7);
            transition: transform 0.3s ease;
        `;

        modalContent.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 20px;">🔒</div>
            <h2 style="margin: 0 0 15px 0; font-size: 24px;">Доступ ограничен</h2>
            <p style="margin: 0 0 25px 0; opacity: 0.9; line-height: 1.5;">
                Для доступа к этой странице необходимо войти в аккаунт или зарегистрироваться
            </p>
            <button id="auth-modal-btn" style="
                background: rgba(255,255,255,0.2);
                color: white;
                border: 2px solid rgba(255,255,255,0.3);
                padding: 12px 30px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            ">
                Войти / Регистрация
            </button>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Анимация появления
        setTimeout(() => {
            modal.style.opacity = '1';
            modalContent.style.transform = 'scale(1)';
        }, 10);

        // Hover эффект для кнопки
        const btn = modalContent.querySelector('#auth-modal-btn');
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255,255,255,0.3)';
            btn.style.transform = 'translateY(-2px)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(255,255,255,0.2)';
            btn.style.transform = 'translateY(0)';
        });

        // Обработчик клика по кнопке
        btn.addEventListener('click', () => {
            redirectToAuth();
        });

        // Предотвращение закрытия модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                e.preventDefault();
                // Можно добавить небольшую анимацию "покачивания"
                modalContent.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    modalContent.style.transform = 'scale(1)';
                }, 150);
            }
        });

        return modal;
    }

    // Перенаправление на страницу авторизации
    function redirectToAuth() {
        // Сохраняем текущую страницу для возврата после авторизации
        const currentPath = window.location.pathname;
        localStorage.setItem('redirectAfterAuth', currentPath);
        
        // Перенаправляем на страницу регистрации
        window.location.href = '/pages/registration.html';
    }

    // Скрытие содержимого страницы
    function hidePageContent() {
        document.body.style.overflow = 'hidden';
        
        // Скрываем всё содержимое кроме модального окна
        const allElements = document.body.children;
        for (let element of allElements) {
            if (element.id !== 'auth-modal') {
                element.style.filter = 'blur(5px)';
                element.style.pointerEvents = 'none';
                element.style.userSelect = 'none';
            }
        }
    }

    // Основная функция проверки
    function checkAuth() {
        // Проверяем, авторизован ли пользователь
        if (!isUserAuthenticated()) {
            // Скрываем содержимое
            hidePageContent();
            
            // Показываем модальное окно
            createAuthModal();
            
            // Логируем попытку несанкционированного доступа
            console.warn('🔒 Попытка доступа к защищённой странице без авторизации');
            
            return false;
        }
        
        console.log('✅ Пользователь авторизован');
        return true;
    }

    // Функция для обновления навигации (показать имя пользователя)
    function updateNavigation() {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                const authBtn = document.querySelector('.auth-btn');
                
                if (authBtn) {
                    authBtn.textContent = `👤 ${user.name}`;
                    authBtn.style.background = 'rgba(255,255,255,0.1)';
                    authBtn.style.border = '1px solid rgba(255,255,255,0.2)';
                    
                    // Добавляем обработчик для выхода
                    authBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (confirm('Выйти из аккаунта?')) {
                            localStorage.removeItem('user');
                            localStorage.removeItem('redirectAfterAuth');
                            window.location.href = '/';
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Ошибка обновления навигации:', error);
        }
    }

    // API проверка (дополнительная безопасность)
    async function verifyTokenWithServer() {
        try {
            const userData = localStorage.getItem('user');
            if (!userData) return false;

            // В будущем здесь можно добавить проверку токена на сервере
            // const response = await fetch('/api/auth/verify', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ token: user.token })
            // });
            // return response.ok;
            
            return true; // Пока просто возвращаем true
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            return false;
        }
    }

    // Инициализация защиты при загрузке страницы
    function initPageGuard() {
        // Проверяем авторизацию немедленно
        const isAuth = checkAuth();
        
        if (isAuth) {
            // Обновляем навигацию для авторизованного пользователя
            updateNavigation();
            
            // Дополнительная проверка через 100мс (на случай медленной загрузки)
            setTimeout(() => {
                if (!isUserAuthenticated()) {
                    location.reload(); // Перезагружаем страницу
                }
            }, 100);
        }
    }

    // Защита от обхода через консоль разработчика
    if (typeof window !== 'undefined') {
        // Блокируем некоторые методы в консоли для неавторизованных пользователей
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        
        if (!isUserAuthenticated()) {
            console.log = () => {};
            console.warn = () => {};
            console.error = () => {};
            
            // Восстанавливаем после авторизации
            window.addEventListener('storage', (e) => {
                if (e.key === 'user' && e.newValue) {
                    console.log = originalLog;
                    console.warn = originalWarn;
                    console.error = originalError;
                }
            });
        }
    }

    // Запускаем проверку при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPageGuard);
    } else {
        initPageGuard();
    }

    // Дополнительная проверка при изменении localStorage (если пользователь вышел в другой вкладке)
    window.addEventListener('storage', (e) => {
        if (e.key === 'user' && !e.newValue) {
            // Пользователь вышел из системы
            location.reload();
        }
    });

    // Проверяем фокус страницы (если пользователь переключился на другую вкладку и вернулся)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !isUserAuthenticated()) {
            location.reload();
        }
    });

})();
