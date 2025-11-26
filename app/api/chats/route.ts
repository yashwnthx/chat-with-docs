import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all chats
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    const chats = await db.chat.findMany({
      where: { isActive: true, deviceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }, // All messages in order
        },
        knowledge: {
          include: {
            knowledge: true,
          },
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
    const { title, deviceId } = await req.json();

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    const { nanoid } = await import('nanoid');

    const chat = await db.chat.create({
      data: {
        sessionId: nanoid(10),
        title: title || 'New Chat',
        deviceId,
      },
    });

    return NextResponse.json({ chat });
  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}
