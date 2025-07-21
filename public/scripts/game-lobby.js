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

// Заглушка для данных столов (в будущем данные будут из JSON или БД)
const tablesData = [
    {
        id: 1,
        tableNumber: 1,
        curator: "Куратор Жамиля",
        players: ["Игрок 1", "Игрок 2", "Игрок 3"],
        maxPlayers: 6
    },
    {
        id: 2,
        tableNumber: 2,
        curator: "Куратор Жамиля",
        players: ["Игрок 4", "Игрок 5"],
        maxPlayers: 9
    },
    {
        id: 3,
        tableNumber: 3,
        curator: "Куратор Жамиля",
        players: [],
        maxPlayers: 6
    }
];

// Отрисовка карточек столов
const tablesSection = document.getElementById('tablesSection');

function renderTables() {
    tablesSection.innerHTML = '';
    tablesData.forEach(table => {
        const card = document.createElement('div');
        card.classList.add('table-card');
        card.innerHTML = `
            <h3><i class="fas fa-table"></i> Стол №${table.tableNumber}</h3>
            <p><i class="fas fa-user-tie"></i> Куратор: ${table.curator}</p>
            <p><i class="fas fa-users"></i> Игроки: ${table.players.length}/${table.maxPlayers}</p>
            <ul class="players-list">
                ${table.players.length > 0 
                    ? table.players.map(player => `<li><i class="fas fa-user"></i> ${player}</li>`).join('')
                    : '<li>Пока нет игроков</li>'
                }
            </ul>
            <button class="join-btn" data-table-id="${table.id}" ${table.players.length >= table.maxPlayers ? 'disabled' : ''}>
                <i class="fas fa-sign-in-alt"></i> Присоединиться
            </button>
        `;
        tablesSection.appendChild(card);
    });

    // Обработчики для кнопок "Присоединиться"
    document.querySelectorAll('.join-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tableId = parseInt(button.getAttribute('data-table-id'));
            const table = tablesData.find(t => t.id === tableId);
            if (table.players.length < table.maxPlayers) {
                // Здесь будет логика присоединения игрока (например, отправка на сервер)
                alert(`Вы присоединились к столу №${table.tableNumber}!`);
                // Для демонстрации добавляем игрока локально
                table.players.push(`Игрок ${table.players.length + 1}`);
                renderTables();
            } else {
                alert('Стол заполнен!');
            }
        });
    });
}

// Инициализация
renderTables();
