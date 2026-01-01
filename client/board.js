
function scaleGame(scale) {
    const container = document.querySelector('.game-container'); // Класс, латинская c
    container.style.transform = `translateY(-50%) scale(${scale})`;
}

window.addEventListener('load', function () {
    const screenWidth = window.innerWidth;

    let scale = 1.0; // по умолчанию 100%

    if (screenWidth < 1200) scale = 1.0;
    else if (screenWidth < 1400) scale = 1.2;
    else if (screenWidth > 2000) scale = 1.2;

    scaleGame(scale);
});

// Ждем полной загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("📜 board.js: Инициализация...");

    // --- ЛОГИКА ОСНОВНОГО ЧАТА ---
    const chatPanel = document.getElementById("chat-panel");
    const chatCollapseBtn = document.getElementById("chat-collapse-btn");

    if (chatPanel && chatCollapseBtn) {
        // Клик по кнопке сворачивания
        chatCollapseBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation(); // Чтобы тик по кнопке не считался кликом по панели

            const isCollapsed = chatPanel.classList.toggle("collapsed");

            // Обновляем иконку: если свернуто -> '+', иначе -> '–'
            chatCollapseBtn.textContent = isCollapsed ? "+" : "–";
            chatCollapseBtn.title = isCollapsed ? "Развернуть" : "Свернуть";

            console.log("Chat collapsed:", isCollapsed);
        });

        // Клик по самой панели в свернутом состоянии -> развернуть
        chatPanel.addEventListener("click", (e) => {
            if (chatPanel.classList.contains("collapsed")) {
                chatPanel.classList.remove("collapsed");
                chatCollapseBtn.textContent = "–";
                chatCollapseBtn.title = "Свернуть";
            }
        });
        console.log("✅ Лисенеры на основной чат навешаны");
    } else {
        console.error("❌ Не найдены элементы основного чата (chat-panel или btn)");
    }

    // --- ЛОГИКА ЧАТА ИГРОКОВ (ВВОД) ---
    const playersChatPanel = document.getElementById("players-chat-panel");
    const playersCollapseBtn = document.getElementById("players-chat-collapse-btn");

    if (playersChatPanel && playersCollapseBtn) {
        playersCollapseBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isCollapsed = playersChatPanel.classList.toggle("collapsed");

            playersCollapseBtn.textContent = isCollapsed ? "+" : "–";
            playersCollapseBtn.title = isCollapsed ? "Развернуть" : "Свернуть";

            console.log("Players Panel collapsed:", isCollapsed);
        });

        playersChatPanel.addEventListener("click", () => {
            if (playersChatPanel.classList.contains("collapsed")) {
                playersChatPanel.classList.remove("collapsed");
                playersCollapseBtn.textContent = "–";
                playersCollapseBtn.title = "Свернуть";
            }
        });
        console.log("✅ Лисенеры на чат игроков навешаны");
    } else {
        console.error("❌ Не найдены элементы чата игроков");
    }

    // --- ЛОГИКА НОВЫХ КНОПОК ФИНАНСОВОЙ КАРТОЧКИ ---

    // 1. ИСТОРИЯ
    const historyModal = document.getElementById("history-modal");
    const historyBtn = document.getElementById("btn-show-history");
    const historyCloseBtn = document.getElementById("history-close");

    if (historyModal && historyBtn && historyCloseBtn) {
        historyBtn.addEventListener("click", () => {
            historyModal.classList.add("active");
        });
        historyCloseBtn.addEventListener("click", () => {
            historyModal.classList.remove("active");
        });
        historyModal.addEventListener("click", (e) => {
            if (e.target === e.currentTarget) historyModal.classList.remove("active");
        });
        console.log("✅ Лисенеры на историю навешаны");
    } else {
        console.error("❌ Элементы истории не найдены", { historyModal, historyBtn, historyCloseBtn });
    }

    // 2. ФАКТИЧЕСКАЯ КАРТОЧКА (ТОГГЛ)
    const actualBtn = document.getElementById("btn-toggle-actual");
    const finDashboard = document.querySelector(".finance-dashboard");

    if (actualBtn && finDashboard) {
        actualBtn.addEventListener("click", () => {
            const isActive = finDashboard.classList.toggle("mode-actual");
            actualBtn.classList.toggle("active", isActive);
        });
        console.log("✅ Лисенер на фактическую кнопку навешан");
    } else {
        console.error("❌ Элементы фактической кнопки не найдены", { actualBtn, finDashboard });
    }

    // 2.5. КНОПКА АВТОЗАПОЛНЕНИЯ ТЕКУЩЕГО ХОДА
    const autofillBtn = document.getElementById("btn-autofill-turn");
    if (autofillBtn) {
        autofillBtn.addEventListener("click", () => {
            console.log("⚡ Автозаполнение текущего хода...");

            // Отправляем запрос на сервер
            if (window.socket) {
                window.socket.emit('player:autofill_current_turn', {}, (response) => {
                    if (response && response.success) {
                        console.log("✅ Автозаполнение выполнено:", response);

                        // Формируем сообщение о копилках
                        let walletsMsg = '';
                        if (response.hasWalletChanges && response.walletUpdates) {
                            const walletNames = {
                                charity: 'Благотворительность',
                                dream: 'Мечта',
                                savings: 'Сбережения',
                                investments: 'Инвестиции'
                            };
                            const changes = Object.entries(response.walletUpdates)
                                .filter(([_, v]) => v !== 0)
                                .map(([k, v]) => `${walletNames[k] || k}: ${v > 0 ? '+' : ''}${v}₴`)
                                .join('\n');
                            if (changes) {
                                walletsMsg = `\n\n📊 Копилки:\n${changes}`;
                            }
                        }

                        alert(`✅ Данные текущего хода добавлены!\n\n💰 Доходы: +${response.addedIncome || 0}₴\n💸 Расходы: +${response.addedExpenses || 0}₴${walletsMsg}`);

                        // ==========================================================
                        // КРИТИЧЕСКИ ВАЖНО: СИНХРОНИЗАЦИЯ ПОСЛЕ АВТОЗАПОЛНЕНИЯ
                        // НЕ УДАЛЯТЬ ЭТОТ ВЫЗОВ refreshFinanceData(true)!
                        // Он необходим, чтобы данные сервера сразу отобразились в полях ввода игрока.
                        // refreshFinanceData(true) перезаписывает ручные поля данными с сервера.
                        // ==========================================================
                        if (typeof refreshFinanceData === 'function') {
                            refreshFinanceData(true);
                        } else {
                            console.error("❌ Функция refreshFinanceData не найдена!");
                        }
                    } else {
                        console.error("❌ Ошибка автозаполнения:", response?.error);
                        alert(`❌ Ошибка: ${response?.error || 'Не удалось выполнить автозаполнение'}`);
                    }
                });
            } else {
                alert("❌ Нет подключения к серверу");
            }
        });
        console.log("✅ Лисенер на кнопку автозаполнения навешан");
    }

    // 3. ВЫБОР МЕЧТЫ
    const dreamSelect = document.getElementById("fin-dream-select");
    const dreamPrice = document.getElementById("fin-dream-price");
    const dreamImg = document.getElementById("fin-dream-img");

    if (dreamSelect && dreamPrice && dreamImg) {
        dreamSelect.addEventListener("change", (e) => {
            const option = e.target.options[e.target.selectedIndex];
            const price = option.getAttribute("data-price");
            const val = option.value;

            console.log("Выбрана мечта:", val, price);

            // Обновляем цену текстово
            dreamPrice.textContent = `${price} ₸`;

            // Обновляем картинку
            dreamImg.src = `cell-icon/${val}.png`;
        });
        console.log("✅ Лисенер на выбор мечты навешан");
    }

}); // END DOMContentLoaded

