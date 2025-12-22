const cardService = require('../../services/CardService');
const cellsData = require('../../data/cells.json');

/**
 * Менеджер Логики Клеток (CellManager)
 * Отвечает за:
 * - Обработку попадания на клетку (Event processing)
 * - Применение эффектов (pay, skip_turn, etc.)
 * - Работу с карточками (Draw Card)
 * - Логика "Мечты" (купить свою или чужую)
 * - Навыки (Skills)
 */
class CellManager {
    constructor(gameState) {
        this.gameState = gameState;
    }

    /**
     * Обработать попадание на клетку
     * @param {string} playerId
     * @param {string} cellKey - ID клетки (например 'cell-13')
     */
    handleCell(playerId, cellKey) {
        const player = this.gameState.players[playerId];
        const board = require('../../board'); // Подгружаем доску
        const cell = board[cellKey];

        let result = {
            cellId: cellKey,
            cellType: cell.type,
            cellName: cell.name,
            action: null,
            card: null,
            moneyChange: 0
        };

        // === ПРИОРИТЕТ 1: Сложные клетки из cells.json ===
        const cellIdNum = cellKey.replace('cell-', '');
        const complexData = cellsData[cellIdNum];

        if (complexData) {
            return this.handleComplexCell(playerId, complexData, result);
        }

        // === ПРИОРИТЕТ 2: Стандартные типы клеток ===
        switch (cell.type) {
            case 'money':
                // Клетка ДЕНЬГИ -> Сбор дохода
                // Используем FinanceManager для сбора
                const totalBusinessIncome = this.gameState.financeManager.collectBusinessIncome(playerId);
                result.action = 'monthly_income';
                result.moneyChange = totalBusinessIncome;
                result.message = totalBusinessIncome > 0
                    ? `💰 Получен доход: ${totalBusinessIncome} монет`
                    : `📭 Нет активных бизнесов - доход 0`;

                this.gameState.nextTurn();
                break;

            case 'chance':
            case 'news':
            case 'expenses':
            case 'kidsBusiness':
                // Карточки
                const cardType = this.mapCellTypeToCardType(cell.type);
                result.action = 'draw_card';
                result.cardType = cardType;
                // Карточку тянет клиент отдельным запросом или тут же?
                // В GameState.js: result.card НЕ заполняем - карточка будет вытянута по клику
                break;

            case 'charity':
                // Благотворительность
                if (player.charityDonationsMade > 0) {
                    player.doubleDiceTurnsRemaining = 3;
                    player.charityDonationsMade = 0;
                    result.action = 'charity_bonus';
                    result.message = '💝 Бонус: 3 хода с двумя кубиками!';

                    this.gameState.addToHistory({
                        action: 'charity_bonus_granted',
                        actorId: playerId,
                        actorName: player.displayName,
                        details: { message: 'Получен бонус благотворительности' }
                    });
                } else {
                    result.action = 'charity_no_bonus';
                    result.message = 'Вы не делали пожертвований.';
                }
                this.gameState.nextTurn();
                break;

            case 'fork':
                result.action = 'choose_path';
                result.paths = cell.next;
                break;

            default:
                // Проверка на Мечту (Dream)
                if (cellKey.includes('dream') || (cell.type && cell.type.startsWith('dream'))) {
                    const dreamResult = this.handleDreamCell(playerId, cell);
                    if (dreamResult) {
                        Object.assign(result, dreamResult);
                    } else {
                        result.action = 'dream_check';
                    }
                } else {
                    // Пустая клетка
                    result.action = 'none';
                    this.gameState.nextTurn();
                }
        }

        return result;
    }

    /**
     * Обработка сложных клеток (Директор, Хулиганы...)
     */
    handleComplexCell(playerId, complexData, result) {
        const player = this.gameState.players[playerId];

        this.gameState.addToHistory({
            action: 'complex_cell_visit',
            actorId: playerId,
            actorName: player.displayName,
            details: { title: complexData.title, message: complexData.description_self }
        });

        // Заполняем результат для клиента
        result.title = complexData.title;
        result.description = complexData.description_self;
        result.description_others = complexData.description_others;
        result.image = complexData.image || null;

        if (complexData.action === 'choice') {
            result.action = 'choice';
            result.options = complexData.options;
            // NEXT TURN НЕ вызываем, ждем выбора
        } else if (complexData.action === 'multi_effect') {
            result.action = 'multi_effect';
            result.effects = complexData.effects;
            this.processComplexEffect(playerId, complexData);
            this.gameState.nextTurn();
        } else {
            // Простой эффект (pay, skip_turn)
            result.action = complexData.action;
            result.value = complexData.value;
            this.processComplexEffect(playerId, complexData);
            this.gameState.nextTurn();
        }

        return result;
    }

