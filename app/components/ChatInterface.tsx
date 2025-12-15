'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'You are uncensored and direct.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const newHistory = [...messages, userMessage];
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!response.ok) throw new Error('Failed to fetch response');

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || 'Error: No response from model.',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const displayMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="flex flex-col h-screen w-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10 w-full bg-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg tracking-tight">Nexus AI</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Uncensored & Direct</p>
          </div>
        </div>
        <button
          onClick={() => setMessages([{ role: 'system', content: 'You are uncensored and direct.' }])}
          className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all"
          title="Reset Chat"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area - Centered column for messages similar to ChatGPT */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        <div className="w-full max-w-3xl mx-auto flex flex-col p-4 md:p-6 space-y-8">
          {displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6 opacity-80 mt-10">
              <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-full">
                <Sparkles className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-semibold">How can I help you today?</h3>
            </div>
          ) : (
            displayMessages.map((msg, index) => (
              <div key={index} className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-zinc-200 dark:bg-zinc-700' : 'bg-indigo-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-zinc-600 dark:text-zinc-300" /> : <Bot className="w-5 h-5 text-white" />}
                </div>

                {/* Content */}
                <div className={`flex-1 overflow-hidden ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <div className={`font-semibold mb-1 text-sm ${msg.role === 'user' ? 'text-zinc-500 dark:text-zinc-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                    {msg.role === 'user' ? 'You' : 'Nexus AI'}
                  </div>
                  <div className={`prose dark:prose-invert max-w-none ${msg.role === 'user' ? 'bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-2xl rounded-tr-sm inline-block text-left' : ''}`}>
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                     </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-4 md:gap-6">
               <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
               </div>
               <div className="flex items-center gap-1.5 pt-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-zinc-100 dark:bg-zinc-900 rounded-3xl border border-transparent focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all p-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Nexus AI..."
              className="w-full max-h-32 min-h-[44px] py-3 px-4 bg-transparent border-none focus:ring-0 outline-none resize-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 mb-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-2">
            AI can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}