// =============================================================================
// ЛОГИКА ВЫБОРА МЕЧТЫ И МОДАЛКИ (вне DOMContentLoaded для доступа к socket)
// =============================================================================

// Ждем загрузки gameclient.js (socket должен быть доступен)
window.addEventListener('load', () => {
    console.log("📜 board.js: Инициализация логики мечты...");

    const dreamSelect = document.getElementById("fin-dream-select");
    const dreamPrice = document.getElementById("fin-dream-price");
    const dreamImg = document.getElementById("fin-dream-img");
    const dreamStatus = document.getElementById("fin-dream-status");
    const confirmModal = document.getElementById("dream-confirm-modal");
    const confirmName = document.getElementById("dream-confirm-name");
    const btnYes = document.getElementById("dream-confirm-yes");
    const btnNo = document.getElementById("dream-confirm-no");

    if (!dreamSelect || !dreamPrice || !dreamImg) {
        console.warn("⚠️ Элементы выбора мечты не найдены");
        return;
    }

    let pendingDreamData = null;

    // Функция блокировки UI после выбора мечты
    const lockDreamUI = (dreamData) => {
        dreamSelect.value = dreamData.id;
        dreamSelect.disabled = true;
        dreamPrice.textContent = `${dreamData.price} ₸`;
        dreamImg.src = `cell-icon/${dreamData.id}.png`;
        if (dreamStatus) {
            dreamStatus.textContent = `✅ ${dreamData.name}`;
            dreamStatus.style.display = 'block';
        }
        if (confirmModal) confirmModal.style.display = 'none';
    };

    // Функция отправки выбора на сервер
    const processDreamSelection = (data) => {
        const socket = window.socket;
        if (!socket) {
            alert("Ошибка: нет соединения с сервером");
            dreamSelect.disabled = false;
            return;
        }

        socket.emit('player:select_dream', data, (res) => {
            if (res && res.success) {
                lockDreamUI(res.dream);
            } else {
                alert("Ошибка: " + (res?.error || "Неизвестная ошибка"));
                dreamSelect.disabled = false;
                dreamSelect.value = "";
            }
        });
    };

    // Событие выбора мечты в dropdown
    dreamSelect.addEventListener("change", (e) => {
        const option = e.target.options[e.target.selectedIndex];
        if (!option || !option.value) return;

        const price = option.getAttribute("data-price");
        const val = option.value;
        const name = option.text.split('(')[0].trim();

        // Обновляем превью
        dreamPrice.textContent = `${price} ₸`;
        dreamImg.src = `cell-icon/${val}.png`;

        // Сохраняем данные для подтверждения
        pendingDreamData = { id: val, price, name };

        // Показываем модалку подтверждения
        if (confirmModal && confirmName) {
            confirmName.textContent = name;
            confirmModal.style.display = 'block';
            dreamSelect.disabled = true;
        } else {
            // Fallback - используем стандартный confirm
            if (confirm(`Выбрать "${name}" как мечту? Изменить потом нельзя!`)) {
                processDreamSelection(pendingDreamData);
            } else {
                dreamSelect.value = "";
                dreamPrice.textContent = "... ₸";
            }
        }
    });

    // Кнопка "Да" в модалке подтверждения
    if (btnYes) {
        btnYes.onclick = () => {
            if (confirmModal) confirmModal.style.display = 'none';
            if (pendingDreamData) {
                processDreamSelection(pendingDreamData);
                pendingDreamData = null;
            }
        };
    }

    // Кнопка "Нет" в модалке подтверждения
    if (btnNo) {
        btnNo.onclick = () => {
            if (confirmModal) confirmModal.style.display = 'none';
            dreamSelect.disabled = false;
            dreamSelect.value = "";
            dreamPrice.textContent = "... ₸";
            pendingDreamData = null;
        };
    }

    // Проверка состояния мечты при загрузке (если уже выбрана)
    const checkDreamState = () => {
        if (typeof gameClient !== 'undefined' && gameClient.myPlayerData && gameClient.myPlayerData.dream) {
            lockDreamUI(gameClient.myPlayerData.dream);
        }
    };

    // Проверяем каждую секунду (для синхронизации после переподключения)
    setInterval(checkDreamState, 1000);
    checkDreamState(); // Проверяем сразу

    console.log("✅ board.js: Логика мечты инициализирована");
});

