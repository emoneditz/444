async function sendMessage() {
        const txt = messageInput.value.trim(); 
        const files = document.getElementById('fileInput').files;
        if(!txt && files.length === 0) return;
        
        const replyParam = activeReplyMessage && activeReplyMessage.telegramMessageId ? { message_id: activeReplyMessage.telegramMessageId } : null;
        const currentReplyId = activeReplyMessage ? activeReplyMessage.id : null;

        // 1. TEXT CALL OVER NODE API
        if (files.length === 0) {
            const tempId = Date.now().toString();
            const msg = { id: tempId, text: txt, sender: 'me', timestamp: Date.now(), replyTo: currentReplyId, reactions: {}, mediaUrl: null, mediaType: null, fileName: null };
            chatHistory.push(msg); saveChatHistory(); chatBox.appendChild(createMsgEl(msg)); chatBox.scrollTop = chatBox.scrollHeight;

            // BUG FIX: Prevent passing 'null' into Telegram which causes it to reject texts!
            let fetchBody = { text: txt };
            if (replyParam) {
                fetchBody.reply_parameters = replyParam;
            }

            try {
                const res = await fetch(`/api/sendMessage`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(fetchBody) 
                });
                const d = await res.json();
                if(d.ok) { 
                    const m = chatHistory.find(x => x.id === tempId); 
                    if(m) m.telegramMessageId = d.result.message_id; 
                    saveChatHistory(); 
                }
            } catch(e) { console.error("Text Send Error: ", e); }
        } else {
            // 2. MULTIMEDIA UPLOADS (MULTER PROXY STREAM)
            for (let i = 0; i < files.length; i++) {
                const file = files[i]; const tempId = (Date.now() + i).toString(); const caption = (i === 0) ? txt : '';
                const msg = {
                    id: tempId, text: caption, sender: 'me', timestamp: Date.now(), replyTo: currentReplyId, reactions: {}, mediaUrl: URL.createObjectURL(file),
                    mediaType: file.type.includes('image')?'image':file.type.includes('video')?'video':'doc', fileName: file.name
                };
                
                chatHistory.push(msg); saveChatHistory(); chatBox.appendChild(createMsgEl(msg)); chatBox.scrollTop = chatBox.scrollHeight;
                const formData = new FormData();
                formData.append('file', file);
                if(caption) formData.append('caption', caption);
                if(replyParam) formData.append('reply_parameters', JSON.stringify(replyParam));

                try {
                    const res = await fetch(`/api/sendFile`, { method: 'POST', body: formData });
                    const d = await res.json();
                    if(d.ok) { 
                        const m = chatHistory.find(x => x.id === tempId); 
                        if(m) m.telegramMessageId = d.result.message_id; 
                        saveChatHistory(); 
                    }
                } catch(e) { console.error("Media Send Error:", e); }
            }
        }
        
        // Clean up UI instantly after 
        messageInput.value = ''; 
        messageInput.style.height = 'auto';
        document.getElementById('fileInput').value = ''; 
        document.getElementById('fileInfoBar').classList.remove('show'); 
        sendBtn.disabled = true;
        activeReplyMessage = null; 
        document.getElementById('replyingToBar').classList.remove('show');
    }
