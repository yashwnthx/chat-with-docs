// Prisma-compatible adapter for Supabase
// This allows minimal code changes while switching from Prisma to Supabase

import { supabaseAdmin } from './supabase';

// Helper to check if Supabase is configured
function checkSupabase() {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase is not configured. Please create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return supabaseAdmin;
}

export const db = {
  chat: {
    async findUnique({ where, include }: { where: { id: string }, include?: any }) {
      const client = checkSupabase();
      // For Supabase, we need to fetch the main record first
      const { data: chat, error: chatError } = await client
        .from('Chat')
        .select('*')
        .eq('id', where.id)
        .maybeSingle();

      if (chatError) throw chatError;
      if (!chat) return null;

      // Then fetch related data if needed
      if (include) {
        if (include.messages) {
          const { data: messages, error: messagesError } = await client
            .from('Message')
            .select('*')
            .eq('chatId', where.id)
            .order('timestamp', { ascending: true });

          if (messagesError) throw messagesError;
          chat.messages = messages || [];
        }

        if (include.knowledge) {
          const { data: knowledgeLinks, error: knowledgeError } = await client
            .from('KnowledgeOnChat')
            .select('*, knowledge:Knowledge(*)')
            .eq('chatId', where.id);

          if (knowledgeError) throw knowledgeError;
          chat.knowledge = knowledgeLinks || [];
        }
      }

      return chat;
    },

    async findFirst({ where, include }: { where: { sessionId: string; isActive?: boolean }, include?: any }) {
      const client = checkSupabase();
      let selectQuery = '*';

      if (include) {
        const parts = ['*'];
        if (include.messages) {
          parts.push('messages:Message(*)');
        }
        if (include.knowledge) {
          parts.push('knowledge:KnowledgeOnChat(knowledge:Knowledge(*))');
        }
        selectQuery = parts.join(', ');
      }

      let query = client
        .from('Chat')
        .select(selectQuery)
        .eq('sessionId', where.sessionId);

      if (where.isActive !== undefined) {
        query = query.eq('isActive', where.isActive);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    },

    async findMany({ where, orderBy, include }: any = {}) {
      const client = checkSupabase();
      // First fetch the chats
      let query = client.from('Chat').select('*');

      if (where?.isActive !== undefined) {
        query = query.eq('isActive', where.isActive);
      }

      if (where?.sessionId) {
        query = query.eq('sessionId', where.sessionId);
      }

      // Filter by deviceId if provided
      if (where?.deviceId) {
        query = query.eq('deviceId', where.deviceId);
      }

      if (orderBy?.updatedAt) {
        query = query.order('updatedAt', { ascending: orderBy.updatedAt === 'asc' });
      }

      const { data: chats, error } = await query;
      if (error) throw error;
      if (!chats || chats.length === 0) return [];

      // Then fetch related data if needed
      if (include) {
        const chatIds = chats.map(c => c.id);

        // Fetch messages for all chats
        if (include.messages) {
          const { data: allMessages, error: messagesError } = await client
            .from('Message')
            .select('*')
            .in('chatId', chatIds)
            .order('timestamp', { ascending: include.messages.orderBy?.timestamp === 'asc' });

          if (messagesError) throw messagesError;

          // Group messages by chatId
          const messagesByChat = (allMessages || []).reduce((acc: any, msg: any) => {
            if (!acc[msg.chatId]) acc[msg.chatId] = [];
            acc[msg.chatId].push(msg);
            return acc;
          }, {});

          // Add messages to each chat
          chats.forEach(chat => {
            chat.messages = messagesByChat[chat.id] || [];
          });
        }

        // Fetch knowledge links for all chats
        if (include.knowledge) {
          const { data: knowledgeLinks, error: knowledgeError } = await client
            .from('KnowledgeOnChat')
            .select('*, knowledge:Knowledge(*)')
            .in('chatId', chatIds);

          if (knowledgeError) throw knowledgeError;

          // Group knowledge by chatId
          const knowledgeByChat = (knowledgeLinks || []).reduce((acc: any, link: any) => {
            if (!acc[link.chatId]) acc[link.chatId] = [];
            acc[link.chatId].push(link);
            return acc;
          }, {});

          // Add knowledge to each chat
          chats.forEach(chat => {
            chat.knowledge = knowledgeByChat[chat.id] || [];
          });
        }
      }

      return chats;
    },

    async create({ data }: any) {
      const client = checkSupabase();
      // Generate ID using nanoid if not provided (Chat table uses text IDs)
      const { nanoid } = await import('nanoid');
      const now = new Date().toISOString();
      const chatData = {
        ...data,
        id: data.id || nanoid(10),
        updatedAt: data.updatedAt || now,
        createdAt: data.createdAt || now,
      };

      const { data: result, error } = await client
        .from('Chat')
        .insert(chatData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update({ where, data }: any) {
      const client = checkSupabase();
      const { data: result, error } = await client
        .from('Chat')
        .update(data)
        .eq('id', where.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async delete({ where }: { where: { id: string } }) {
      const client = checkSupabase();
      const { error } = await client
        .from('Chat')
        .delete()
        .eq('id', where.id);

      if (error) throw error;
      return {};
    }
  },

  message: {
    async create({ data }: any) {
      const client = checkSupabase();
      const { data: result, error} = await client
        .from('Message')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update({ where, data }: any) {
      const client = checkSupabase();
      const { data: result, error } = await client
        .from('Message')
        .update(data)
        .eq('id', where.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async findMany({ where, orderBy }: any = {}) {
      const client = checkSupabase();
      let query = client.from('Message').select('*');

      if (where?.chatId) {
        query = query.eq('chatId', where.chatId);
      }

      if (orderBy?.timestamp) {
        query = query.order('timestamp', { ascending: orderBy.timestamp === 'asc' });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  },

  knowledge: {
    async findMany({ where }: any = {}) {
      const client = checkSupabase();
      let query = client.from('Knowledge').select('*');

      if (where?.isActive !== undefined) {
        query = query.eq('isActive', where.isActive);
      }

      if (where?.id && 'in' in where.id) {
        query = query.in('id', where.id.in);
      }

      // Filter by deviceId if provided
      if (where?.deviceId) {
        query = query.eq('deviceId', where.deviceId);
      }

      // Support OR conditions for multiple deviceIds
      if (where?.OR) {
        const deviceIds = where.OR
          .filter((cond: any) => cond.deviceId)
          .map((cond: any) => cond.deviceId);
        if (deviceIds.length > 0) {
          query = query.in('deviceId', deviceIds);
        }
      }

      const { data, error } = await query.order('uploadedAt', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async findFirst({ where }: any = {}) {
      const client = checkSupabase();
      let query = client.from('Knowledge').select('*');

      if (where?.originalFilename) {
        query = query.eq('originalFilename', where.originalFilename);
      }

      if (where?.deviceId) {
        query = query.eq('deviceId', where.deviceId);
      }

      if (where?.isActive !== undefined) {
        query = query.eq('isActive', where.isActive);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },

    async findUnique({ where }: { where: { id: string } }) {
      const client = checkSupabase();
      const { data, error } = await client
        .from('Knowledge')
        .select('*')
        .eq('id', where.id)
        .single();

      if (error) throw error;
      return data;
    },

    async create({ data }: any) {
      const client = checkSupabase();
      // Generate ID using nanoid if not provided (Knowledge table uses text IDs)
      const { nanoid } = await import('nanoid');
      const now = new Date().toISOString();
      const knowledgeData = {
        ...data,
        id: data.id || nanoid(10),
        createdAt: data.createdAt || now,
        uploadedAt: data.uploadedAt || now,
      };

      const { data: result, error } = await client
        .from('Knowledge')
        .insert(knowledgeData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update({ where, data }: any) {
      const client = checkSupabase();
      const { data: result, error } = await client
        .from('Knowledge')
        .update(data)
        .eq('id', where.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async delete({ where }: { where: { id: string } }) {
      const client = checkSupabase();
      const { error } = await client
        .from('Knowledge')
        .delete()
        .eq('id', where.id);

      if (error) throw error;
      return {};
    }
  },

  knowledgeOnChat: {
    async createMany({ data }: any) {
      const client = checkSupabase();
      const { error } = await client
        .from('KnowledgeOnChat')
        .insert(data);

      if (error) throw error;
      return { count: data.length };
    },

    async deleteMany({ where }: any) {
      const client = checkSupabase();
      const { error } = await client
        .from('KnowledgeOnChat')
        .delete()
        .eq('chatId', where.chatId);

      if (error) throw error;
      return {};
    }
  }
};
