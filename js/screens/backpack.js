// 背包界面模块
const BackpackScreen = {
    render() {
        const state = StateManager.get();
        const inventoryListContainer = document.getElementById('inventory-list');
        if (!inventoryListContainer) return;
        
        inventoryListContainer.innerHTML = '';
        if (state.player.inventory.length === 0) {
            inventoryListContainer.innerHTML = '<div class="inventory-empty-msg">背包是空的</div>';
            return;
        }
        
        state.player.inventory.forEach(itemName => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            const effect = CONFIG.itemEffects[itemName];
            const description = effect ? effect.description : '一个普通的物品。';
            itemDiv.innerHTML = `
                <div>
                    <div style="font-weight: bold;">${itemName}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">${description}</div>
                </div>
                <button class="use-btn" data-item-name="${itemName}">使用</button>
            `;
            inventoryListContainer.appendChild(itemDiv);
        });
    },
    
  async useItem(itemName) {
        const state = StateManager.get();
        const effect = CONFIG.itemEffects[itemName];
        if (!effect) {
            alert('这个物品暂时无法使用。');
            return;
        }
        
        // 从背包移除物品
        state.player.inventory = state.player.inventory.filter(item => item !== itemName);
        
        // 执行物品效果（现在是异步的）
        const result = await effect.effect(state);
        
        // 渲染界面
        this.render();
        alert(result);
    }
};
