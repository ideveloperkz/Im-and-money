console.log('📜 deckanimation.js loaded');
const decks = document.querySelectorAll('.deck');
console.log(`🃏 Found ${decks.length} decks`);

const card = document.getElementById('card');
// Dynamic content
const cardDynamicContent = document.getElementById('card-dynamic-content');
const cardTitle = document.getElementById('card-title');
const cardText = document.getElementById('card-text');
const cardExtra = document.getElementById('card-extra-info');
const cardCloseBtn = document.getElementById('card-close-btn');



let isAnimating = false;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

decks.forEach(deck => {
    deck.addEventListener('click', async () => {
        console.log(`🖱️ Clicked on deck: ${deck.dataset.deck}`);

        if (isAnimating || card.classList.contains('is-window')) {
            console.log('⚠️ Animation in progress or window open, click ignored');
            return;
        }

        if (typeof window.drawCardFromDeck !== 'function') {
            console.error('❌ function window.drawCardFromDeck is not defined! Check if gameclient.js is loaded correctly.');
            alert('Ошибка: клиентская логика не загружена. Проверьте консоль.');
            return;
        }

        const deckId = deck.dataset.deck;

        // ВАЛИДАЦИЯ CLIENT-SIDE: Сначала ход!
        if (window.gameClient && window.gameClient.mustMoveFirst) {
            console.warn('⛔ Сначала нужно сделать ход фигуркой!');
            if (window.showSystemAlert) {
                window.showSystemAlert("Сначала переместите свою фигурку!");
            } else {
                alert("Сначала переместите свою фигурку!");
            }
            return;
        }

        // Валидация на сервере - клиент не блокирует

        try {
            // === НОВОЕ: Деактивировать возможность получения карманных денег ===
            // Если игрок тянет карту, не запросив карманные деньги - он их теряет
            if (window.deactivateMoneyCellClaim) {
                window.deactivateMoneyCellClaim();
            }

            // Просто отправляем запрос, ничего не анимируем пока
            // Анимация запустится когда придет событие 'game:card_drawn'
            await window.drawCardFromDeck(deckId);
        } catch (e) {
            console.error('❌ Error requesting card:', e);
        }
    });
});

/**
 * Функция анимации карты (вызывается из socket события game:card_drawn)
 */
