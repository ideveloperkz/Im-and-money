const express = require('express');
const path = require('path');
const app = express();

// Указываем Express, что public — папка с фронтендом
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Если запрос не найден — отдаем index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
