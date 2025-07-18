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

// Мечта и Сумма мечты
const dreamInput = document.getElementById('dream');
const dreamAmountInput = document.getElementById('dream-amount');
const saveDreamBtn = document.getElementById('save-dream');

// Загрузка сохраненных данных
if (localStorage.getItem('dream')) {
    dreamInput.value = localStorage.getItem('dream');
    dreamInput.disabled = true;
    dreamAmountInput.value = localStorage.getItem('dreamAmount');
    dreamAmountInput.disabled = true;
    saveDreamBtn.style.display = 'none';
}

saveDreamBtn.addEventListener('click', () => {
    if (dreamInput.value && dreamAmountInput.value) {
        localStorage.setItem('dream', dreamInput.value);
        localStorage.setItem('dreamAmount', dreamAmountInput.value);
        dreamInput.disabled = true;
        dreamAmountInput.disabled = true;
        saveDreamBtn.style.display = 'none';
    } else {
        alert('Пожалуйста, заполните оба поля!');
    }
});

// Таблица Доходы и расходы
const addIncomeExpenseBtn = document.getElementById('add-income-expense');
const incomeExpenseTable = document.getElementById('income-expense-table').querySelector('tbody');
let incomeExpenseRowCount = JSON.parse(localStorage.getItem('incomeExpenseRows'))?.length || 1;

// Загрузка сохраненных строк
const savedIncomeExpenseRows = JSON.parse(localStorage.getItem('incomeExpenseRows')) || [];
savedIncomeExpenseRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${row.move}</td>
        <td>${row.income}</td>
        <td>${row.expense}</td>
        <td>${row.cash}</td>
    `;
    incomeExpenseTable.appendChild(tr);
});

addIncomeExpenseBtn.addEventListener('click', () => {
    if (addIncomeExpenseBtn.classList.contains('active')) {
        const inputs = incomeExpenseTable.querySelectorAll('input');
        const rowData = {
            move: inputs[0].value,
            income: inputs[1].value,
            expense: inputs[2].value,
            cash: inputs[3].value
        };
        if ([...inputs].every(input => input.value)) {
            inputs.forEach(input => input.disabled = true);
            addIncomeExpenseBtn.innerHTML = '<i class="fas fa-plus"></i> Внести в таблицу';
            addIncomeExpenseBtn.classList.remove('active');
            savedIncomeExpenseRows.push(rowData);
            localStorage.setItem('incomeExpenseRows', JSON.stringify(savedIncomeExpenseRows));
            incomeExpenseRowCount++;
        } else {
            alert('Заполните все поля!');
        }
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" placeholder="Ход ${incomeExpenseRowCount}"></td>
            <td><input type="number" placeholder="Доходы"></td>
            <td><input type="number" placeholder="Расходы"></td>
            <td><input type="number" placeholder="Касса"></td>
        `;
        incomeExpenseTable.appendChild(tr);
        addIncomeExpenseBtn.innerHTML = '<i class="fas fa-check"></i> Завершить заполнение';
        addIncomeExpenseBtn.classList.add('active');
    }
});

// Таблица Навыки
const addSkillBtn = document.getElementById('add-skill');
const skillsTable = document.getElementById('skills-table').querySelector('tbody');
let skillsRowCount = JSON.parse(localStorage.getItem('skillsRows'))?.length || 1;

const savedSkillsRows = JSON.parse(localStorage.getItem('skillsRows')) || [];
savedSkillsRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.skill}</td>`;
    skillsTable.appendChild(tr);
});

addSkillBtn.addEventListener('click', () => {
    if (addSkillBtn.classList.contains('active')) {
        const input = skillsTable.querySelector('input');
        if (input.value) {
            input.disabled = true;
            addSkillBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить навык';
            addSkillBtn.classList.remove('active');
            savedSkillsRows.push({ skill: input.value });
            localStorage.setItem('skillsRows', JSON.stringify(savedSkillsRows));
            skillsRowCount++;
        } else {
            alert('Заполните поле!');
        }
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="text" placeholder="Навык ${skillsRowCount}"></td>`;
        skillsTable.appendChild(tr);
        addSkillBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить навык';
        addSkillBtn.classList.add('active');
    }
});

// Таблица Бизнес и активы
const addBusinessBtn = document.getElementById('add-business');
const businessTable = document.getElementById('business-table').querySelector('tbody');
let businessRowCount = JSON.parse(localStorage.getItem('businessRows'))?.length || 1;

const savedBusinessRows = JSON.parse(localStorage.getItem('businessRows')) || [];
savedBusinessRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${row.business}</td>
        <td>${row.amount}</td>
        <td>${row.cashflow}</td>
    `;
    businessTable.appendChild(tr);
});

addBusinessBtn.addEventListener('click', () => {
    if (addBusinessBtn.classList.contains('active')) {
        const inputs = businessTable.querySelectorAll('input');
        const rowData = {
            business: inputs[0].value,
            amount: inputs[1].value,
            cashflow: inputs[2].value
        };
        if ([...inputs].every(input => input.value)) {
            inputs.forEach(input => input.disabled = true);
            addBusinessBtn.innerHTML = '<i class="fas fa-plus"></i> Добавить бизнес/активы';
            addBusinessBtn.classList.remove('active');
            savedBusinessRows.push(rowData);
            localStorage.setItem('businessRows', JSON.stringify(savedBusinessRows));
            businessRowCount++;
        } else {
            alert('Заполните все поля!');
        }
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" placeholder="Бизнес/актив ${businessRowCount}"></td>
            <td><input type="number" placeholder="Сумма"></td>
            <td><input type="number" placeholder="Денежный поток"></td>
        `;
        businessTable.appendChild(tr);
        addBusinessBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить бизнес/активы';
        addBusinessBtn.classList.add('active');
    }
});

// Таблица 4 копилки
const addSavingsBtn = document.getElementById('add-savings');
const savingsTable = document.getElementById('savings-table').querySelector('tbody');
let savingsRowCount = JSON.parse(localStorage.getItem('savingsRows'))?.length || 1;

const savedSavingsRows = JSON.parse(localStorage.getItem('savingsRows')) || [];
savedSavingsRows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${row.charity}</td>
        <td>${row.dream}</td>
        <td>${row.savings}</td>
        <td>${row.investments}</td>
    `;
    savingsTable.appendChild(tr);
});

addSavingsBtn.addEventListener('click', () => {
    if (addSavingsBtn.classList.contains('active')) {
        const inputs = savingsTable.querySelectorAll('input');
        const rowData = {
            charity: inputs[0].value,
            dream: inputs[1].value,
            savings: inputs[2].value,
            investments: inputs[3].value
        };
        if ([...inputs].every(input => input.value)) {
            inputs.forEach(input => input.disabled = true);
            addSavingsBtn.innerHTML = '<i class="fas fa-plus"></i> Запись в таблицу';
            addSavingsBtn.classList.remove('active');
            savedSavingsRows.push(rowData);
            localStorage.setItem('savingsRows', JSON.stringify(savedSavingsRows));
            savingsRowCount++;
        } else {
            alert('Заполните все поля!');
        }
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="number" placeholder="Благотворительность ${savingsRowCount}"></td>
            <td><input type="number" placeholder="Мечта ${savingsRowCount}"></td>
            <td><input type="number" placeholder="Сбережения ${savingsRowCount}"></td>
            <td><input type="number" placeholder="Инвестиции ${savingsRowCount}"></td>
        `;
        savingsTable.appendChild(tr);
        addSavingsBtn.innerHTML = '<i class="fas fa-check"></i> Сохранить запись';
        addSavingsBtn.classList.add('active');
    }
});