window.animateCardDraw = async function (deckId, cardData, playerName, isMyTurn = false) {
    // ВАЖНО: Не блокируем анимацию для наблюдателей!
    // Только активный игрок имеет право на isAnimating блокировку
    if (isMyTurn && isAnimating) {
        console.warn('⚠️ Animation request ignored: animation already in progress');
        return;
    }

    // Для наблюдателей - принудительно сбрасываем состояние если карточка застряла
    if (!isMyTurn) {
        // Сбрасываем любое застрявшее состояние
        if (card.classList.contains('is-window') || card.classList.contains('is-flying')) {
            console.log('🔄 Resetting stuck card state for observer');
            card.classList.remove('is-window', 'is-flying');
            card.style.opacity = 0;
        }
        isAnimating = false; // Сбрасываем флаг для наблюдателей
    }

    console.log(`🎬 Starting animation for deck ${deckId} (isMyTurn: ${isMyTurn})`);
    const deck = document.querySelector(`.deck[data-deck="${deckId}"]`);
    if (!deck) {
        console.error(`❌ Deck element ${deckId} not found`);
        return;
    }

    // Safety Watchdog: Force reset if stuck (longer timeout for observers)
    const watchdogTimeout = isMyTurn ? 5000 : 10000;
    const watchdog = setTimeout(() => {
        if (isAnimating || card.classList.contains('is-window')) {
            console.error('🚨 Animation timed out! Forcing reset.');
            window.forceHideCard();
        }
    }, watchdogTimeout);

    isAnimating = true;

    try {
        // 1. Подготовка контента
        const titles = {
            '1': 'РАСХОДЫ',
            '2': 'БИЗНЕС',
            '3': 'НОВОСТИ',
            '4': 'ШАНС'
        };

        // Validate elements exist
        if (!cardTitle || !cardText) {
            console.error('❌ Card DOM elements missing');
            return;
        }

        // Use full title from card data if available, otherwise fallback
        if (cardTitle) cardTitle.innerHTML = cardData.title || titles[deckId] || 'КАРТОЧКА';
        else console.warn('Missing cardTitle element');

        // LOGIC: Self vs Others description
        let description = '';

        if (isMyTurn) {
            // Основное описание (Предложение)
            description = cardData.description_self || cardData.text || cardData.description || '...';
        } else {
            // Описание для других игроков
            const nameToUse = playerName || cardData.player_name || 'Игрок';

            if (cardData.description_others) {
                description = cardData.description_others
                    .replace(/{player}/g, nameToUse)
                    .replace(/{Player}/g, nameToUse);
            } else {
                description = cardData.text || cardData.description || '...';
            }
        }

        // ВАЖНО: Результаты (успех/провал) теперь показываются В УВЕДОМЛЕНИЯХ, а не в тексте карты!
        // Поэтому здесь оставляем только описание предложения.
        if (cardText) cardText.innerHTML = description;

        // Доп инфо (только цены, без сообщений - они уже в result)
        let extraInfo = '';
        if (cardData.cost) extraInfo += `Цена: ${cardData.cost}₸ `;
        if (cardData.price) extraInfo += `Цена: ${cardData.price}₸ `;
        if (cardData.income && !resultMessage) extraInfo += `Доход: ${cardData.income}₸ `;

        if (cardExtra) cardExtra.textContent = extraInfo.trim();

        // Скрываем контент пока летит
        if (cardDynamicContent) cardDynamicContent.style.opacity = 0;

        // 2. Анимация полета
        // START POS: На колоде
        if (card && deck) {
            // Считываем координаты колоды (относительно родителя)
            const deckLeft = deck.offsetLeft + (deck.offsetWidth / 2); // Центр колоды
            const deckTop = deck.offsetTop + (deck.offsetHeight / 2);

            // ОТКЛЮЧАЕМ transition для мгновенного переноса
            card.style.transition = 'none';
            card.style.left = `${deckLeft}px`;
            card.style.top = `${deckTop}px`;
            card.style.opacity = 1;

            // Force reflow (чтобы браузер увидел смену позиции)
            void card.offsetWidth;

            // ВКЛЮЧАЕМ transition
            // is-flying меняет transform, а мы еще добавим top/left
            card.style.transition = 'all 1.0s cubic-bezier(0.25, 1, 0.5, 1)';

            // TARGET POS: Центр поля (из CSS .card: left 370px, top 300px)
            // Возвращаем дефолтные значения из CSS файла, или хардкодим центр
            card.style.left = '370px';
            card.style.top = '300px';

            card.classList.add('is-flying');
        }

        // Скрываем саму колоду
        deck.style.opacity = 0;

        await delay(1200);

        // 3. Превращение в окно
        if (card) {
            card.classList.remove('is-flying');
            card.classList.add('is-window');
        }

        // Показываем контент
        if (cardDynamicContent) cardDynamicContent.style.opacity = 1;

        // ВИДИМОСТЬ КНОПКИ ЗАКРЫТЬ
        // Карточка видна ВСЕМ игрокам, но закрыть может только активный игрок
        if (isMyTurn) {
            if (cardCloseBtn) {
                cardCloseBtn.style.display = 'block';
                cardCloseBtn.style.pointerEvents = 'auto';
            }
            if (card) card.style.pointerEvents = 'auto'; // allow interaction
            if (cardDynamicContent) cardDynamicContent.style.pointerEvents = 'auto';
        } else {
            if (cardCloseBtn) {
                cardCloseBtn.style.display = 'none'; // Скрываем кнопку у других
                cardCloseBtn.style.pointerEvents = 'none';
            }
            // Карточка видна, но не кликабельна для закрытия
            if (card) card.style.pointerEvents = 'none'; // prevent closing by others
            // ВАЖНО: Контент ВИДИМ для всех (убираем pointerEvents: none с контента)
            if (cardDynamicContent) cardDynamicContent.style.pointerEvents = 'none';
        }

        // Показываем имя игрока который тянет карту (для наблюдателей)
        if (!isMyTurn && playerName) {
            const playerInfo = document.createElement('div');
            playerInfo.className = 'card-player-info';
            playerInfo.textContent = `${playerName} вытянул карту...`;
            playerInfo.style.cssText = 'text-align: center; color: #ffd700; font-size: 14px; margin-top: 10px;';

            // Добавляем только если ещё нет
            if (cardDynamicContent && !cardDynamicContent.querySelector('.card-player-info')) {
                cardDynamicContent.appendChild(playerInfo);
            }
        }

        // === ДОБАВЛЯЕМ КНОПКИ ПОКУПКИ (Если это выбор покупки) ===
        if (isMyTurn && cardData.isPurchaseChoice) {
            console.log("💰 Showing purchase buttons for:", cardData);

            // Контейнер кнопок (используем cardExtra как базу)
            if (cardExtra) {
                // Очищаем старое (цену мы уже показали текстом или покажем внутри кнопок?)
                // Цену лучше оставить в тексте карточки, а тут только кнопки

                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 15px;';

                // Кнопка КУПИТЬ
                const btnBuy = document.createElement('button');
                btnBuy.textContent = `Купить за ${cardData.purchasePrice}₸`;
                btnBuy.style.cssText = `
                    background: linear-gradient(to bottom, #4CAF50, #2E7D32);
                    color: white; border: none; padding: 10px 20px;
                    border-radius: 5px; cursor: pointer; font-weight: bold;
                    box-shadow: 0 4px 0 #1B5E20; transition: transform 0.1s;
                `;
                btnBuy.onactive = () => { btnBuy.style.transform = 'translateY(4px)'; };

                btnBuy.onclick = () => {
                    console.log("✅ Buying item:", cardData.purchaseName);
                    // Отправляем выбор на сервер
                    if (window.socket) {
                        window.socket.emit('player:purchase_choice', {
                            accept: true,
                            price: cardData.purchasePrice,
                            name: cardData.purchaseName,
                            income: cardData.purchaseIncome,
                            skill: cardData.skillGranted,
                            isAsset: cardData.isAssetPurchase,
                            walletSource: cardData.walletSource
                        }, (res) => {
                            if (res && !res.success) {
                                alert(res.error || "Ошибка покупки");
                            } else {
                                // Успех - закрываем окно (сервер отправит обновление стейта)
                                window.forceHideCard();
                                // И завершаем ход - СЕРВЕР ТЕПЕРЬ САМ ЭТО ДЕЛАЕТ
                                // if (window.finishTurn) window.finishTurn();
                            }
                        });
                    }
                };

                // Кнопка ОТКАЗАТЬСЯ
                const btnDecline = document.createElement('button');
                btnDecline.textContent = "Отказаться";
                btnDecline.style.cssText = `
                    background: linear-gradient(to bottom, #d32f2f, #b71c1c);
                    color: white; border: none; padding: 10px 20px;
                    border-radius: 5px; cursor: pointer; font-weight: bold;
                    box-shadow: 0 4px 0 #7f0000; transition: transform 0.1s;
                `;

                btnDecline.onclick = () => {
                    console.log("❌ Declined item:", cardData.purchaseName);
                    if (window.socket) {
                        window.socket.emit('player:purchase_choice', {
                            accept: false,
                            name: cardData.purchaseName // Для лога
                        }, (res) => {
                            // Закрываем окно
                            window.forceHideCard();
                            // И завершаем ход - СЕРВЕР ТЕПЕРЬ САМ ЭТО ДЕЛАЕТ
                            // if (window.finishTurn) window.finishTurn();
                        });
                    }
                };

                btnContainer.appendChild(btnBuy);
                btnContainer.appendChild(btnDecline);
                cardExtra.appendChild(btnContainer);

                // Скрываем стандартную кнопку "Закрыть", так как выбор обязателен
                if (cardCloseBtn) cardCloseBtn.style.display = 'none';
            }
        }


        // === ДОБАВЛЯЕМ КНОПКИ ПРОДАЖИ (Если это предложение о скупке) ===
        if (isMyTurn && cardData.isSaleChoice) {
            console.log("💰 Showing sale buttons for:", cardData);
            // Контейнер кнопок (используем cardExtra как базу)
            if (cardExtra) {
                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 15px;';

                // Кнопка ПРОДАТЬ
                const btnSell = document.createElement('button');
                btnSell.textContent = `Продать за ${cardData.salePrice}¢`;
                btnSell.style.cssText = `
                    background: linear-gradient(to bottom, #2ecc71, #27ae60);
                    color: white; border: none; padding: 10px 20px;
                    border-radius: 5px; cursor: pointer; font-weight: bold;
                    box-shadow: 0 4px 0 #1e8449; transition: transform 0.1s;
                `;
                btnSell.onactive = () => { btnSell.style.transform = 'translateY(4px)'; };

                btnSell.onclick = () => {
                    console.log("✅ Selling:", cardData.offerAssetName);
                    if (window.socket) {
                        window.socket.emit('player:sale_choice', {
                            accept: true,
                            assetId: cardData.assetId,
                            salePrice: cardData.salePrice
                        }, (res) => {
                            window.forceHideCard();
                            // if (window.finishTurn) window.finishTurn();
                        });
                    }
                };

                // Кнопка ОСТАВИТЬ
                const btnKeep = document.createElement('button');
                btnKeep.textContent = 'Оставить себе';
                btnKeep.style.cssText = `
                    background: #95a5a6; color: white; border: none; padding: 10px 20px;
                    border-radius: 5px; cursor: pointer; font-weight: bold;
                    box-shadow: 0 4px 0 #7f8c8d; transition: transform 0.1s;
                `;

                btnKeep.onclick = () => {
                    console.log("❌ Decided to keep asset");
                    if (window.socket) {
                        window.socket.emit('player:sale_choice', {
                            accept: false
                        }, (res) => {
                            window.forceHideCard();
                            // if (window.finishTurn) window.finishTurn();
                        });
                    }
                };

                btnContainer.appendChild(btnSell);
                btnContainer.appendChild(btnKeep);
                cardExtra.appendChild(btnContainer);

                // Скрываем стандартную кнопку "Закрыть"
                if (cardCloseBtn) cardCloseBtn.style.display = 'none';
            }
        }

        // === ДОБАВЛЯЕМ КНОПКИ БЛАГОТВОРИТЕЛЬНОСТИ ===
        if (isMyTurn && cardData.isCharityChoice) {
            console.log("💝 Showing charity buttons for:", cardData);
            if (cardExtra) {
                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 15px;';

                // Кнопка ПОМОЧЬ
                const btnHelp = document.createElement('button');
                btnHelp.textContent = `Помочь (-${cardData.charityAmount}¢)`;
                btnHelp.style.cssText = `
                    background: linear-gradient(to bottom, #9c27b0, #7b1fa2);
                    color: white; border: none; padding: 10px 20px;
                    border-radius: 5px; cursor: pointer; font-weight: bold;
                    box-shadow: 0 4px 0 #4a148c; transition: transform 0.1s;
                `;
                btnHelp.onclick = () => {
                    if (window.socket) {
                        window.socket.emit('player:charity_choice', {
                            accept: true,
                            amount: cardData.charityAmount
                        }, (res) => {
                            window.forceHideCard();
                            // if (window.finishTurn) window.finishTurn();
                        });
                    }
                };

                // Кнопка ОТКАЗАТЬСЯ
                const btnDecline = document.createElement('button');
                btnDecline.textContent = "Пройти мимо";
                btnDecline.style.cssText = `
                    background: #95a5a6; color: white; border: none; padding: 10px 20px;
                    border-radius: 5px; cursor: pointer; font-weight: bold;
                    box-shadow: 0 4px 0 #7f8c8d; transition: transform 0.1s;
                `;
                btnDecline.onclick = () => {
                    if (window.socket) {
                        window.socket.emit('player:charity_choice', {
                            accept: false
                        }, (res) => {
                            window.forceHideCard();
                            // if (window.finishTurn) window.finishTurn();
                        });
                    }
                };

                btnContainer.appendChild(btnHelp);
                btnContainer.appendChild(btnDecline);
                cardExtra.appendChild(btnContainer);

                if (cardCloseBtn) cardCloseBtn.style.display = 'none';
            }
        }

        // === ИНФОРМАЦИОННАЯ КАРТА (Без выбора: Просто доход, расход или инфо) ===
        if (isMyTurn && !cardData.isPurchaseChoice && !cardData.isSaleChoice && !cardData.isCharityChoice) {
            console.log("ℹ️ Info card, showing OK button");
            if (cardExtra) {
                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display: flex; justify-content: center; margin-top: 15px;';

                const btnOk = document.createElement('button');
                btnOk.textContent = "OK";
                btnOk.style.cssText = `
                   background: #2196F3; color: white; border: none; padding: 10px 40px;
                   border-radius: 5px; cursor: pointer; font-weight: bold;
                   box-shadow: 0 4px 0 #1976D2; transition: transform 0.1s;
                `;
                btnOk.onclick = () => {
                    if (window.socket) {
                        window.socket.emit('player:acknowledge_card', {}, (res) => {
                            window.forceHideCard();
                            // Server handles nextTurn
                        });
                    }
                };

                btnContainer.appendChild(btnOk);
                cardExtra.appendChild(btnContainer);

                // Скрываем крестик, заставляем жать ОК
                if (cardCloseBtn) cardCloseBtn.style.display = 'none';
            }
        }
    } catch (e) {
        console.error("❌ Animation error", e);
        // Force reset immediate in case of error
        window.forceHideCard();
    } finally {
        clearTimeout(watchdog);
        isAnimating = false;
    }
};

