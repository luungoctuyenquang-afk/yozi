// 钱包界面模块
const WalletScreen = {
    render() {
        const state = StateManager.get();
        
        const playerMoneyDisplay = document.getElementById('player-money-display');
        const aiMoneyDisplay = document.getElementById('ai-money-display');
        const aiNameWalletDisplay = document.getElementById('ai-name-wallet-display');
        
        if (playerMoneyDisplay) playerMoneyDisplay.textContent = state.player.money;
        if (aiMoneyDisplay) aiMoneyDisplay.textContent = state.ai.money;
        if (aiNameWalletDisplay) aiNameWalletDisplay.textContent = state.ai.name;
    }
};
