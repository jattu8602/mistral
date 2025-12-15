import Dexie, { Table } from 'dexie';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id?: number; // Auto-incremented
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

class ChatDatabase extends Dexie {
  conversations!: Table<Conversation>;
  messages!: Table<Message>;

  constructor() {
    super('ChatDatabase');
    this.version(1).stores({
      conversations: 'id, updatedAt', // Primary key and indexed props
      messages: '++id, conversationId, createdAt'
    });
  }
}

export const db = new ChatDatabase();

export async function createConversation(id: string, title: string = 'New Chat') {
  await db.conversations.add({
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function getConversations() {
  return await db.conversations.orderBy('updatedAt').reverse().toArray();
}

export async function addMessage(conversationId: string, role: 'user' | 'assistant' | 'system', content: string) {
  await db.messages.add({
    conversationId,
    role,
    content,
    createdAt: Date.now(),
  });

  // Update conversation timestamp
  await db.conversations.update(conversationId, { updatedAt: Date.now() });
}

export async function getMessages(conversationId: string) {
  return await db.messages.where('conversationId').equals(conversationId).sortBy('createdAt');
}

export async function updateConversationTitle(id: string, title: string) {
  await db.conversations.update(id, { title });
}

export async function deleteConversation(id: string) {
  await db.transaction('rw', db.conversations, db.messages, async () => {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
  });
}
