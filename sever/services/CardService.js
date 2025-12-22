const fs = require('fs');
const path = require('path');

/**
 * Сервис для работы с игровыми карточками
 * Загружает карточки из JSON файлов и предоставляет методы для работы с ними
 */
class CardService {
    constructor() {
        this.cards = {
            news: [],
            chance: [],
            expenses: [],
            business: []
        };
        this.loadCards();
    }

    /**
     * Загрузить все карточки из JSON файлов
     */
    loadCards() {
        const cardsPath = path.join(__dirname, '../data/cards');

        try {
            this.cards.news = this.loadCardFile(path.join(cardsPath, 'news.json'));
            this.cards.chance = this.loadCardFile(path.join(cardsPath, 'chance.json'));
            this.cards.expenses = this.loadCardFile(path.join(cardsPath, 'expenses.json'));
            this.cards.business = this.loadCardFile(path.join(cardsPath, 'business.json'));

            console.log('✅ Карточки загружены:');
            console.log(`   - Новости: ${this.cards.news.length}`);
            console.log(`   - Шанс: ${this.cards.chance.length}`);
            console.log(`   - Расходы: ${this.cards.expenses.length}`);
            console.log(`   - Бизнес: ${this.cards.business.length}`);
        } catch (error) {
            console.error('❌ Ошибка загрузки карточек:', error.message);
        }
    }

    /**
     * Загрузить карточки из JSON файла
     */
    loadCardFile(filePath) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const cards = JSON.parse(data);

            // Если это массив, вернуть как есть
            if (Array.isArray(cards)) {
                return cards;
            }

            // Если это объект с массивом карточек
            if (cards.cards && Array.isArray(cards.cards)) {
                return cards.cards;
            }