// =============================================================================
// ОТКРЫТИЕ ФИНАНСОВОЙ МОДАЛКИ (Delegated Event)
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Делегированное событие для открытия финансовой карточки
    // Работает даже если элементы рендерятся динамически
    document.body.addEventListener('click', (e) => {
        // Расширенный список триггеров для открытия финансовой модалки
        const trigger = e.target.closest('.player-figure, .current-player-panel, .finance-card-trigger, .ant, .fin-avatar, #open-finance-btn');
        if (trigger) {
            const finModal = document.getElementById("finance-modal");
            if (finModal) {
                finModal.classList.add("active");
                console.log("✅ Финансовая модалка открыта");

                // ЗАГРУЗИТЬ ДАННЫЕ ПРИ ОТКРЫТИИ
                loadFinanceDataOnOpen();
            }
        }
    });

    // Клавиша F для открытия финансовой карточки (удобный хоткей)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
            // Не открывать если фокус в input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const finModal = document.getElementById("finance-modal");
            if (finModal) {
                if (finModal.classList.contains('active')) {
                    finModal.classList.remove('active');
                } else {
                    finModal.classList.add('active');
                }
            }
        }
    });

    // Закрытие финансовой модалки
    const finClose = document.getElementById("finance-close");
    const finModal = document.getElementById("finance-modal");

    if (finClose) {
        finClose.addEventListener("click", () => {
            if (window.closeInspection) window.closeInspection();
            if (finModal) finModal.classList.remove("active");
        });
    }

    if (finModal) {
        finModal.addEventListener("click", (e) => {
            if (e.target === e.currentTarget) {
                if (window.closeInspection) window.closeInspection();
                finModal.classList.remove("active");
            }
        });
    }
});

// =============================================================================
// ФИНАНСОВАЯ КАРТОЧКА - Синхронизация с сервером
// =============================================================================

// Режим отображения: 'manual' (ручной ввод) или 'actual' (фактический)
let financeMode = 'manual';

// === CURATOR INSPECTION LOGIC ===
window.currentInspectionTargetId = null;

window.inspectPlayer = function (targetId) {
    console.log('👁️ inspectPlayer called for:', targetId);
    if (!targetId) return;
    window.currentInspectionTargetId = targetId;

    const finModal = document.getElementById("finance-modal");
    if (finModal) {
        finModal.classList.add("active");

        // Change header style
        const header = finModal.querySelector('.fin-header');
        if (header) {
            header.style.background = '#805ad5';
            header.querySelector('h2').textContent = '👁️ ПРОВЕРКА ИГРОКА';
        }

        refreshFinanceData(true);
    } else {
        console.error('Finance modal not found');
    }
};

window.closeInspection = function () {
    window.currentInspectionTargetId = null;
    const finModal = document.getElementById("finance-modal");
    if (finModal) {
        const header = finModal.querySelector('.fin-header');
        if (header) {
            header.style.background = '';
            header.querySelector('h2').textContent = 'Финансовый отчет';
        }
    }
};

/**
 * Синхронизировать значения копилок на сервер
 */
function syncWalletsToServer() {
    const socket = window.socket;
    if (!socket) return;

    const wallets = {
        charity: Number(document.getElementById('wallet-charity-input')?.value) || 0,
        dream: Number(document.getElementById('wallet-dream-input')?.value) || 0,
        savings: Number(document.getElementById('wallet-savings-input')?.value) || 0,
        investments: Number(document.getElementById('wallet-invest-input')?.value) || 0
    };

    socket.emit('player:update_wallets', wallets, (res) => {
        if (res?.success) {
            console.log('💾 Копилки сохранены');
            updateTotalBalance();
        }
    });
}

function updateFinanceCardHeader(playerData, isInspection = false) {
    const nameEl = document.getElementById('fin-player-name');
    const roleEl = document.getElementById('fin-player-profession'); // Assuming there's a role/status

    if (nameEl) {
        nameEl.textContent = isInspection ? `Проверка: ${playerData.displayName}` : playerData.displayName;
        if (isInspection) nameEl.style.color = '#e9d8fd';
        else nameEl.style.color = '';
    }
    // Update avatar if we have logic for it
}

function highlightDiscrepancies(manual, server) {
    clearDiscrepancyHighlights();

    const serverWallets = server.calculatedWallets || {};

    checkFieldDiscrepancy('wallet-charity-input', serverWallets.charity);
    checkFieldDiscrepancy('wallet-dream-input', serverWallets.dream);
    checkFieldDiscrepancy('wallet-savings-input', serverWallets.savings);
    checkFieldDiscrepancy('wallet-invest-input', serverWallets.investments);

    // Check Totals
    // This is harder because inputs are sums, but we can check the total display
    // or we can check simple totals if we had input fields for them (we don't, they are calculated)
}

function checkFieldDiscrepancy(inputId, serverValue) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const manualVal = Number(input.value) || 0;
    const serverVal = Number(serverValue) || 0;

    if (manualVal !== serverVal) {
        input.classList.add('discrepancy-error');
        input.title = `Сервер: ${serverVal}`;

        // Optional: Add a small label
        const container = input.parentElement;
        if (container) {
            let hint = container.querySelector('.server-hint');
            if (!hint) {
                hint = document.createElement('div');
                hint.className = 'server-hint';
                hint.style.color = '#fc8181';
                hint.style.fontSize = '10px';
                hint.style.position = 'absolute';
                hint.style.bottom = '-14px';
                hint.style.right = '0';
                container.style.position = 'relative';
                container.appendChild(hint);
            }
            hint.textContent = `Факт: ${serverVal}`;
        }
    }
}

function clearDiscrepancyHighlights() {
    document.querySelectorAll('.discrepancy-error').forEach(el => {
        el.classList.remove('discrepancy-error');
        el.title = '';
    });
    document.querySelectorAll('.server-hint').forEach(el => el.remove());
}

// === ФИНАНСОВАЯ КАРТОЧКА ===

window.serverFinanceData = {}; // Глобальное хранилище данных сервера

if (window.socket) {
    // Обновлять данные при каждом изменении состояния игры, если модалка открыта
    window.socket.on('game:state_update', (state) => {
        const modal = document.getElementById('finance-modal'); // Проверим ID в HTML
        // Fix: Check for .active class OR style.display block (checks both mobile and desktop states)
        if (modal && (modal.classList.contains('active') || modal.style.display === 'block')) {
            refreshFinanceData(false); // false = не перезаписывать ручные поля
        }
    });
}

/**
 * Загрузить данные финансов при открытии модалки (первый раз)
 */
