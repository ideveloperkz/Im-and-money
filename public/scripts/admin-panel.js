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
const adminSection = document.getElementById('adminSection');
const loginBtn = document.getElementById('loginBtn');
const adminLoginInput = document.getElementById('admin-login');
const adminPasswordInput = document.getElementById('admin-password');

// Простая проверка логина и пароля (в реальном проекте это должно быть на сервере)
const ADMIN_CREDENTIALS = {
    login: 'admin',
    password: 'admin123'
};

loginBtn.addEventListener('click', () => {
    if (adminLoginInput.value === ADMIN_CREDENTIALS.login && adminPasswordInput.value === ADMIN_CREDENTIALS.password) {
        loginSection.style.display = 'none';
        adminSection.style.display = 'block';
    } else {
        alert('Неверный логин или пароль!');
    }
});

// Таблица Назначить куратора
const addCuratorBtn = document.getElementById('add-curator');
const curatorTable = document.getElementById('curator-table').querySelector('tbody');
let curatorRowCount = JSON.parse(localStorage.getItem('curatorRows'))?.length || 1;

// Загрузка сохраненных строк
const savedCuratorRows = JSON.parse(localStorage.getItem('curatorRows')) || [];
savedCuratorRows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${row.login}</td>
        <td>${row.password}</td>
        <td><button class="delete-btn" data-index="${index}"><i class="fas fa-trash"></i> Удалить</button></td>
    `;
    curatorTable.appendChild(tr);
});

// Обработчик добавления куратора
addCuratorBtn.addEventListener('click', () => {
    if (addCuratorBtn.classList.contains('active')) {
        const inputs = curatorTable.querySelectorAll('input');
        const rowData = {
            login: inputs[0].value,
            password: inputs[1].value
        };
        if ([...inputs].every(input => input.value)) {
            inputs.forEach(input => input.disabled = true);
            const row = inputs[0].parentElement.parentElement;
            row.innerHTML = `
                <td>${rowData.login}</td>
                <td>${rowData.password}</td>
                <td><button class="delete-btn" data-index="${savedCuratorRows.length}"><i class="fas fa-trash"></i> Удалить</button></td>
            `;
            addCuratorBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить куратора';
            addCuratorBtn.classList.remove('active');
            savedCuratorRows.push(rowData);
            localStorage.setItem('curatorRows', JSON.stringify(savedCuratorRows));
            curatorRowCount++;
            attachDeleteListeners();
        } else {
            alert('Заполните все поля!');
        }
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" placeholder="Логин куратора ${curatorRowCount}"></td>
            <td><input type="text" placeholder="Пароль куратора ${curatorRowCount}"></td>
            <td></td>
        `;
        curatorTable.appendChild(tr);
        addCuratorBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить куратора';
        addCuratorBtn.classList.add('active');
    }
});

// Функция для привязки обработчиков удаления
function attachDeleteListeners() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', () => {
            const index = button.getAttribute('data-index');
            savedCuratorRows.splice(index, 1);
            localStorage.setItem('curatorRows', JSON.stringify(savedCuratorRows));
            curatorTable.innerHTML = '';
            curatorRowCount = savedCuratorRows.length + 1;
            savedCuratorRows.forEach((row, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.login}</td>
                    <td>${row.password}</td>
                    <td><button class="delete-btn" data-index="${idx}"><i class="fas fa-trash"></i> Удалить</button></td>
                `;
                curatorTable.appendChild(tr);
            });
            attachDeleteListeners();
        });
    });
}

// Инициализация обработчиков удаления
attachDeleteListeners();
