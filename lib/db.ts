// Prisma-compatible adapter for Supabase
// This allows minimal code changes while switching from Prisma to Supabase

import { supabaseAdmin } from './supabase';

export const db = {
  chat: {
    async findUnique({ where, include }: { where: { id: string }, include?: any }) {
      let selectQuery = '*';

      if (include?.messages || include?.knowledge) {
        const selects = ['*'];
        if (include?.messages) selects.push('messages:Message(*)');
        if (include?.knowledge) selects.push('knowledge:KnowledgeOnChat(knowledge:Knowledge(*))');
        selectQuery = selects.join(', ');
      }

      const { data, error } = await supabaseAdmin
        .from('Chat')
        .select(selectQuery)
        .eq('id', where.id)
        .single();

      if (error) throw error;
      return data;
    },

    async findFirst({ where, include }: { where: { sessionId: string }, include?: any }) {
      let selectQuery = '*';

      if (include?.messages || include?.knowledge) {
        const selects = ['*'];
        if (include?.messages) selects.push('messages:Message(*)');
        if (include?.knowledge) selects.push('knowledge:KnowledgeOnChat(knowledge:Knowledge(*))');
        selectQuery = selects.join(', ');
      }

      const { data, error } = await supabaseAdmin
        .from('Chat')
        .select(selectQuery)
        .eq('sessionId', where.sessionId)
        .single();

      if (error) throw error;
      return data;
    },    async findMany({ where, orderBy, include }: any = {}) {
      let query = supabaseAdmin.from('Chat').select('*');

      if (include?.messages) {
        query = supabaseAdmin.from('Chat').select('*, messages:Message(*)');
      }

      if (where?.isActive !== undefined) {
        query = query.eq('isActive', where.isActive);
      }

      if (where?.sessionId) {
        query = query.eq('sessionId', where.sessionId);
      }

      if (orderBy?.updatedAt) {
        query = query.order('updatedAt', { ascending: orderBy.updatedAt === 'asc' });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create({ data }: any) {
      const { data: result, error } = await supabaseAdmin
        .from('Chat')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update({ where, data }: any) {
      const { data: result, error } = await supabaseAdmin
        .from('Chat')
        .update(data)
        .eq('id', where.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async delete({ where }: { where: { id: string } }) {
      const { error } = await supabaseAdmin
        .from('Chat')
        .delete()
        .eq('id', where.id);

      if (error) throw error;
      return {};
    }
  },

  message: {
    async create({ data }: any) {
      const { data: result, error} = await supabaseAdmin
        .from('Message')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update({ where, data }: any) {
      const { data: result, error } = await supabaseAdmin
        .from('Message')
        .update(data)
        .eq('id', where.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async findMany({ where, orderBy }: any = {}) {
      let query = supabaseAdmin.from('Message').select('*');

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
      let query = supabaseAdmin.from('Knowledge').select('*');

      if (where?.isActive !== undefined) {
        query = query.eq('isActive', where.isActive);
      }

      if (where?.id && 'in' in where.id) {
        query = query.in('id', where.id.in);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async findUnique({ where }: { where: { id: string } }) {
      const { data, error } = await supabaseAdmin
        .from('Knowledge')
        .select('*')
        .eq('id', where.id)
        .single();

      if (error) throw error;
      return data;
    },

    async create({ data }: any) {
      const { data: result, error } = await supabaseAdmin
        .from('Knowledge')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async update({ where, data }: any) {
      const { data: result, error } = await supabaseAdmin
        .from('Knowledge')
        .update(data)
        .eq('id', where.id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },

    async delete({ where }: { where: { id: string } }) {
      const { error } = await supabaseAdmin
        .from('Knowledge')
        .delete()
        .eq('id', where.id);

      if (error) throw error;
      return {};
    }
  },

  knowledgeOnChat: {
    async createMany({ data }: any) {
      const { error } = await supabaseAdmin
        .from('KnowledgeOnChat')
        .insert(data);

      if (error) throw error;
      return { count: data.length };
    },

    async deleteMany({ where }: any) {
      const { error } = await supabaseAdmin
        .from('KnowledgeOnChat')
        .delete()
        .eq('chatId', where.chatId);

      if (error) throw error;
      return {};
    }
  }
};
