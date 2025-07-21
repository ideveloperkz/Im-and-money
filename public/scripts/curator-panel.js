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

// Логин
const loginSection = document.getElementById('loginSection');
const curatorSection = document.getElementById('curatorSection');
const loginBtn = document.getElementById('loginBtn');
const curatorLoginInput = document.getElementById('curator-login');
const curatorPasswordInput = document.getElementById('curator-password');

// Временные данные для логина (в будущем из JSON/БД)
const CURATOR_CREDENTIALS = {
    login: 'curator',
    password: 'curator123'
};

loginBtn.addEventListener('click', () => {
    if (curatorLoginInput.value === CURATOR_CREDENTIALS.login && curatorPasswordInput.value === CURATOR_CREDENTIALS.password) {
        loginSection.style.display = 'none';
        curatorSection.style.display = 'block';
    } else {
        alert('Неверный логин или пароль!');
    }
});

// Таблица столов
const createGameSixBtn = document.getElementById('createGameSixBtn');
const createGameNineBtn = document.getElementById('createGameNineBtn');
const gamesTable = document.getElementById('games-table').querySelector('tbody');
let gameRowCount = JSON.parse(localStorage.getItem('gameRows'))?.length || 1;
let tableIdCounter = JSON.parse(localStorage.getItem('tableIdCounter')) || 1;

// Загрузка сохраненных столов
const savedGameRows = JSON.parse(localStorage.getItem('gameRows')) || [];
savedGameRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.classList.add(row.maxPlayers === 6 ? 'six-players' : 'nine-players');
    tr.innerHTML = `
        <td>Стол №${row.tableNumber}</td>
        <td>${row.maxPlayers} игроков</td>
        <td>
            <button class="view-btn" data-id="${row.id}"><i class="fas fa-eye"></i> Посмотреть</button>
            <button class="delete-btn" data-id="${row.id}"><i class="fas fa-trash"></i> Удалить</button>
        </td>
    `;
    gamesTable.appendChild(tr);
});

// Создание игры на 6 игроков
createGameSixBtn.addEventListener('click', () => {
    const rowData = { id: tableIdCounter, tableNumber: gameRowCount, maxPlayers: 6 };
    const tr = document.createElement('tr');
    tr.classList.add('six-players');
    tr.innerHTML = `
        <td>Стол №${gameRowCount}</td>
        <td>6 игроков</td>
        <td>
            <button class="view-btn" data-id="${tableIdCounter}"><i class="fas fa-eye"></i> Посмотреть</button>
            <button class="delete-btn" data-id="${tableIdCounter}"><i class="fas fa-trash"></i> Удалить</button>
        </td>
    `;
    gamesTable.appendChild(tr);
    savedGameRows.push(rowData);
    localStorage.setItem('gameRows', JSON.stringify(savedGameRows));
    tableIdCounter++;
    gameRowCount++;
    localStorage.setItem('tableIdCounter', tableIdCounter);
    attachActionListeners();
});

// Создание игры на 9 игроков
createGameNineBtn.addEventListener('click', () => {
    const rowData = { id: tableIdCounter, tableNumber: gameRowCount, maxPlayers: 9 };
    const tr = document.createElement('tr');
    tr.classList.add('nine-players');
    tr.innerHTML = `
        <td>Стол №${gameRowCount}</td>
        <td>9 игроков</td>
        <td>
            <button class="view-btn" data-id="${tableIdCounter}"><i class="fas fa-eye"></i> Посмотреть</button>
            <button class="delete-btn" data-id="${tableIdCounter}"><i class="fas fa-trash"></i> Удалить</button>
        </td>
    `;
    gamesTable.appendChild(tr);
    savedGameRows.push(rowData);
    localStorage.setItem('gameRows', JSON.stringify(savedGameRows));
    tableIdCounter++;
    gameRowCount++;
    localStorage.setItem('tableIdCounter', tableIdCounter);
    attachActionListeners();
});

// Обработчик кнопки просмотра карточки игрока
const playerCardBtn = document.getElementById('playerCardBtn');
playerCardBtn.addEventListener('click', () => {
    alert('Интерфейс карточки игрока пока не реализован!');
});

// Функция для привязки обработчиков действий
function attachActionListeners() {
    // Обработчики для кнопок "Посмотреть"
    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(button => {
        button.addEventListener('click', () => {
            alert('Интерфейс игры пока не реализован!');
        });
    });

    // Обработчики для кнопок "Удалить"
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const id = parseInt(button.getAttribute('data-id'));
            const index = savedGameRows.findIndex(row => row.id === id);
            if (index !== -1) {
                savedGameRows.splice(index, 1);
                localStorage.setItem('gameRows', JSON.stringify(savedGameRows));
                gamesTable.innerHTML = '';
                savedGameRows.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.classList.add(row.maxPlayers === 6 ? 'six-players' : 'nine-players');
                    tr.innerHTML = `
                        <td>Стол №${row.tableNumber}</td>
                        <td>${row.maxPlayers} игроков</td>
                        <td>
                            <button class="view-btn" data-id="${row.id}"><i class="fas fa-eye"></i> Посмотреть</button>
                            <button class="delete-btn" data-id="${row.id}"><i class="fas fa-trash"></i> Удалить</button>
                        </td>
                    `;
                    gamesTable.appendChild(tr);
                });
                attachActionListeners();
            }
        });
    });
}

// Инициализация обработчиков
attachActionListeners();
