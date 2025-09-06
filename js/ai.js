// AI模块
const AI = {
    // 获取AI响应
    async getResponse(messageContent) {
        const state = StateManager.get();
        const activePresetId = state.apiConfig.activePresetId;
        const config = state.apiConfig.presets.find(p => p.id === activePresetId);
        
        if (!config || !config.apiKey || !config.model) {
            return '（系统提示：请在"API设置"里选择一个有效的API预设并填入密钥和模型。）';
        }
        
        const activeChat = state.chats[state.activeChatId];
        if (!activeChat) return '（系统错误：找不到聊天信息。）';
        
        let apiUrl, requestBody, headers;
        const recentHistory = this.buildMultimodalHistory(
            state.chat.history.slice(-10), 
            config.provider
        );
        
        if (config.provider === 'gemini') {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
            headers = { 'Content-Type': 'application/json' };
            const geminiContents = [...recentHistory, { role: 'user', parts: messageContent }];
            requestBody = {
                contents: geminiContents,
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            };
        } else {
            apiUrl = config.endpoint;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            };
            const messages = this.buildOpenAiMessages(messageContent, activeChat, recentHistory);
            requestBody = { model: config.model, messages: messages };
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API 请求失败: ${errorData.error?.message || response.status}`);
            }
            
            const data = await response.json();
            
            let rawResponseText = '';
            if (config.provider === 'gemini') {
                rawResponseText = data.candidates[0]?.content?.parts[0]?.text || '';
            } else {
                rawResponseText = data.choices[0]?.message?.content || '';
            }
            
            // 处理思维链 - 增强版
            if (activeChat.settings.enableChainOfThought) {
                // 尝试匹配多种可能的思维链格式
                const thoughtPatterns = [
                    /<thought>([\s\S]*?)<\/thought>/i,
                    /<thinking>([\s\S]*?)<\/thinking>/i,
                    /\[思考\]([\s\S]*?)\[\/思考\]/,
                    /\*thinking\*([\s\S]*?)\*\/thinking\*/i
                ];

                let thoughtText = null;
                let cleanedResponse = rawResponseText;

                for (const pattern of thoughtPatterns) {
                    const match = rawResponseText.match(pattern);
                    if (match && match[1]) {
                        thoughtText = match[1].trim();
                        cleanedResponse = rawResponseText.replace(pattern, '').trim();
                        break;
                    }
                }

                if (thoughtText) {
                    // 总是在控制台显示（用于调试）
                    console.groupCollapsed(`%c[AI 思维链] ${state.ai.name} 的思考过程`, 'color: #667eea; font-weight: bold;');
                    console.log(thoughtText);
                    console.groupEnd();

                    // 如果开启了弹窗显示
                    if (activeChat.settings.showThoughtAsAlert) {
                        // 创建更好看的弹窗
                        const thoughtAlert = `🤔 AI思维链分析\n━━━━━━━━━━━━━━━━━━\n${thoughtText}\n━━━━━━━━━━━━━━━━━━\n点击确定继续`;
                        alert(thoughtAlert);
                    }

                    return { text: cleanedResponse, thought: thoughtText };
                }
            }

            return rawResponseText.trim();
            
        } catch (error) {
            console.error("API 调用失败:", error);
            if (error.name === 'AbortError') {
                return '（抱歉，AI思考超时了……）';
            }
            return `【调试信息】请求失败: ${error.name} - ${error.message}`;
        }
    },
    
    // 构建OpenAI消息格式
    buildOpenAiMessages(currentUserInputParts, activeChat, recentHistory) {
        const state = StateManager.get();
        const parts = Array.isArray(currentUserInputParts)
            ? currentUserInputParts
            : [{ text: String(currentUserInputParts ?? '') }];
        
        const aiPersona = activeChat.settings.aiPersona || CONFIG.defaults.aiPersona;
        const userPersona = activeChat.settings.myPersona || CONFIG.defaults.myPersona;
        
        // 获取链接的世界书
        const linkedBooks = state.worldBook
            .filter(rule => activeChat.settings.linkedWorldBookIds && 
                          activeChat.settings.linkedWorldBookIds.includes(rule.id))
            .map(rule => ({
                id: rule.id,
                name: rule.name,
                category: rule.category,
                priority: rule.priority,
                text: rule.variables ? Utils.replaceVariables(rule.content) : rule.content
            }));
        
        // 构建时间信息
        const now = new Date();
        const timeInfo = {
            currentTime: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
            dayOfWeek: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()],
            date: `${now.getMonth() + 1}月${now.getDate()}日`
        };
        
        // 构建动态事件
        const dynamicEvents = [];
        if (state.session.minutesAway > 0) {
            dynamicEvents.push({
                type: '用户刚回来',
                detail: `用户离开了${state.session.minutesAway}分钟，期间你赚了${state.session.moneyEarned}金币。请根据你的性格决定如何欢迎他。`
            });
        }
        
        const importantItems = ['电影票', '咖啡', '书本', '盆栽'];
        const itemsInBackpack = state.player.inventory.filter(item => importantItems.includes(item));
        if (itemsInBackpack.length > 0) {
            dynamicEvents.push({
                type: '背包物品',
                detail: `用户背包里有：${itemsInBackpack.join('、')}。请根据你的性格和当前对话气氛，决定是否要提及此事。`
            });
        }
        
        // 构建状态提示
        const stateForPrompt = {
            时间状态: timeInfo,
            玩家: { 名字: state.player.name, 金币: state.player.money, 背包: state.player.inventory },
            AI状态: { 名字: state.ai.name, 心情: state.ai.mood, 金币: state.ai.money, 物品: state.ai.inventory },
            世界规则: linkedBooks,
            当前重要事件: dynamicEvents.length > 0 ? dynamicEvents : "无特殊事件"
        };
        
        const systemPrompt = `你正在一个虚拟手机模拟器中扮演AI伴侣'零'。
# 你的核心设定: ${aiPersona}
# 用户的虚拟形象: ${userPersona}
# 当前世界状态 (JSON格式, 供你参考):
${JSON.stringify(stateForPrompt, null, 2)}
# 你的任务
1. 严格按照你的角色设定进行回复。
2. **绝对不要**复述或解释上面的JSON状态信息，要自然地将这些信息融入你的对话中。
3. **针对"当前重要事件"**: 如果有事件发生（比如用户刚回来，或背包里有特殊物品），请根据你的性格，自然地对此作出反应，而不是生硬地播报。
4. 你的回复必须是纯文本。
${activeChat.settings.enableChainOfThought ? `5. **[思维链已开启]** 你必须在回复前先进行思考。
   严格遵循以下格式：

   <thought>
   这里写你的思考过程
   分析用户的意图
   考虑如何回应
   </thought>

   这里写你的正式回复

   注意：
   - <thought>标签必须在最开始
   - </thought>标签必须正确闭合
   - 正式回复不要包含任何标签` : ''}
`;
        
        const messages = [{ role: 'system', content: systemPrompt }];
        messages.push(...recentHistory);
        
        const userMessageContent = parts.map(part => {
            if (part.inline_data) {
                return {
                    type: 'image_url',
                    image_url: {
                        url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`
                    }
                };
            }
            return { type: 'text', text: part.text || '' };
        }).filter(p => (p.text && p.text.trim() !== '') || p.image_url);
        
        if (userMessageContent.length > 0) {
            messages.push({ role: 'user', content: userMessageContent });
        }
        
        return messages;
    },
    
    // 构建多模态历史
    buildMultimodalHistory(history, provider) {
        const formattedHistory = [];
        (history || []).forEach(msg => {
            const role = msg.sender === 'user' ? 'user' : 
                        (provider === 'gemini' ? 'model' : 'assistant');
            const contentParts = Array.isArray(msg.content) ? msg.content : 
                               [{ text: String(msg.content || '') }];
            
            if (provider === 'gemini') {
                formattedHistory.push({ role, parts: contentParts });
            } else {
                const openAiContent = contentParts.map(part => {
                    if (part.inline_data) {
                        return {
                            type: 'image_url',
                            image_url: {
                                url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`
                            }
                        };
                    }
                    return { type: 'text', text: part.text || '' };
                }).filter(p => (p.text && p.text.trim() !== '') || p.image_url);
                
                if (openAiContent.length > 0) {
                    formattedHistory.push({ role, content: openAiContent });
                }
            }
        });
        return formattedHistory;
    },
    
    // 获取激活的世界书条目
    getActiveWorldBookEntries(userInput) {
        const state = StateManager.get();
        const input = (userInput || '').toLowerCase();
        const activeEntries = [];
        
        state.worldBook?.forEach(entry => {
            if (!entry.enabled) return;
            
            // 常量条目总是激活
            if (entry.constant) {
                activeEntries.push(entry);
                return;
            }
            
            // 检查触发词
            if (entry.triggers && entry.triggers.length > 0) {
                const triggered = entry.triggers.some(trigger =>
                    trigger && input.includes(trigger.toLowerCase())
                );
                if (triggered) {
                    activeEntries.push(entry);
                }
            }
        });
        
        // 按优先级排序
        return activeEntries.sort((a, b) => b.priority - a.priority);
    }
};
