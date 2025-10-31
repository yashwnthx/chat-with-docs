import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET shared chat by session ID
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const chat: any = await db.chat.findFirst({
      where: { sessionId, isActive: true } as any,
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
        },
        knowledge: {
          include: {
            knowledge: true,
          },
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({ chat, messages: chat.messages });
  } catch (error) {
    console.error('Error fetching shared chat:', error);
    return NextResponse.json({ error: 'Failed to fetch chat' }, { status: 500 });
  }
}
