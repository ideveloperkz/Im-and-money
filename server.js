const express = require('express');
const path = require('path');
const app = express();

// Статические файлы — всё из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Все маршруты отдаем на index.html (если SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running at http://localhost:${PORT}`);
});
