const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);

// Список защищённых страниц (всё кроме главной и регистрации)
const protectedPages = [
    '/pages/game-lobby.html',
    '/pages/players-card.html', 
    '/pages/admin-panel.html',
    '/pages/curator-panel.html',
    '/pages/game.html'
];

// Middleware для проверки авторизации на защищённых страницах
function requireAuth(req, res, next) {
    // Проверяем, является ли запрашиваемая страница защищённой
    const isProtectedPage = protectedPages.some(page => req.path === page);
    
    if (isProtectedPage) {
        // Проверяем заголовки авторизации или перенаправляем
        // На стороне клиента auth-guard.js уже обработает это
        console.log(`🔒 Запрос к защищённой странице: ${req.path}`);
    }
    
    next();
}

// Применяем middleware ко всем маршрутам
app.use(requireAuth);

// Специальная обработка для защищённых страниц
protectedPages.forEach(page => {
    app.get(page, (req, res) => {
        // Отправляем файл - auth-guard.js на клиенте проверит авторизацию
        res.sendFile(path.join(__dirname, 'public', page));
    });
});

// Обработка главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка страницы регистрации  
app.get('/pages/registration.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', 'registration.html'));
});

// Все остальные маршруты
app.get('*', (req, res) => {
    // Если запрашивается несуществующая страница
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).json({
        success: false,
        message: 'Внутренняя ошибка сервера'
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running at http://localhost:${PORT}`);
    console.log(`🔒 Protected pages: ${protectedPages.join(', ')}`);
});
