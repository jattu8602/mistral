'use client';

import { useEffect, useState } from 'react';
import { Plus, MessageSquare, Trash2, Github, Settings, LayoutPanelLeft } from 'lucide-react';
import { db, Conversation, getConversations, deleteConversation } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import Link from 'next/link';

interface SidebarProps {
  currentChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export default function Sidebar({ currentChatId, onSelectChat, onNewChat, isOpen, toggleSidebar }: SidebarProps) {
  const conversations = useLiveQuery(() => getConversations(), []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
    if (currentChatId === id) {
      onNewChat();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={clsx(
          "fixed inset-0 bg-black/50 z-40 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <div className={clsx(
        "fixed md:static inset-y-0 left-0 z-50 w-[260px] bg-[#171717] text-[#ececec] flex flex-col transition-transform duration-300 transform md:transform-none border-r border-white/5",
        isOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:-translate-x-full md:overflow-hidden"
      )}>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) toggleSidebar();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-[#212121] transition-colors text-sm font-medium"
          >
            <div className="p-1 bg-white text-black rounded-full">
               <Plus className="w-4 h-4" />
            </div>
            <span>New chat</span>
          </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-zinc-700">
          <div className="text-xs font-medium text-zinc-500 px-4 py-2">Recent</div>
          {conversations?.map((chat) => (
            <div
              key={chat.id}
              onClick={() => {
                 onSelectChat(chat.id);
                 if (window.innerWidth < 768) toggleSidebar();
              }}
              className={clsx(
                "group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors text-sm relative overflow-hidden",
                currentChatId === chat.id ? "bg-[#212121]" : "hover:bg-[#212121]"
              )}
            >
              <MessageSquare className="w-4 h-4 text-zinc-400 shrink-0" />
              <div className="truncate flex-1 pr-6 relative z-10">
                {chat.title}
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#171717] to-transparent group-hover:from-[#212121] pointer-events-none" />

              {/* Delete Action - visible on hover/active */}
              <button
                onClick={(e) => handleDelete(e, chat.id)}
                className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity z-20"
                title="Delete Chat"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* User Profile / Footer */}
        <div className="p-3 border-t border-white/5 mt-auto">
          <button className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-[#212121] transition-colors text-sm">
             <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold">
                J
             </div>
             <div className="flex flex-col items-start">
                <span className="font-medium">User Device</span>
                <span className="text-xs text-zinc-500">Local Vector DB</span>
             </div>
          </button>
        </div>
      </div>
    </>
  );
}
