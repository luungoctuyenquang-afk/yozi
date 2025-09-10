// 安装为Windows服务的脚本（需要管理员权限运行）
const { exec } = require('child_process');
const path = require('path');

const serviceName = 'VirtualPhoneServer';
const serviceDescription = '虚拟手机应用服务器';
const projectPath = path.join(__dirname);
const nodePath = process.execPath;
const scriptPath = path.join(projectPath, 'server.js');

const installCommand = `sc create "${serviceName}" binPath= "\"${nodePath}\" \"${scriptPath}\"" DisplayName= "${serviceDescription}" start= auto`;

console.log('正在安装Windows服务...');
console.log('命令:', installCommand);

exec(installCommand, (error, stdout, stderr) => {
    if (error) {
        console.error('安装失败:', error);
        console.log('请以管理员身份运行此脚本');
        return;
    }
    
    console.log('服务安装成功！');
    console.log('服务名称:', serviceName);
    console.log('启动服务命令: sc start', serviceName);
    console.log('停止服务命令: sc stop', serviceName);
    console.log('删除服务命令: sc delete', serviceName);
});