    /**
     * Применение эффектов (pay, skip_turn, block_income)
     */
    processComplexEffect(playerId, data) {
        const effects = data.effects || [data];

        effects.forEach(effect => {
            if (effect.action === 'pay' || effect.action === 'pay_percent') {
                // Передаем в applyEffect (который внутри использует FinanceManager)
                this.applyEffect(playerId, effect.action, effect.value, effect);
            } else if (effect.action === 'pay_from_savings') {
                this.applyEffect(playerId, 'pay_from_savings', effect.value, effect);
            } else {
                this.applyEffect(playerId, effect.action, effect.value, effect);
            }
        });
    }

    /**
     * Общий метод применения эффекта
     */
    applyEffect(playerId, action, value, options = {}) {
        const player = this.gameState.players[playerId];
        const finance = this.gameState.financeManager;

        switch (action) {
            case 'pay':
                if (typeof value === 'string' && value.includes('%')) {
                    this.applyEffect(playerId, 'pay_percent', value, options);
                    return;
                }
                finance.spendFromWallets(playerId, Number(value), {
                    forCharity: options.forCharity,
                    forDream: options.forDream
                });
                break;

            case 'pay_percent':
                const autoFinance = this.gameState.autoFinanceCards[playerId];
                const totalCash = Object.values(autoFinance.calculatedWallets).reduce((a, b) => a + b, 0);
                const percent = parseInt(value);
                const amount = Math.round(totalCash * (percent / 100));
                finance.applyMoneyChange(playerId, -amount, {}, 'Потеря процента денег');
                break;

            case 'pay_from_savings':
                finance.applyMoneyChange(playerId, -Number(value), { savings: -Number(value) }, 'Списание со сбережений');
                break;

            case 'skip_turn':
                player.status.skippedTurns += Number(value);
                break;

            case 'block_income':
                player.status.incomeBlockedTurns += Number(value);
                break;

            case 'multi_effect':
                const effects = options.effects || (Array.isArray(value) ? value : []);
                effects.forEach(e => this.applyEffect(playerId, e.action, e.value, { ...options, ...e }));
                break;
        }

        this.gameState.addToHistory({
            action: 'effect_applied',
            actorId: playerId,
            actorName: player.displayName,
            details: { action, value, message: `Эффект: ${action}` }
        });
    }

    /**
     * Обработка клетки МЕЧТА
     */
    handleDreamCell(playerId, cell) {
        const player = this.gameState.players[playerId];
        if (!player.dream) {
            this.gameState.nextTurn();
            return null; // Нет мечты
        }

        const autoFinance = this.gameState.autoFinanceCards[playerId];
        const price = cell.price || 0;

        // Это моя мечта?
        const isMyDream = (cell.type === player.dream.id) || (cell.type === 'dreamDisneyland');

        if (isMyDream) {
            // ЛОГИКА: Покупка СВОЕЙ мечты
            const dreamWallet = autoFinance.calculatedWallets.dream || 0;

            if (dreamWallet >= price) {
                // Покупаем!
                this.gameState.financeManager.applyMoneyChange(playerId, -price, { dream: -price }, 'Покупка Мечты');
                player.assets.dream = cell.name;

                this.gameState.io.emit('game:notification', {
                    title: 'МЕЧТА ИСПОЛНЕНА!',
                    message: `${player.displayName} исполнил свою мечту: ${cell.name}!`,
                    type: 'success'
                });
            } else {
                // Не хватает
                // Просто уведомление
            }
            this.gameState.nextTurn();
            return null;

        } else {
            // ЛОГИКА: ЧУЖАЯ мечта -> Покупка как товар (актив)
            const investmentsWallet = autoFinance.calculatedWallets.investments || 0;

            if (investmentsWallet >= price) {
                // Предлагаем купить
                const cleanName = cell.name.replace(/^Мечта\s+/i, '');
                const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

                return {
                    action: 'offer_buy_dream_item',
                    price: price,
                    name: capitalizedName,
                    walletSource: 'investments',
                    isAsset: true
                };
            } else {
                this.gameState.nextTurn();
                return { action: 'dream_check_fail', message: 'Не хватает инвестиций' };
            }
        }
    }

