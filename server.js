const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 静态文件服务
app.use(express.static('.'));

// 处理单页应用路由 - 所有路由都返回 index.html
app.get('*', (req, res) => {
    // 如果是API请求，返回404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // 其他所有请求都返回 index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 虚拟手机服务器已启动！`);
    console.log(`📱 本地访问: http://localhost:${PORT}`);
    console.log(`📱 局域网访问: http://192.168.1.111:${PORT}`);
    console.log(`📱 其他设备访问: http://10.37.154.138:${PORT}`);
    console.log(`\n💡 提示:`);
    console.log(`   - 在浏览器中打开 http://localhost:${PORT} 即可使用`);
    console.log(`   - 手机等设备可通过局域网IP访问`);
    console.log(`   - 如果VPN影响访问，请尝试关闭VPN后重试`);
    console.log(`   - 按 Ctrl+C 停止服务器`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n👋 正在关闭服务器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 正在关闭服务器...');
    process.exit(0);
});
