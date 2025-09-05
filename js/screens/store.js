// 商店界面模块
const StoreScreen = {
    render() {
        const state = StateManager.get();
        const storePlayerMoneyDisplay = document.getElementById('store-player-money-display');
        if (storePlayerMoneyDisplay) storePlayerMoneyDisplay.textContent = state.player.money;
        
        const itemListContainer = document.getElementById('item-list');
        if (!itemListContainer) return;
        
        itemListContainer.innerHTML = '';
        CONFIG.storeItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <h3>${item.name}</h3>
                <p>${item.price} 金币</p>
                <button class="buy-btn" data-item-id="${item.id}">购买</button>
            `;
            itemListContainer.appendChild(card);
        });
    },
    
    async buyItem(itemId) {
        const state = StateManager.get();
        const item = CONFIG.storeItems.find(i => i.id === itemId);
        if (!item) return;
        
        if (state.player.money >= item.price) {
            state.player.money -= item.price;
            state.player.inventory.push(item.name);
            await Database.saveWorldState();
            this.render();
            alert(`成功购买了 ${item.name}！`);
        } else {
            alert('金币不足！');
        }
    }
};
