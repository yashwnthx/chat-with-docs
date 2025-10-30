import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();

// GET all chats
export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

// POST create new chat
export async function POST(req: Request) {
  try {
    const { title } = await req.json();
    const { nanoid } = await import('nanoid');

    const chat = await prisma.chat.create({
      data: {
        sessionId: nanoid(10),
        title: title || 'New Chat',
      },
    });

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}
