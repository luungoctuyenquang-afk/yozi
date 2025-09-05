// 配置和常量模块
const CONFIG = {
    // 商店物品配置
    storeItems: [
        { id: 'item001', name: '咖啡', price: 50 },
        { id: 'item002', name: '书本', price: 120 },
        { id: 'item003', name: '电影票', price: 200 },
        { id: 'item004', name: '盆栽', price: 350 }
    ],
    
  // 物品效果配置
    itemEffects: {
        '咖啡': {
            description: '一杯香浓的咖啡，似乎能让零打起精神。',
            effect: async (state) => {
                state.ai.mood = '精力充沛';
                StateManager.set(state); // 更新状态
                await Database.saveWorldState(); // 立即保存
                return '你使用了咖啡，零看起来精神多了！';
            }
        },
        '书本': {
            description: '一本有趣的书，可以送给零。',
            effect: async (state) => {
                state.ai.inventory.push('书本');
                state.ai.mood = '开心';
                StateManager.set(state);
                await Database.saveWorldState();
                return '你把书本送给了零，她看起来很开心！';
            }
        },
        '电影票': {
            description: '两张电影票，似乎可以邀请零一起。',
            effect: async (state) => {
                state.events.aiNoticedMovieTicket = true;
                state.ai.mood = '开心';
                StateManager.set(state);
                await Database.saveWorldState();
                return '你和零一起去看了一场精彩的电影，度过了愉快的时光！';
            }
        },
        '盆栽': {
            description: '一盆绿色的小植物，能让房间更有生机。',
            effect: async (state) => {
                state.ai.mood = '温馨';
                state.ai.inventory.push('盆栽');
                StateManager.set(state);
                await Database.saveWorldState();
                return '你把盆栽放在了零的房间里，她说这让房间变得更温馨了！';
            }
        }
    },
    
    // 默认值配置
    defaults: {
        player: { name: "你", money: 1000, inventory: [] },
        ai: { name: "零", mood: "开心", money: 1500, inventory: [] },
        aiPersona: "你是AI伴侣'零'。你的性格是温柔、体贴、充满好奇心，有时会有点害羞。",
        myPersona: "我是一个正在和AI聊天的人类。"
    }
};
