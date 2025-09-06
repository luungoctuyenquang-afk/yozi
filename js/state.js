// 全局状态管理模块
let worldState = {};

// 状态管理函数
const StateManager = {
    // 获取状态
    get() {
        return worldState;
    },
    
    // 设置状态
    set(newState) {
        worldState = newState;
    },
    
    // 更新部分状态
    update(path, value) {
        const keys = path.split('.');
        let current = worldState;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current[keys[i]] === undefined) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }
};