'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, AudioLines, Paperclip, ArrowUp, PanelLeftOpen, PanelLeftClose, SquarePen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { db, createConversation, addMessage, getMessages, Message } from '../lib/db';
import Sidebar from './Sidebar';
import clsx from 'clsx';

export default function ChatInterface() {
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat when ID changes
  useEffect(() => {
    if (currentChatId) {
      loadMessages(currentChatId);
    } else {
      setMessages([]);
    }
  }, [currentChatId]);

  const loadMessages = async (id: string) => {
    const history = await getMessages(id);
    setMessages(history);
  };

  const handleNewChat = async () => {
    const newId = uuidv4();
    await createConversation(newId, 'New Chat');
    setCurrentChatId(newId);
    setMessages([]);
  };

  const handleSelectChat = (id: string) => {
    setCurrentChatId(id);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Check scroll position to determine if we should auto-scroll
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    // Consider "near bottom" if within 100px of the bottom
    const isBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsNearBottom(isBottom);
  };

  // Auto-scroll on new messages ONLY if user was already near bottom
  useEffect(() => {
    if (isNearBottom) {
       scrollToBottom();
    }
  }, [messages, isNearBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    let chatId = currentChatId;
    if (!chatId) {
      chatId = uuidv4();
      await createConversation(chatId, input.trim().slice(0, 30) + '...');
      setCurrentChatId(chatId);
    }

    const content = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    // Optimistic Update
    const userMsg: Message = { conversationId: chatId, role: 'user', content, createdAt: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await addMessage(chatId, 'user', content);

      // Prepare context: get last N messages for context window
      // We pass the current visible history + new message to the API
      // (The API route handles      await addMessage(chatId, 'user', content);

      // Filter out empty messages to prevent API errors (400)
      const contextMessages = messages
        .filter(m => m.content.trim() !== '')
        .map(m => ({ role: m.role, content: m.content }));

      contextMessages.push({ role: 'user', content });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: contextMessages }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('Failed to fetch response');
      if (!response.body) throw new Error('No response body');

      // Create placeholder for AI response
      const assistantMsg: Message = { conversationId: chatId!, role: 'assistant', content: '', createdAt: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE data: "data: {...}"
        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                if (dataStr === '[DONE]') continue;
                try {
                    const data = JSON.parse(dataStr);
                    const contentDelta = data.choices?.[0]?.delta?.content || '';
                    if (contentDelta) {
                        aiContent += contentDelta;
                        // Update UI with accumulated content
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const lastMsg = newMsgs[newMsgs.length - 1];
                            if (lastMsg.role === 'assistant') {
                                lastMsg.content = aiContent;
                            }
                            return newMsgs;
                        });
                    }
                } catch (e) {
                    console.error('Error parsing stream chunk', e);
                }
            }
        }
      }

      // Save full message to DB after stream completes
      await addMessage(chatId!, 'assistant', aiContent);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
        // Optionally save partial message?
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'assistant' && lastMsg.content) {
                 await addMessage(chatId!, 'assistant', lastMsg.content);
            }
        }
      } else {
        console.error('Chat Error:', error);
        const errorMsg = 'Sorry, something went wrong.';
        await addMessage(chatId!, 'assistant', errorMsg);
        setMessages(prev => [...prev, { conversationId: chatId!, role: 'assistant', content: errorMsg, createdAt: Date.now() }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#212121] text-[#ececec] font-sans overflow-hidden">

      <Sidebar
         currentChatId={currentChatId}
         onSelectChat={handleSelectChat}
         onNewChat={handleNewChat}
         isOpen={isSidebarOpen}
         toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative bg-[#212121] md:bg-[#212121]">

        {/* Top Navigation / Mobile Toggle */}
        <div className="flex items-center justify-between p-3 md:p-4 text-[#b4b4b4] absolute top-0 left-0 right-0 z-10 w-full pointer-events-none">
           <div className="flex items-center gap-2 pointer-events-auto">
             {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-[#2f2f2f] rounded-lg md:block hidden" title="Open Sidebar">
                    <PanelLeftOpen className="w-5 h-5" />
                </button>
             )}
             <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-[#2f2f2f] rounded-lg md:hidden block" title="Menu">
                <PanelLeftOpen className="w-5 h-5" />
             </button>

             {/* Model Selector (Visual) */}
             <div className="flex items-center gap-1 font-medium text-lg text-[#ececec] cursor-pointer hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg">
                <span>ChatGPT</span>
                <span className="text-[#b4b4b4]">5.2</span>
                <span className="text-xs ml-1">▼</span>
             </div>
           </div>

           <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={handleNewChat}
                className="p-2 hover:bg-[#2f2f2f] rounded-lg"
                title="New Chat"
              >
                 <SquarePen className="w-5 h-5" />
               </button>
           </div>
        </div>

        {/* Messages Area */}
        <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 w-full"
        >
           {messages.length === 0 ? (
             /* Empty State */
             <div className="flex flex-col items-center justify-center h-full px-4">
                <div className="bg-white p-3 rounded-full mb-6">
                    <Bot className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-2xl font-medium mb-8">What can I help with?</h2>

                {/* Suggestion Chips (Visual) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                   {['Create a workout plan', 'Brainstorm marketing ideas', 'Explain quantum physics', 'Write a Python script'].map((text) => (
                      <button key={text} onClick={() => { setInput(text); if(textareaRef.current) textareaRef.current.focus(); }} className="p-4 border border-white/10 rounded-xl hover:bg-[#2f2f2f] text-left text-sm text-[#b4b4b4] transition-colors">
                          {text}
                      </button>
                   ))}
                </div>
             </div>
           ) : (
             /* Chat History */
             <div className="w-full max-w-3xl mx-auto flex flex-col pt-24 pb-48 px-4 md:px-0 gap-6">
               {messages.map((msg, idx) => (
                 <div key={idx} className="flex gap-4 md:gap-6 text-base">
                    <div className={clsx(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      msg.role === 'user' ? "bg-transparent" : "bg-green-500"
                    )}>
                       {msg.role === 'user' ? null : <Bot className="w-5 h-5 text-white" />}
                    </div>

                    <div className="flex-1 overflow-hidden space-y-1">
                        <div className="font-semibold text-sm opacity-90">
                           {msg.role === 'user' ? 'You' : 'ChatGPT'}
                        </div>
                        <div className="prose prose-invert max-w-none leading-7">
                           {msg.role === 'user' ? (
                               <div className="whitespace-pre-wrap">{msg.content}</div>
                           ) : (
                               <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                   {msg.content}
                               </ReactMarkdown>
                           )}
                        </div>
                    </div>
                 </div>
               ))}
               <div ref={messagesEndRef} />
             </div>
           )}
        </div>

        {/* Input Area */}
        <div className="w-full max-w-3xl mx-auto px-4 pb-4 md:pb-6 absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent pt-10 pointer-events-none">
            <div className="pointer-events-auto bg-[#2f2f2f] rounded-[26px] p-3 shadow-lg flex flex-col gap-2 border border-white/10 relative">
               <textarea
                 ref={textareaRef}
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={handleKeyDown}
                 placeholder="Message ChatGPT..."
                 rows={1}
                 className="w-full bg-transparent text-[#ececec] placeholder:text-[#b4b4b4] resize-none outline-none px-2 max-h-[200px] overflow-y-auto"
               />

               <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 text-[#b4b4b4]">
                      <button className="p-2 hover:bg-[#424242] rounded-full transition-colors">
                         <Paperclip className="w-5 h-5" />
                      </button>
                      <button className="p-2 hover:bg-[#424242] rounded-full transition-colors">
                         <AudioLines className="w-5 h-5" />
                      </button>
                  </div>
                  <button
                    disabled={(!input.trim() && !isLoading)}
                    onClick={isLoading ? handleStop : () => handleSubmit()}
                    className={clsx(
                        "p-2 rounded-full transition-all duration-200",
                        (input.trim() || isLoading) ? "bg-white text-black" : "bg-[#424242] text-[#676767]"
                    )}
                  >
                      {isLoading ? (
                          <div className="w-5 h-5 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 bg-black rounded-sm" />
                          </div>
                      ) : (
                          <ArrowUp className="w-5 h-5" />
                      )}
                  </button>
               </div>
            </div>
            <p className="text-center text-xs text-[#b4b4b4] mt-2 pb-2">
                ChatGPT can make mistakes. Check important info.
            </p>
        </div>

      </div>
    </div>
  );
}