            return [];
        } catch (error) {
            console.error(`❌ Ошибка чтения файла ${filePath}:`, error.message);
            return [];
        }
    }

    /**
     * Перемешать колоду карточек (Fisher-Yates shuffle)
     */
    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Создать перемешанные колоды для новой игры
     */
    createGameDecks() {
        return {
            news: this.shuffleDeck(this.cards.news),
            chance: this.shuffleDeck(this.cards.chance),
            expenses: this.shuffleDeck(this.cards.expenses),
            business: this.shuffleDeck(this.cards.business)
        };
    }

    /**
     * Вытянуть карточку из колоды
     */
    drawCard(deck, cardType) {
        if (!deck || !deck[cardType] || deck[cardType].length === 0) {
            console.warn(`⚠️ Колода ${cardType} пуста, перемешиваем заново`);
            // Если колода пуста, создаем новую перемешанную
            deck[cardType] = this.shuffleDeck(this.cards[cardType]);
        }

        return deck[cardType].shift(); // Берем первую карточку
    }

    /**
     * Интерполяция сообщения с параметрами
     */
    interpolateMessage(template, params) {
        if (!template) return '';
        let message = template;
        Object.keys(params).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            message = message.replace(regex, params[key]);
        });
        return message;
    }

    /**
     * Применить эффект карточки к игроку
     */
    applyCardEffect(card, playerState, gameState) {
        const effects = {
            moneyChange: 0,
            walletChanges: {},
            businessAdded: null,
            skillAdded: null,
            message: '',
            messages: card.messages || {}, // Прокидываем все сообщения для дальнейшего использования
        };

        // Базовые параметры для интерполяции
        const params = {
            Player: playerState ? playerState.displayName : 'Игрок',
            CardName: card.name || card.title || 'Карточка',
            Amount: Math.abs(card.value || card.price || 0),
            Income: card.income || 0
        };

        // === ГЛАВНАЯ ЛОГИКА: Читаем action и value из JSON ===
        const action = card.action;
        const value = card.value || 0;

        // Действие "money" = получить деньги (доход)
        if (action === 'money') {
            effects.moneyChange = value;
            params.Amount = value;
            // Используем шаблон из JSON или дефолтный
            const template = card.messages?.msg_success || `${card.description_self || card.title}. Получено: {Amount} соляров`;
            effects.message = this.interpolateMessage(template, params);
            // Логирование тоже можно брать из шаблона, но пока оставим console.log простым
            console.log(`💰 Карточка: +${value} соляров`);
        }

        // Действие "pay" = заплатить (расход)
        if (action === 'pay') {
            const amount = value < 0 ? value : -value;
            effects.moneyChange = amount;
            effects.walletChanges.savings = amount; // Расходы из Сбережений

            params.Amount = Math.abs(amount);
            const template = card.messages?.msg_success || `${card.description_self || card.title}. Расход: {Amount} соляров`;
            effects.message = this.interpolateMessage(template, params);

            console.log(`💸 Карточка: ${amount} соляров`);
        }

        // Действие "lend" = дать в долг
        if (action === 'lend') {
            const amount = value < 0 ? value : -value;
            effects.moneyChange = amount;
            effects.walletChanges.savings = amount;

            params.Amount = Math.abs(amount);
            const template = card.messages?.msg_success || `${card.description_self || card.title}. Одолжено: {Amount} соляров`;
            effects.message = this.interpolateMessage(template, params);

            console.log(`🤝 Карточка: одолжено ${Math.abs(amount)} соляров`);
        }

        // Действие "buy_business" = покупка бизнеса/курса
        if (action === 'buy_business') {
            effects.isPurchaseChoice = true;
            effects.purchasePrice = card.price || 0;
            effects.purchaseName = card.name || card.title;
            effects.purchaseIncome = card.income || 0;
            effects.skillGranted = card.skill || null;

            // Обновляем параметры для конкретного действия
            params.Amount = card.price || 0;
            params.Income = card.income || 0;

            // Сообщение теперь формируется чисто из JSON, но добавляем "Хотите приобрести?" если это выбор
            // В JSON уже должно быть поле description_self как вопрос или утверждение
            // Но для UI диалога нам нужно описание.
            // Обычно в UI показывается description_self + кнопки.
            // Если есть msg_success - это сообщение ПОСЛЕ покупки.
            // Здесь мы готовим описание для ДИАЛОГА.
            effects.message = card.description_self || `${card.title}. Цена: ${card.price}₴. Хотите приобрести?`;

            effects.moneyChange = 0;
            effects.awaitingPurchaseChoice = true;
            console.log(`🏪 Карточка бизнес/курс: ${card.name || card.title} за ${card.price}₴`);
        }

        // Действие "get_income" = получить доход
        if (action === 'get_income' && !card.requires_skill) {
            const income = card.income || 0;
            effects.moneyChange = income;
            params.Amount = income;

            const template = card.messages?.msg_success || `${card.description_self || card.title}. Доход: {Amount}₴`;
            effects.message = this.interpolateMessage(template, params);

            console.log(`💵 Карточка: доход ${income}₴`);
        }

        // Действие "purchase" = покупка АКТИВА
        if (action === 'purchase') {
            effects.isPurchaseChoice = true;
            effects.isAssetPurchase = true;
            effects.purchasePrice = card.price || 0;
            effects.purchaseName = card.name || card.title;
            effects.purchaseIncome = 0;

            params.Amount = card.price || 0;

            effects.message = card.description_self || `${card.title}. Цена: ${card.price}₴. Хотите купить?`;

            effects.moneyChange = 0;
            effects.awaitingPurchaseChoice = true;
            console.log(`📦 Карточка актив: ${card.name || card.title} за ${card.price}₴`);
        }

        // Действие "buff" = бафф
        if (action === 'buff' && card.buff) {
            effects.buff = card.buff;
            const template = card.messages?.msg_success || card.description_self || card.title;
            effects.message = this.interpolateMessage(template, params);
            console.log(`✨ Карточка: бафф ${card.buff.type}`);
        }

        // Действие "notification" = уведомление
        if (action === 'notification') {
            const template = card.messages?.msg_success || card.description_self || card.title;
            effects.message = this.interpolateMessage(template, params);
            console.log(`📢 Карточка: уведомление`);
        }

        // Действие "charity_choice" = пожертвование
        if (action === 'charity_choice') {
            effects.isCharityChoice = true;
            effects.charityAmount = Math.abs(card.value) || 0;
            params.Amount = effects.charityAmount;

            effects.message = card.description_self || `${card.title}. Пожертвовать {Amount}₴?`;

            effects.moneyChange = 0;
            effects.awaitingCharityChoice = true;
            console.log(`💝 Благотворительность выбор: ${effects.charityAmount}₴`);
        }

        // Действие "offer_asset" = предложение продать актив
        if (action === 'offer_asset') {
            effects.isSaleChoice = true;
            effects.offerAssetName = card.offer_asset_name || card.name;
            effects.salePrice = card.price || card.amount || 0;
            params.Amount = effects.salePrice;

            if (playerState && playerState.assets && playerState.assets.items) {
                const asset = playerState.assets.items.find(a => a.name === effects.offerAssetName);
                if (asset) effects.assetId = asset.id;
            }

            effects.message = card.description_self || `${card.title}. Цена продажи: {Amount}₴.`;

            effects.moneyChange = 0;
            effects.awaitingSaleChoice = true;
            console.log(`💰 Предложение о выкупе: ${effects.offerAssetName}`);
        }

        // Автоматическая благотворительность
        if (card.is_charity || card.is_charity_donation) {
            effects.isCharityAction = true;
            console.log(`💝 Авто-благотворительность`);
        }

        // Навыки (получение)
        if (card.skill) {
            effects.skillGranted = card.skill;
            // Сообщение обычно уже сформировано в buy_business, но если отдельно:
            if (!effects.message) {
                const template = card.messages?.msg_success || `${card.description_self || card.title}. Вы получили навык!`;
                effects.message = this.interpolateMessage(template, params);
            }
        }

        // Навыки (требование)
        if (card.requires_skill) {
            effects.requiresSkill = card.requires_skill;
            // Сообщение будет сформировано в GameState, так как там проверяется наличие навыка
        }

        // FALLBACK
        if (!action) {
            if (card.income || card.money) {
                const amount = card.income || card.money;
                effects.moneyChange = amount;
                effects.walletChanges.investments = amount;
                params.Amount = amount;
                // Try JSON message or default
                const template = card.messages?.msg_success || `Доход {Amount} соляров`;
                effects.message = this.interpolateMessage(template, params);
            }
            if (card.cost) {
                const cost = card.cost;
                effects.moneyChange = -cost;
                params.Amount = cost;
                const template = card.messages?.msg_success || `Расход {Amount} соляров`;
                effects.message = this.interpolateMessage(template, params);
            }
        }

        // Бизнес карточка (старый формат?)
        if (card.type === 'business' || card.cardType === 'business') {
            effects.businessAdded = {
                id: card.id,
                name: card.name || card.title,
                purchasePrice: card.price || card.cost || 0,
                monthlyIncome: card.cashflow || card.income || 0,
                description: card.description || card.text
            };
            effects.message = `Доступен бизнес: ${effects.businessAdded.name}`;
        }

        // Если сообщение так и не сформировано
        if (!effects.message) {
            effects.message = card.description_self || card.text || card.title || 'Карточка применена';
        }

        return effects;
    }

    /**
     * Получить информацию о карточке по ID
     */
    getCardById(cardType, cardId) {
        const deck = this.cards[cardType];
        if (!deck) return null;

        return deck.find(card => card.id === cardId);
    }
}

module.exports = new CardService();