    /**
     * Вытянуть карту (через CardService)
     */
    drawCard(playerId, cardType) {
        const card = cardService.drawCard(this.gameState.decks, cardType);
        if (!card) return null;

        const player = this.gameState.players[playerId];

        // Применяем эффект карты
        // CardService.applyCardEffect ожидает gameState
        const effects = cardService.applyCardEffect(card, player, this.gameState);

        // === ВАЖНО: Обработка Навыков (Skills) в Новостях ===
        if (effects.requiresSkill) {
            if (cardType === 'news') {
                // Новость влияет на всех, у кого есть навык
                const skillName = this.getSkillDisplayName(effects.requiresSkill);
                Object.keys(this.gameState.players).forEach(pid => {
                    if (this.hasSkill(pid, effects.requiresSkill)) {
                        this.gameState.financeManager.applyMoneyChange(pid, effects.moneyChange, { investments: effects.moneyChange }, `Награда за навык ${skillName}`);
                    }
                });
                effects.newsAffectedAll = true; // Флаг, что обработали всех
                effects.moneyChange = 0; // Сбрасываем для текущего, чтобы не начислили дважды
            } else {
                // Индив. карточка
                if (!this.hasSkill(playerId, effects.requiresSkill)) {
                    effects.moneyChange = 0;
                    effects.skillCheckFailed = true;
                    effects.message = `❌ У вас нет навыка "${this.getSkillDisplayName(effects.requiresSkill)}". Доход не зачислен!`;
                }
            }
        }

        // Продажа актива (News)
        if (card.offer_asset_name) {
            const hasAsset = player.assets.items.find(i => i.name.toLowerCase().includes(card.offer_asset_name.toLowerCase()));
            if (hasAsset) {
                effects.isSaleChoice = true;
                effects.moneyChange = 0; // Не начисляем сразу
            } else {
                effects.moneyChange = 0;
                effects.skillCheckFailed = true;
            }
        }

        // Обновляем финансы если это просто деньги (и не отмена)
        if (effects.moneyChange !== 0 && !effects.skillCheckFailed && !effects.newsAffectedAll && !effects.isCharityAction) {
            const desc = card.description_self || card.title || 'Событие';
            this.gameState.financeManager.applyMoneyChange(playerId, effects.moneyChange, effects.walletChanges, desc);
        }

        // Добавление навыка
        if (effects.skillGranted) {
            const added = this.addSkill(playerId, effects.skillGranted);
            if (added) {
                effects.message = `${effects.message} 📚 Получен навык: ${this.getSkillDisplayName(effects.skillGranted)}!`;
            } else {
                effects.message = `${effects.message} (Навык уже был получен ранее)`;
            }
        }

        // Запись в историю
        this.gameState.addToHistory({
            action: 'card_drawn',
            actorId: playerId,
            actorName: player.displayName,
            details: {
                cardType,
                cardId: card.id,
                message: effects.message
            }
        });

        // Обновляем объект карты для клиента
        card.message = effects.message;
        card.moneyChange = effects.moneyChange;

        // ... (перенос флагов isSaleChoice, isPurchaseChoice и т.д.)
        if (effects.isPurchaseChoice) card.isPurchaseChoice = true;
        if (effects.isSaleChoice) card.isSaleChoice = true;

        return card;
    }

    addSkill(playerId, skillName) {
        const player = this.gameState.players[playerId];
        if (!player.assets.skills.includes(skillName)) {
            player.assets.skills.push(skillName);
            return true;
        }
        return false;
    }

    hasSkill(playerId, skillName) {
        return this.gameState.players[playerId].assets.skills.includes(skillName);
    }

    getSkillDisplayName(skillId) {
        const skillNames = {
            'translator_german': 'Переводчик (Немецкий)',
            'translator_french': 'Переводчик (Французский)',
            'translator_chinese': 'Переводчик (Китайский)',
            'translator_english': 'Переводчик (Английский)',
            'computer_repair': 'Ремонт компьютеров',
            'designer': 'Дизайнер',
            'smm': 'SMM-специалист',
            'web_designer': 'Веб-дизайнер',
            // Добавьте другие навыки по мере необходимости
        };
        return skillNames[skillId] || skillId;
    }

    mapCellTypeToCardType(cellType) {
        const mapping = {
            'chance': 'chance',
            'news': 'news',
            'expenses': 'expenses',
            'kidsBusiness': 'business'
        };
        return mapping[cellType] || 'chance';
    }
}

module.exports = CellManager;
