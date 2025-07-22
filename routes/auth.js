const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const SALT_ROUNDS = 12;

// Утилиты для работы с файлом пользователей
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Ошибка сохранения пользователей:', error);
    return false;
  }
}

// Валидация данных
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password) {
  // Минимум 6 символов, должен содержать буквы и цифры
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/;
  return passwordRegex.test(password);
}

function validateUsername(username) {
  // Только буквы, цифры и подчеркивания, 3-20 символов
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

function sanitizeInput(input) {
  return input.trim().replace(/[<>]/g, '');
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, surname, username, email, password } = req.body;

    // Валидация входных данных
    if (!name || !surname || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Все поля обязательны для заполнения'
      });
    }

    // Санитизация
    const sanitizedName = sanitizeInput(name);
    const sanitizedSurname = sanitizeInput(surname);
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email);

    // Валидация форматов
    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Пароль должен содержать минимум 6 символов, включая буквы и цифры'
      });
    }

    if (!validateUsername(sanitizedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Имя пользователя должно содержать 3-20 символов (буквы, цифры, подчеркивания)'
      });
    }

    // Загрузка существующих пользователей
    const users = await loadUsers();

    // Проверка уникальности email и username
    const emailExists = users.some(user => user.email === sanitizedEmail);
    const usernameExists = users.some(user => user.username === sanitizedUsername);

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }

    if (usernameExists) {
      return res.status(400).json({
        success: false,
        message: 'Имя пользователя уже занято'
      });
    }

    // Хеширование пароля
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Создание нового пользователя
    const newUser = {
      id: Date.now() + Math.random(), // Простой ID для демонстрации
      name: sanitizedName,
      surname: sanitizedSurname,
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    // Добавление пользователя в массив
    users.push(newUser);

    // Сохранение в файл
    const saved = await saveUsers(users);
    if (!saved) {
      return res.status(500).json({
        success: false,
        message: 'Ошибка сохранения данных'
      });
    }

    // Отправляем успешный ответ (БЕЗ пароля и лишней информации)
    res.status(201).json({
      success: true,
      message: 'Регистрация прошла успешно',
      user: {
        id: newUser.id,
        name: newUser.name,
        surname: newUser.surname,
        username: newUser.username
      }
    });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email и пароль обязательны'
      });
    }

    const sanitizedEmail = sanitizeInput(email);

    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
    }

    // Загрузка пользователей
    const users = await loadUsers();

    // Поиск пользователя
    const user = users.find(u => u.email === sanitizedEmail && u.isActive);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    // Проверка пароля
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    // Успешный вход (БЕЗ пароля и лишней информации)
    res.json({
      success: true,
      message: 'Вход выполнен успешно',
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// POST /api/auth/check-email (проверка доступности email)
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
    }

    const users = await loadUsers();
    const exists = users.some(user => user.email === sanitizeInput(email));

    res.json({
      success: true,
      exists: exists
    });

  } catch (error) {
    console.error('Ошибка проверки email:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки'
    });
  }
});

// POST /api/auth/check-username (проверка доступности username)
router.post('/check-username', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !validateUsername(username)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат имени пользователя'
      });
    }

    const users = await loadUsers();
    const exists = users.some(user => user.username === sanitizeInput(username));

    res.json({
      success: true,
      exists: exists
    });

  } catch (error) {
    console.error('Ошибка проверки username:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка проверки'
    });
  }
});

module.exports = router;