function loadFinanceDataOnOpen() {
    // Если мы НЕ в режиме инспекции (нажали F или кнопку), сбрасываем таргет
    // Но если мы ТОЛЬКО ЧТО нажали "Inspect", то currentInspectionTargetId уже установлен
    if (!document.getElementById("finance-modal").classList.contains("active")) {
        // Logic: usually this is called triggers that open modal.
        // Inspect button calls open modal manually then refresh.
        // So if we are here via 'f' key or normal button, we should likely reset unless inspection is active.
        if (window.currentInspectionTargetId) {
            window.closeInspection();
        }
    }

    // Simple rule: If inspection ID is set, we keep it? 
    // No, if user closes modal and opens again, it should be their own.
    // So usually closeInspection clears it.

    // ВАЖНО: При открытии карточки ВСЕГДА загружаем актуальные данные (включая ручные поля)
    console.log("🔓 Открытие карточки: Загрузка всех данных...");
    refreshFinanceData(true);
}

/**
 * Получить и обновить данные финансов
 * @param {boolean} updateManualInputs - нужно ли обновлять инпуты (false если нужно сохранить ввод пользователя)
 */
function refreshFinanceData(updateManualInputs = false) {
    const socket = window.socket;
    if (!socket) return;

    // Request data (optionally for target player)
    const requestData = window.currentInspectionTargetId ? { targetPlayerId: window.currentInspectionTargetId } : {};

    socket.emit('player:get_finance_data', requestData, (res) => {
        if (!res?.success) return;

        console.log('📊 Данные финансов обновлены:', res);

        window.serverFinanceData = res.auto || {};
        const manual = res.manual || {};
        const isInspection = res.isInspection;

        // 0. Обновляем заголовки (Имя игрока)
        let playerData = window.gameClient?.myPlayerData;

        // If inspection, we might not have full player data object easily accessible unless we fetch it 
        // or getting it from the response would be better. 
        // For now, let's try to find it in gameState if available
        if (isInspection && window.gameClient?.gameState?.players) {
            playerData = window.gameClient.gameState.players[window.currentInspectionTargetId];
        }

        if (playerData) {
            updateFinanceCardHeader(playerData, isInspection);
        }

        // 1. Обновляем общие элементы (всегда)
        updateHistoryTable(res.turnHistory || []);

        // Fix: updateAssetsList might need safety check
        if (typeof updateAssetsList === 'function') {
            updateAssetsList(res.assets || {});
        }
        if (typeof updateSkillsList === 'function') {
            updateSkillsList(res.assets?.skills || []);
        }
        if (typeof updateCapitalChart === 'function') {
            updateCapitalChart(res.turnHistory || []);
        }

        // 2. Если открыта "Фактическая карточка" (Серверная) - обновляем её вид
        const btn = document.getElementById('btn-show-server-data');
        if (btn && btn.classList.contains('active')) {
            renderServerDataView();
        }

        // 3. Обновляем ручные поля ТОЛЬКО если это запрошено (при открытии)
        if (updateManualInputs) {
            const wallets = manual.wallets || {};
            setInputValue('wallet-charity-input', wallets.charity || 0);
            setInputValue('wallet-dream-input', wallets.dream || 0);
            setInputValue('wallet-savings-input', wallets.savings ?? 100);
            setInputValue('wallet-invest-input', wallets.investments || 0);

            populateIncomeList(manual.incomeEntries || []);
            updateIncomeTotal(manual.monthlyIncome || 0);

            populateExpenseList(manual.expenseEntries || []);
            updateExpenseTotal(manual.monthlyExpenses || 0);

            updateTotalBalance();
            enableManualInputs();
        }

        // 4. Highlight Discrepancies (if inspecting)
        if (isInspection) {
            highlightDiscrepancies(manual, res.auto);
        } else {
            clearDiscrepancyHighlights();
        }
    });
}

/**
 * Переключить отображение данных (Ручные <-> Серверные)
 */
function toggleServerData() {
    const btn = document.getElementById('btn-show-server-data');
    const showingServer = btn.classList.contains('active');

    if (!showingServer) {
        // === ПЕРЕХОД К ФАКТИЧЕСКОЙ КАРТОЧКЕ (SERVER) ===
        btn.textContent = '📝 Ручная карточка';
        btn.classList.add('active');
        btn.style.background = '#e74c3c';

        // Блокируем инпуты визуально
        document.querySelectorAll('.fin-input, .fin-flow-input-desc, .fin-flow-input-val').forEach(el => {
            el.disabled = true;
            el.style.opacity = '0.7';
        });

        // Скрываем кнопки добавления
        document.querySelectorAll('.fin-add-btn').forEach(b => b.style.display = 'none');

        // Рендерим данные сервера
        renderServerDataView();

    } else {
        // === ВОЗВРАТ К РУЧНОЙ КАРТОЧКЕ ===
        btn.textContent = '📊 Фактическая карточка';
        btn.classList.remove('active');
        btn.style.background = '';

        // Перезагружаем РУЧНЫЕ данные (восстанавливаем ввод игрока из базы)
        // В идеале мы не должны терять unsaved changes, но пока так:
        // reloadFinanceDataOnOpen() загрузит последнее СОХРАНЕННОЕ состояние.
        // Если игрок писал и не сохранил -> переключил -> вернулся -> данные пропадут.
        // Это допустимое поведение для кнопки "Переключить режим".
        loadFinanceDataOnOpen();

        document.querySelectorAll('.fin-add-btn').forEach(b => b.style.display = 'flex');
    }
}

/**
 * Отобразить данные сервера в текущих полях (Read Only View)
 */
