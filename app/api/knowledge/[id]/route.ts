import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import { join } from 'path';

// GET specific knowledge base
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const knowledge = await db.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    return NextResponse.json({ knowledge });
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
  }
}

// PATCH - Update knowledge content
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const knowledge = await db.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    // Update the content
    const updated = await db.knowledge.update({
      where: { id },
      data: {
        content,
        documentCount: Math.max(1, Math.ceil(content.split(/\s+/).length / 500)),
      } as any,
    });

    return NextResponse.json({ knowledge: updated });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    return NextResponse.json({ error: 'Failed to update knowledge' }, { status: 500 });
  }
}

// DELETE knowledge base
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const knowledge = await db.knowledge.findUnique({
      where: { id },
    });

    if (!knowledge) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }

    // Delete file from disk
    if (knowledge.filePath) {
      try {
        const fullPath = join(process.cwd(), 'public', knowledge.filePath);
        await unlink(fullPath);
      } catch (err) {
        console.warn('Could not delete file:', err);
      }
    }

    // Hard delete from database (cascades to KnowledgeOnChat automatically)
    await db.knowledge.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    return NextResponse.json({ error: 'Failed to delete knowledge' }, { status: 500 });
  }
}
