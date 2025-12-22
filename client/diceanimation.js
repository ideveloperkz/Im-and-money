class DiceGame {
    constructor() {
        this.dice = document.querySelector('.dice');
        this.rollBtn = document.querySelector('.roll-btn');
        this.modal = document.getElementById('diceResultModal');
        this.modalText = document.getElementById('diceResultText');
        this.modalBtn = document.getElementById('diceResultOk');

        this.isRolling = false;

        if (this.rollBtn) {
            this.rollBtn.addEventListener('click', () => {
                if (window.requestDiceRoll) {
                    window.requestDiceRoll();
                } else {
                    console.error('requestDiceRoll not found');
                }
            });
        }

        if (this.modalBtn) {
            this.modalBtn.addEventListener('click', () => this.closeModal());
            // Touch support for mobile
            this.modalBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.closeModal();
            }, { passive: false });
        }
    }

    showDiceAnimation(result, isMyTurn = false, prediction = null) {
        if (this.isRolling) {
            console.warn('⚠️ Dice already rolling, ignoring request');
            return;
        }

        if (!this.dice) {
            console.error('❌ Dice element not found');
            // Fallback: show result immediately if dice is missing
            this.showResult(result);
            return;
        }

        this.isRolling = true;
        this.isMyTurn = isMyTurn; // Store for showResult
        this.currentPrediction = prediction; // Store prediction

        // Hide button during roll if desired, or just disable
        if (this.rollBtn) this.rollBtn.style.pointerEvents = 'none';

        // Result passed from server
        // Calculate rotation to show the correct face
        let rotateX = 0;
        let rotateY = 0;

        // Add extra rotations for animation effect (at least 2 full spins)
        const spins = 2;
        const baseRotate = spins * 360;

        switch (result) {
            case 1: rotateX = 0; rotateY = 0; break;
            case 6: rotateX = 180; rotateY = 0; break;
            case 2: rotateX = 0; rotateY = -90; break;
            case 5: rotateX = 0; rotateY = 90; break;
            case 3: rotateX = -90; rotateY = 0; break;
            case 4: rotateX = 90; rotateY = 0; break;
        }

        this.dice.style.transition = 'transform 2s cubic-bezier(0.1, 0.9, 0.2, 1)';
        this.dice.style.transform = `rotateX(${baseRotate + rotateX}deg) rotateY(${baseRotate + rotateY}deg)`;

        // Wait for animation to finish
        // Используем arrow function и сохраняем ID таймера (хотя тут он локальный, но для чистоты)
        setTimeout(() => {
            this.isRolling = false;
            if (this.rollBtn) {
                // Do not force pointerEvents auto, let disabled state control it/server update
                // But strictly speaking, we accept inputs now? No, wait for modal close.
            }
            this.showResult(result);
        }, 2000);
    }

    showResult(result) {
        this.modalText.textContent = `Выпало ${result}. ${this.isMyTurn ? 'Сделайте ход и нажмите на колоду!' : 'Игрок делает ход...'}`;

        // Hide button if not my turn
        if (this.modalBtn) {
            if (this.isMyTurn) {
                this.modalBtn.style.display = 'block';
            } else {
                this.modalBtn.style.display = 'none';
            }
        }

        this.modal.classList.add('show');

        // Store result for player movement
        this.currentResult = result;

        if (this.isMyTurn && window.gameClient) {
            window.gameClient.mustMoveFirst = true;
            console.log('🔒 Decks locked: must move figure first');
        }
    }

    closeModal() {
        this.modal.classList.remove('show');

        // If my turn, I control the close for everyone
        if (this.isMyTurn) {
            if (window.sendCloseWindowSignal) {
                window.sendCloseWindowSignal();
            }
        }

        // Trigger player movement logic
        if (this.isMyTurn && window.PlayerGameInstance) {
            window.PlayerGameInstance.enableMove(this.currentResult, this.currentPrediction);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.DiceGameInstance = new DiceGame();
});
