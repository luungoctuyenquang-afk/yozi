// 聊天界面模块
const ChatScreen = {
    // 渲染聊天界面
    render() {
        const state = StateManager.get();
        state.activeChatId = 'chat_default';
        const activeChat = state.chats[state.activeChatId];
        
        if (!activeChat || !activeChat.settings || !state.chat) {
            console.error("无法渲染聊天，核心数据丢失");
            return;
        }
        
        const aiNameInTitle = activeChat.settings.aiPersona.split('。')[0]
            .replace("你是AI伴侣'", "").replace("'", "") || state.ai?.name || '零';
        
        const chatHeaderTitle = document.getElementById('chat-header-title');
        if (chatHeaderTitle) chatHeaderTitle.textContent = `与 ${aiNameInTitle} 的聊天`;
        
        const messageContainer = document.getElementById('message-container');
        if (messageContainer) {
            messageContainer.innerHTML = '';
            (state.chat.history || []).forEach(msg => {
                const bubble = document.createElement('div');
                bubble.className = `message-bubble ${msg.sender === 'user' ? 'user-message' : 'ai-message'}`;
                
                const contentWrapper = document.createElement('div');
                const contentParts = Array.isArray(msg.content) ? msg.content : [{ text: String(msg.content || '') }];
                contentParts.forEach(part => {
                    if (part.text && part.text.trim() !== '') {
                        const textNode = document.createElement('div');
                        textNode.textContent = part.text;
                        contentWrapper.appendChild(textNode);
                    } else if (part.inline_data) {
                        const imgNode = document.createElement('img');
                        imgNode.className = 'chat-image';
                        imgNode.src = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                        contentWrapper.appendChild(imgNode);
                    }
                });
                
                if (contentWrapper.hasChildNodes()) {
                    bubble.appendChild(contentWrapper);
                }

                // ▼▼▼ 新增/修改：使用更兼容的HTML结构渲染思维链 ▼▼▼
                if (msg.sender === 'ai' && msg.thoughtText) {
                    const detailsDiv = document.createElement('div');
                    detailsDiv.className = 'thought-details';
                    
                    const summarySpan = document.createElement('span');
                    summarySpan.className = 'thought-summary';
                    summarySpan.textContent = '🤔 查看AI思考过程';
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'thought-content';
                    contentDiv.textContent = msg.thoughtText;
                    contentDiv.style.display = 'none'; // 默认隐藏

                    const toggleThought = () => {
                        const isOpen = detailsDiv.classList.toggle('open');
                        contentDiv.style.display = isOpen ? 'block' : 'none';
                        summarySpan.setAttribute('aria-expanded', isOpen);
                    };

                    summarySpan.onclick = toggleThought;
                    summarySpan.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        toggleThought();
                    });
                    
                    detailsDiv.appendChild(summarySpan);
                    detailsDiv.appendChild(contentDiv);
                    bubble.appendChild(detailsDiv);
                }
                // ▲▲▲ 新增/修改 ▲▲▲

                if (bubble.hasChildNodes()) {
                    messageContainer.appendChild(bubble);
                }
            });
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    },
    
    // 处理发送消息
    async handleSend(userInput) {
        const state = StateManager.get();
        
        const userMessage = {
            sender: 'user',
            content: [{ text: userInput }],
            timestamp: Date.now()
        };
        
        state.chat.history.push(userMessage);
        this.render();
        
        const chatInput = document.getElementById('chat-input');
        if (chatInput) chatInput.value = '';
        
        await Database.saveWorldState();
        
        const aiResponse = await AI.getResponse(userMessage.content);

        let aiReplyText, thoughtText;
        if (typeof aiResponse === 'object' && aiResponse.text) {
            aiReplyText = aiResponse.text;
            thoughtText = aiResponse.thought;
        } else {
            aiReplyText = aiResponse;
            thoughtText = null;
        }

        if (state.session.minutesAway > 0) {
            state.session.minutesAway = 0;
            state.session.moneyEarned = 0;
        }

        const aiMessage = {
            sender: 'ai',
            content: [{ text: aiReplyText }],
            thoughtText: thoughtText, // 保存思维链文本
            timestamp: Date.now()
        };

        state.chat.history.push(aiMessage);
        this.render();
        await Database.saveWorldState();
    },
    
    // 处理图片上传
    async handleImageUpload(file) {
        const state = StateManager.get();
        const chatInput = document.getElementById('chat-input');

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64String = reader.result.split(',')[1];
            const userMessage = {
                sender: 'user',
                content: [
                    { text: chatInput.value.trim() },
                    { inline_data: { mime_type: file.type, data: base64String } }
                ],
                timestamp: Date.now()
            };

            state.chat.history.push(userMessage);
            this.render();
            chatInput.value = '';
            await Database.saveWorldState();

            const aiResponse = await AI.getResponse(userMessage.content);
            
            let aiReplyText, thoughtText;
            if (typeof aiResponse === 'object' && aiResponse.text) {
                aiReplyText = aiResponse.text;
                thoughtText = aiResponse.thought;
            } else {
                aiReplyText = aiResponse;
                thoughtText = null;
            }

            const aiMessage = {
                sender: 'ai',
                content: [{ text: aiReplyText }],
                thoughtText: thoughtText,
                timestamp: Date.now()
            };

            state.chat.history.push(aiMessage);
            this.render();
            await Database.saveWorldState();
        };
    }
};