// Закрытие окна
if (cardCloseBtn) {
    cardCloseBtn.addEventListener('click', closeCardModal);
}

function closeCardModal() {
    // Only happens if button is visible (so active player)

    // 1. Send signal to close for everyone
    if (window.sendCloseWindowSignal) window.sendCloseWindowSignal();

    // 2. Finish Turn (with delay to ensure close signal processes first on server)
    setTimeout(() => {
        if (window.finishTurn) window.finishTurn();
    }, 500);

    // Hide locally (redundant if server sends close_all_windows, but feels snappier)
    forceHideCard();
}

// Global helper to hide card (called by close_all_windows)
window.forceHideCard = function () {
    card.classList.remove('is-window');
    card.style.pointerEvents = 'none';
    cardDynamicContent.style.pointerEvents = 'none';

    card.style.opacity = 0;
    cardDynamicContent.style.opacity = 0;

    // Сброс позиционирования (чтобы вернуть к CSS дефолту)
    card.style.left = '';
    card.style.top = '';

    isAnimating = false; // Fix: Reset animation flag to unlock UI

    // Удаляем элемент с информацией об игроке (для наблюдателей)
    const playerInfo = cardDynamicContent.querySelector('.card-player-info');
    if (playerInfo) playerInfo.remove();

    // Возвращаем колоды
    decks.forEach(d => d.style.opacity = 1);
}