function renderServerDataView() {
    const auto = window.serverFinanceData || {};
    const wallets = auto.calculatedWallets || {};

    // Копилки
    setInputValue('wallet-charity-input', wallets.charity || 0);
    setInputValue('wallet-dream-input', wallets.dream || 0);
    setInputValue('wallet-savings-input', wallets.savings || 0);
    setInputValue('wallet-invest-input', wallets.investments || 0);

    // Доходы (История)
    const incomeList = document.getElementById('fin-income-list');
    if (incomeList) {
        incomeList.innerHTML = (auto.incomeHistory || []).map(e => `
            <div class="fin-flow-item" style="opacity:0.8">
               <span style="flex:1">Server: ${e.type}</span>
               <span style="font-weight:bold">+${e.amount}</span>
            </div>
        `).join('');
    }

    // Расходы (История)
    const expenseList = document.getElementById('fin-expense-list');
    if (expenseList) {
        expenseList.innerHTML = (auto.expensesHistory || []).map(e => `
            <div class="fin-flow-item" style="opacity:0.8">
               <span style="flex:1">Server: ${e.type}</span>
               <span style="font-weight:bold">-${e.amount}</span>
            </div>
        `).join('');
    }
}

/**
 * Заполнить список доходов
 */
function populateIncomeList(entries) {
    const listEl = document.getElementById('fin-income-list');
    if (!listEl) return;

    if (entries.length === 0) {
        listEl.innerHTML = '<div class="fin-flow-item fin-empty-hint"><span style="opacity:0.5">Нет записей</span></div>';
        return;
    }

    listEl.innerHTML = entries.map(e => `
        <div class="fin-flow-item" data-id="${e.id}">
            <input type="text" class="fin-flow-input-desc" value="${e.name || ''}" placeholder="Название">
            <input type="number" class="fin-flow-input-val" value="${e.amount || 0}">
        </div>
    `).join('');
}

/**
 * Заполнить список расходов
 */
function populateExpenseList(entries) {
    const listEl = document.getElementById('fin-expense-list');
    if (!listEl) return;

    if (entries.length === 0) {
        listEl.innerHTML = '<div class="fin-flow-item fin-empty-hint"><span style="opacity:0.5">Нет записей</span></div>';
        return;
    }

    listEl.innerHTML = entries.map(e => `
        <div class="fin-flow-item" data-id="${e.id}">
            <input type="text" class="fin-flow-input-desc" value="${e.name || ''}" placeholder="Название">
            <input type="number" class="fin-flow-input-val" value="${e.amount || 0}">
        </div>
    `).join('');
}

/**
 * Обновить итого доходов
 */
function updateIncomeTotal(amount) {
    const el = document.getElementById('fin-income-total');
    if (el) el.textContent = `+${amount} ₸`;
}

/**
 * Обновить итого расходов
 */
function updateExpenseTotal(amount) {
    const el = document.getElementById('fin-expense-total');
    if (el) el.textContent = `-${amount} ₸`;
}

/**
 * Заполнить список доходов из АВТОДАННЫХ сервера (read-only)
 */
function populateAutoIncomeList(entries) {
    const listEl = document.getElementById('fin-income-list');
    if (!listEl) return;

    if (entries.length === 0) {
        listEl.innerHTML = '<div class="fin-flow-item fin-empty-hint"><span style="opacity:0.5">Нет доходов</span></div>';
        return;
    }

    listEl.innerHTML = entries.map(e => `
        <div class="fin-flow-item auto-entry">
            <span class="fin-flow-desc">${e.type || 'Доход'}</span>
            <span class="fin-flow-val text-green">+${e.amount || 0} ₸</span>
        </div>
    `).join('');
}

/**
 * Заполнить список расходов из АВТОДАННЫХ сервера (read-only)
 */
function populateAutoExpenseList(entries) {
    const listEl = document.getElementById('fin-expense-list');
    if (!listEl) return;

    if (entries.length === 0) {
        listEl.innerHTML = '<div class="fin-flow-item fin-empty-hint"><span style="opacity:0.5">Нет расходов</span></div>';
        return;
    }

    listEl.innerHTML = entries.map(e => `
        <div class="fin-flow-item auto-entry">
            <span class="fin-flow-desc">${e.type || e.source || 'Расход'}</span>
            <span class="fin-flow-val text-red">-${e.amount || 0} ₸</span>
        </div>
    `).join('');
}

/**
 * Обновить общий баланс на кнопке и в футере
 */
function updateTotalBalance() {
    const charity = Number(document.getElementById('wallet-charity-input')?.value) || 0;
    const dream = Number(document.getElementById('wallet-dream-input')?.value) || 0;
    const savings = Number(document.getElementById('wallet-savings-input')?.value) || 0;
    const investments = Number(document.getElementById('wallet-invest-input')?.value) || 0;

    const total = charity + dream + savings + investments;

    // Обновить на кнопке
    const btnBalance = document.getElementById('total-balance-display');
    if (btnBalance) btnBalance.textContent = `${total} ₸`;

    // Обновить в футере карточки
    const footerBalance = document.querySelector('.fin-total-balance');
    if (footerBalance) footerBalance.textContent = `Общий Баланс: ${total} ₸`;

    // Обновить прогресс к мечте
    updateDreamProgress(dream);
}

/**
 * Обновить прогресс к мечте
 */
function updateDreamProgress(dreamAmount) {
    const dreamPriceEl = document.getElementById('fin-dream-price');
    if (!dreamPriceEl) return;

    const priceText = dreamPriceEl.textContent.replace(/[^\d]/g, '');
    const dreamPrice = Number(priceText) || 1000;
    const percent = Math.min(100, Math.round((dreamAmount / dreamPrice) * 100));

    // Обновить круговой прогресс
    const circle = document.getElementById('fin-dream-circle');
    const percentText = document.getElementById('fin-dream-percent');

    if (circle) circle.setAttribute('stroke-dasharray', `${percent}, 100`);
    if (percentText) percentText.textContent = `${percent}%`;
}

/**
 * Добавить запись дохода
 */
function addIncomeEntry(entry = null) {
    const listEl = document.getElementById('fin-income-list');
    if (!listEl) return;

    // Убираем hint если есть
    const emptyHint = listEl.querySelector('.fin-empty-hint');
    if (emptyHint) emptyHint.remove();

    const id = entry ? entry.id : Date.now();
    const name = entry ? entry.name : '';
    const amount = entry ? entry.amount : 0;

    // Создать новую строку
    const newItem = document.createElement('div');
    newItem.className = 'fin-flow-item';
    newItem.setAttribute('data-id', id);
    newItem.innerHTML = `
        <input type="text" class="fin-flow-input-desc" placeholder="Название" value="${name}">
        <input type="number" class="fin-flow-input-val" value="${amount}">
    `;
    listEl.appendChild(newItem);

    // Фокус на новое поле
    newItem.querySelector('.fin-flow-input-desc').focus();
}

/**
 * Добавить запись расхода
 */
function addExpenseEntry(entry = null) {
    const listEl = document.getElementById('fin-expense-list');
    if (!listEl) return;

    const emptyHint = listEl.querySelector('.fin-empty-hint');
    if (emptyHint) emptyHint.remove();

    const id = entry ? entry.id : Date.now();
    const name = entry ? entry.name : '';
    const amount = entry ? entry.amount : 0;

    const newItem = document.createElement('div');
    newItem.className = 'fin-flow-item';
    newItem.setAttribute('data-id', id);
    newItem.innerHTML = `
        <input type="text" class="fin-flow-input-desc" placeholder="Название" value="${name}">
        <input type="number" class="fin-flow-input-val" value="${amount}">
    `;
    listEl.appendChild(newItem);

    newItem.querySelector('.fin-flow-input-desc').focus();
}

// toggleServerData removed as per user request (Actual Data now opens modal only)
function closeServerDataModal() {
    const modal = document.getElementById('server-data-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Открыть модалку с серверными данными
 */
function openServerDataModal() {
    const modal = document.getElementById('server-data-modal');
    if (modal) {
        modal.style.display = 'block';
        loadServerModalData();
    }
}

/**
 * Загрузить данные в серверную модалку
 */
function loadServerModalData() {
    const socket = window.socket;
    if (!socket) return;

    socket.emit('player:get_finance_data', (res) => {
        if (!res?.success) return;

        const auto = res.auto;
        const wallets = auto?.calculatedWallets || {};

        // Заполнить копилки
        document.getElementById('srv-wallet-charity').textContent = wallets.charity || 0;
        document.getElementById('srv-wallet-dream').textContent = wallets.dream || 0;
        document.getElementById('srv-wallet-savings').textContent = wallets.savings || 0;
        document.getElementById('srv-wallet-invest').textContent = wallets.investments || 0;

        // Заполнить доходы
        const incomeList = document.getElementById('srv-income-list');
        const incomes = auto?.incomeHistory || [];
        if (incomes.length > 0) {
            incomeList.innerHTML = incomes.map(i =>
                `<div class="sf-item"><span>${i.type || 'Доход'}</span><span>+${i.amount}₸</span></div>`
            ).join('');
        } else {
            incomeList.innerHTML = '<div class="sf-empty">Нет данных</div>';
        }
        const totalIncome = incomes.reduce((sum, e) => sum + (e.amount || 0), 0);
        document.getElementById('srv-income-total').textContent = totalIncome;

        // Заполнить расходы
        const expenseList = document.getElementById('srv-expense-list');
        const expenses = auto?.expensesHistory || [];
        if (expenses.length > 0) {
            expenseList.innerHTML = expenses.map(e =>
                `<div class="sf-item"><span>${e.type || 'Расход'}</span><span>-${e.amount}₸</span></div>`
            ).join('');
        } else {
            expenseList.innerHTML = '<div class="sf-empty">Нет данных</div>';
        }
        const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        document.getElementById('srv-expense-total').textContent = totalExpense;

        // Баланс
        const total = Object.values(wallets).reduce((a, b) => a + b, 0);
        document.getElementById('srv-total-balance').textContent = total;
    });
}

// Инициализация обработчиков серверной модалки
document.addEventListener('DOMContentLoaded', () => {
    // Открыть серверную модалку
    const btnToggle = document.getElementById('btn-toggle-actual');
    if (btnToggle) {
        btnToggle.addEventListener('click', openServerDataModal);
    }

    // Закрыть серверную модалку
    const btnClose = document.getElementById('server-modal-close');
    if (btnClose) {
        btnClose.addEventListener('click', closeServerDataModal);
    }
});

// loadActualFinanceData удалена - серверные данные теперь только в отдельной модалке

/**
 * Включить ручной ввод
 */
function enableManualInputs() {
    // Разблокируем все инпуты (копилки, доходы, расходы)
    document.querySelectorAll('.fin-input, .fin-flow-input-desc, .fin-flow-input-val').forEach(el => {
        el.disabled = false;
        el.style.opacity = '1';
    });
}

/**
 * Установить значение input (с опциональной блокировкой)
 */
function setInputValue(id, value, disabled = false) {
    const el = document.getElementById(id);
    if (el) {
        el.value = value;
        el.disabled = disabled;
    }
}

/**
 * Обновить список активов/бизнесов и предметов
 */
function updateAssetsList(assetsData) {
    const listEl = document.getElementById('fin-assets-list');
    if (!listEl) return;

    // Support both old array format (businesses only) and new object format
    const businesses = Array.isArray(assetsData) ? assetsData : (assetsData.businesses || []);
    const items = Array.isArray(assetsData) ? [] : (assetsData.items || []);

    if (businesses.length === 0 && items.length === 0) {
        listEl.innerHTML = '<div class="fin-asset-item"><div class="fin-asset-info"><h4>Нет активов</h4><span>Купите бизнес или вещи!</span></div></div>';
        return;
    }

    let html = '';

    // 1. Бизнесы
    if (businesses.length > 0) {
        // html += '<div class="fin-section-title">Бизнесы</div>';
        html += businesses.map(b => `
            <div class="fin-asset-item">
                <div class="fin-asset-info">
                    <h4>🏢 ${b.name}</h4>
                    <span>Доход: +${b.cashflow || b.income || 0}/мес</span>
                </div>
            </div>
        `).join('');
    }

    // 2. Предметы (Items)
    if (items.length > 0) {
        // html += '<div class="fin-section-title">Имущество</div>';
        html += items.map(item => `
            <div class="fin-asset-item">
                <div class="fin-asset-info">
                    <h4>📦 ${item.name}</h4>
                    <span>Цена: ${item.price} ₸</span>
                </div>
            </div>
        `).join('');
    }
    listEl.innerHTML = html;
}

/**
 * Обновить заголовок финансовой карточки (имя игрока)
 * @param {object} player - Объект игрока, содержащий displayName
 */
function updateFinanceCardHeader(player) {
    // 2. Обновить заголовок (Имя и Роль)
    const nameEl = document.querySelector('.fin-player-details h2');
    const roleEl = document.querySelector('.fin-player-sub');

    if (nameEl) nameEl.textContent = 'Игрок'; // Можно менять на Статус или оставить "Игрок"
    if (roleEl && player?.displayName) {
        // Вставляем имя игрока вместо "ONLINE CEO"
        // Используем HTML чтобы сохранить статус ONLINE если нужно, но пользователь просил "только имя"
        // "пусть только имя высвечивается... это же серверу нужен номер"
        // "в том месте где написано CEO пусть подставляется имя игрока"
        roleEl.innerHTML = `
            <span class="fin-tag">ONLINE</span>
            <span style="color: navajowhite; font-weight: bold; font-size: 16px;">${player.displayName}</span>
         `;
    }
}

/**
 * Обновить список навыков
 */
function updateSkillsList(skills) {
    const listEl = document.getElementById('fin-skills-list');
    if (!listEl) return;

    if (skills.length === 0) {
        listEl.innerHTML = '<div class="fin-asset-item" style="border-color: var(--fin-accent-purple)"><div class="fin-asset-icon">🎓</div><div class="fin-asset-info"><h4>Нет навыков</h4><span>Изучайте!</span></div></div>';
        return;
    }

    listEl.innerHTML = skills.map(s => `
        <div class="fin-asset-item" style="border-color: var(--fin-accent-purple)">
            <div class="fin-asset-icon">🎓</div>
            <div class="fin-asset-info">
                <h4>${s.name}</h4>
                <span>Уровень: ${s.level || 'Базовый'}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Обновить таблицу истории
 */
function updateHistoryTable(history) {
    const tbody = document.getElementById('history-list-body');
    if (!tbody) return;

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; opacity: 0.5;">История пуста</td></tr>';
        return;
    }

    tbody.innerHTML = history.map((h, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>🎲 ${h.dice || '-'}</td>
            <td>${h.cellName || h.cellKey || '-'}</td>
            <td>
                <div style="font-weight:bold">${h.cardTitle || '-'}</div>
                <div style="font-size:10px; color:#aaa; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.cardDescription || ''}">${h.cardDescription || ''}</div>
            </td>
            <td class="${h.amount >= 0 ? 'text-green' : 'text-red'}">${h.amount >= 0 ? '+' : ''}${h.amount || 0} ₸</td>
        </tr>
    `).join('');
}

/**
 * Простой график роста капитала (бары)
 * ИСПРАВЛЕНО: Показываем бары ТОЛЬКО за реальные ходы игрока
 */
function updateCapitalChart(history) {
    const container = document.querySelector('.fin-graph-placeholder');
    if (!container) return;

    // Если нет истории ходов - показываем сообщение
    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="simple-chart" style="display: flex; align-items: center; justify-content: center; height: 60px;">
                <span style="font-size: 11px; color: #888;">Сделайте первый ход</span>
            </div>
        `;
        return;
    }

    // Преобразуем историю в точки данных (только реальные ходы)
    let runningTotal = 100; // Начальный капитал
    const dataPoints = [];

    history.forEach(h => {
        runningTotal += (h.amount || 0);
        dataPoints.push(Math.max(0, runningTotal));
    });

    // Создаем простые бары (только за реальные ходы)
    const maxVal = Math.max(...dataPoints, 100);
    const barsHtml = dataPoints.slice(-10).map((val, i) => {
        const height = Math.round((val / maxVal) * 60);
        return `<div class="chart-bar" style="height: ${height}px;" title="${val} ₸"></div>`;
    }).join('');

    container.innerHTML = `
        <div class="simple-chart">${barsHtml}</div>
        <span style="font-size: 10px;">Данные за последние ${Math.min(dataPoints.length, 10)} ход(ов)</span>
    `;
}

// =============================================================================
// ИНИЦИАЛИЗАЦИЯ СЛУШАТЕЛЕЙ ФИНАНСОВОЙ КАРТОЧКИ
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Слушатели на изменение копилок
    ['wallet-charity-input', 'wallet-dream-input', 'wallet-savings-input', 'wallet-invest-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                syncWalletsToServer();
                updateTotalBalance();
            });
            el.addEventListener('input', updateTotalBalance);
        }
    });

    // Кнопки добавления доходов/расходов (по ID)
    const btnAddIncome = document.getElementById('btn-add-income');
    const btnAddExpense = document.getElementById('btn-add-expense');

    if (btnAddIncome) {
        btnAddIncome.addEventListener('click', () => {
            // Сначала отправляем на сервер, создаем ID
            window.socket?.emit('player:add_income', { name: 'Новый доход', amount: 0 }, (res) => {
                if (res && res.success) {
                    addIncomeEntry(res.entry); // Добавляем в UI уже с ID
                } else {
                    console.error('Ошибка добавления дохода:', res);
                }
            });
        });
    }

    if (btnAddExpense) {
        btnAddExpense.addEventListener('click', () => {
            window.socket?.emit('player:add_expense', { name: 'Новый расход', amount: 0 }, (res) => {
                if (res && res.success) {
                    addExpenseEntry(res.entry);
                } else {
                    console.error('Ошибка добавления расхода:', res);
                }
            });
        });
    }

    // Кнопка переключения режима
    const actualBtn = document.getElementById('btn-toggle-actual');
    if (actualBtn) {
        // Убираем клонирование листенеров - переопределяем поведение
        // Новое поведение: просто открыть модалку (без смены стилей)
        const newActualBtn = actualBtn.cloneNode(true);
        actualBtn.parentNode.replaceChild(newActualBtn, actualBtn);

        newActualBtn.addEventListener('click', () => {
            openServerDataModal();
        });
    }

    // Кнопка подтверждения карточки (разблокирует следующий ход)
    const confirmBtn = document.getElementById('btn-confirm-card');
    if (confirmBtn) {
        // Clone to remove old listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

        newConfirmBtn.addEventListener('click', () => {
            const socket = window.socket;
            if (!socket) return;

            newConfirmBtn.disabled = true;
            newConfirmBtn.textContent = '⏳ Сохранение...';

            // 1. Собираем данные РУЧНЫХ записей
            const incomeEntries = [];
            document.querySelectorAll('#fin-income-list .fin-flow-item').forEach(el => {
                // Если элемент не пустой хинт
                if (el.classList.contains('fin-empty-hint')) return;
                incomeEntries.push({
                    id: el.getAttribute('data-id'),
                    name: el.querySelector('.fin-flow-input-desc').value,
                    amount: Number(el.querySelector('.fin-flow-input-val').value) || 0
                });
            });

            const expenseEntries = [];
            document.querySelectorAll('#fin-expense-list .fin-flow-item').forEach(el => {
                if (el.classList.contains('fin-empty-hint')) return;
                expenseEntries.push({
                    id: el.getAttribute('data-id'),
                    name: el.querySelector('.fin-flow-input-desc').value,
                    amount: Number(el.querySelector('.fin-flow-input-val').value) || 0
                });
            });

            const monthlyIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
            const monthlyExpenses = expenseEntries.reduce((sum, e) => sum + e.amount, 0);

            // === CURATOR INSPECTION SAVE ===
            if (window.currentInspectionTargetId && window.currentInspectionTargetId !== window.gameClient?.myPlayerData?.id) {
                const wallets = {
                    charity: Number(document.getElementById('wallet-charity-input')?.value) || 0,
                    dream: Number(document.getElementById('wallet-dream-input')?.value) || 0,
                    savings: Number(document.getElementById('wallet-savings-input')?.value) || 0,
                    investments: Number(document.getElementById('wallet-invest-input')?.value) || 0
                };

                socket.emit('curator:save_player_finances', {
                    targetPlayerId: window.currentInspectionTargetId,
                    incomeEntries,
                    expenseEntries,
                    monthlyIncome,
                    monthlyExpenses,
                    wallets
                }, (res) => {
                    if (res?.success) {
                        newConfirmBtn.textContent = '✅ Исправлено (Куратор)';
                        newConfirmBtn.classList.add('btn-success');
                        setTimeout(() => {
                            newConfirmBtn.textContent = '✅ Подтвердить карточку';
                            newConfirmBtn.classList.remove('btn-success');
                            newConfirmBtn.disabled = false;
                        }, 2000);
                    } else {
                        newConfirmBtn.textContent = '❌ Ошибка';
                        console.error(res?.error);
                        setTimeout(() => { newConfirmBtn.disabled = false; }, 2000);
                    }
                });
                return; // Stop here
            }

            // 2. Отправляем ручные записи
            socket.emit('player:update_manual_entries', {
                incomeEntries,
                expenseEntries,
                monthlyIncome,
                monthlyExpenses
            }, (resManual) => {
                console.log('Manual entries saved:', resManual);

                // 3. Сохраняем копилки
                const wallets = {
                    charity: Number(document.getElementById('wallet-charity-input')?.value) || 0,
                    dream: Number(document.getElementById('wallet-dream-input')?.value) || 0,
                    savings: Number(document.getElementById('wallet-savings-input')?.value) || 0,
                    investments: Number(document.getElementById('wallet-invest-input')?.value) || 0
                };

                socket.emit('player:update_wallets', wallets, (resUpdate) => {
                    console.log('Wallets synced:', resUpdate);

                    // 4. Подтверждаем
                    socket.emit('player:confirm_card', (resConfirm) => {
                        if (resConfirm?.success) {
                            newConfirmBtn.textContent = '✅ Подтверждено';
                            newConfirmBtn.classList.add('btn-success');

                            setTimeout(() => {
                                newConfirmBtn.textContent = '✅ Подтвердить карточку';
                                newConfirmBtn.classList.remove('btn-success');
                                newConfirmBtn.disabled = false;
                            }, 3000);

                            console.log('✅ Карточка подтверждена');
                        } else {
                            newConfirmBtn.textContent = '❌ Ошибка';
                            console.error('❌ Ошибка подтверждения:', resConfirm?.error);
                            alert(resConfirm?.error || 'Ошибка подтверждения');

                            setTimeout(() => {
                                newConfirmBtn.textContent = '✅ Подтвердить карточку';
                                newConfirmBtn.disabled = false;
                            }, 2000);
                        }
                    });
                });
            });
        });
    }

    // Инициализация баланса
    updateTotalBalance();
    console.log('✅ Финансовая карточка инициализирована');
});

// =============================================================================
// MOBILE GRID SUPPORT (only affects screens ≤1200px)
// =============================================================================

(function initMobileGrid() {
    // Helper to check mobile state via User Agent (Strict Mobile Device Check)
    const isMobileDevice = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    // Disable mobile.css on desktop immediately
    const mobileCssLink = document.getElementById('mobile-css');
    if (!isMobileDevice() && mobileCssLink) {
        mobileCssLink.disabled = true;
        console.log('Mobile layout disabled for Desktop');
    }

    // Helper to check if we are in mobile mode (must be mobile device AND correct width)
    const isMobile = () => isMobileDevice() && window.innerWidth <= 1200;

    function updateGridLayout() {
        if (!isMobile()) return;

        const chatPanel = document.getElementById('chat-panel');
        const playersPanel = document.getElementById('players-chat-panel');

        // Проверяем, свернуты ли оба чата
        const bothCollapsed = chatPanel?.classList.contains('collapsed') &&
            playersPanel?.classList.contains('collapsed');

        // Добавляем класс на body для изменения CSS Grid колонок
        document.body.classList.toggle('chats-collapsed', bothCollapsed);
    }

    // Слушаем клики для обновления layout (с небольшой задержкой, чтобы класс успел переключиться)
    document.addEventListener('click', (e) => {
        if (isMobile() && (e.target.closest('#chat-panel') || e.target.closest('#players-chat-panel'))) {
            setTimeout(updateGridLayout, 50);
        }
    });

    // При загрузке и ресайзе
    window.addEventListener('load', updateGridLayout);
    window.addEventListener('resize', () => {
        if (isMobile()) updateGridLayout();
    });
    // === FIX: Ensure close buttons work on touch devices ===
    const closeButtons = document.querySelectorAll('.fin-close-btn, #finance-close, #history-close, #server-modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent ghost clicks
            e.stopPropagation();
            console.log('👆 Touch close triggering click');
            btn.click();
        }, { passive: false });
    });



    console.log('📱 Mobile touch handlers initialized');
})();
