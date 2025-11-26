import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { SYSTEM_DEVICE_ID } from '@/lib/auto-train';

// Helper to extract text from PDF
async function extractPdfText(buffer: Buffer, fileName: string): Promise<{ content: string; hasImages: boolean; pageCount: number }> {
  try {
    const pdfParse = (await import('pdf-parse-fork')).default;
    const pdfData = await pdfParse(buffer);
    return {
      content: pdfData.text,
      hasImages: pdfData.numpages > 0,
      pageCount: pdfData.numpages,
    };
  } catch (error) {
    console.error(`Error extracting PDF text from ${fileName}:`, error);
    return {
      content: `PDF Document: ${fileName} - Text extraction failed`,
      hasImages: true,
      pageCount: 0,
    };
  }
}

// Helper to get file type
function getFileType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'md':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}

// Helper to recursively get all files from a directory
async function getAllFiles(dirPath: string, category: string = ''): Promise<Array<{ path: string; name: string; category: string }>> {
  const files: Array<{ path: string; name: string; category: string }> = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Use folder name as category
        const subFiles = await getAllFiles(fullPath, entry.name);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase().split('.').pop();
        if (['pdf', 'txt', 'md'].includes(ext || '')) {
          files.push({
            path: fullPath,
            name: entry.name,
            category: category,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return files;
}

// Train a single document
async function trainDocument(filePath: string, fileName: string, category: string): Promise<{ success: boolean; id?: string; skipped?: boolean; error?: string }> {
  try {
    // Check if already trained
    const existing = await db.knowledge.findFirst({
      where: {
        originalFilename: fileName,
        deviceId: SYSTEM_DEVICE_ID,
      },
    });

    if (existing) {
      console.log(`📚 Skipping already trained: ${fileName}`);
      return { success: true, id: existing.id, skipped: true };
    }

    const buffer = await readFile(filePath);
    const fileType = getFileType(fileName);
    const fileSize = buffer.length;

    let content = '';
    let hasImages = false;

    if (fileType === 'application/pdf') {
      const pdfResult = await extractPdfText(buffer, fileName);
      content = pdfResult.content;
      hasImages = pdfResult.hasImages;
    } else {
      content = buffer.toString('utf-8');
    }

    // Count chunks (simple word count / 500)
    const wordCount = content.split(/\s+/).length;
    const documentCount = Math.max(1, Math.ceil(wordCount / 500));

    // Create name with category prefix
    const displayName = category ? `[${category}] ${fileName}` : fileName;

    // Save to database
    const knowledge = await db.knowledge.create({
      data: {
        name: displayName,
        content: content.substring(0, 50000), // Limit content length
        originalFilename: fileName,
        filePath: filePath,
        fileType: fileType,
        fileSize: fileSize,
        documentCount,
        hasImages,
        deviceId: SYSTEM_DEVICE_ID,
      } as any,
    });

    console.log(`✅ Trained: ${displayName} (${content.length} chars, ${documentCount} chunks)`);
    return { success: true, id: knowledge.id, skipped: false };

  } catch (error) {
    console.error(`❌ Error training ${fileName}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// GET - Check training status
export async function GET(req: Request) {
  try {
    const trainedDocs = await db.knowledge.findMany({
      where: {
        deviceId: SYSTEM_DEVICE_ID,
        isActive: true,
      },
    });

    // Map to return only needed fields
    const documents = trainedDocs.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      originalFilename: doc.originalFilename,
      fileSize: doc.fileSize,
      documentCount: doc.documentCount,
      createdAt: doc.createdAt,
    }));

    return NextResponse.json({
      trained: documents.length,
      documents,
    });
  } catch (error) {
    console.error('Error checking training status:', error);
    return NextResponse.json(
      { error: 'Failed to check training status' },
      { status: 500 }
    );
  }
}

// POST - Trigger training
export async function POST(req: Request) {
  try {
    const modulesPath = join(process.cwd(), 'modules');
    console.log('📂 Starting training from:', modulesPath);

    // Get all files from modules folder
    const files = await getAllFiles(modulesPath);
    console.log(`📋 Found ${files.length} files to process`);

    const results = {
      total: files.length,
      trained: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Train each file
    for (const file of files) {
      const result = await trainDocument(file.path, file.name, file.category);
      if (result.success) {
        if (result.skipped) {
          results.skipped++;
        } else {
          results.trained++;
        }
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${file.name}: ${result.error}`);
        }
      }
    }

    console.log(`\n📊 Training Complete:`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Trained: ${results.trained}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Failed: ${results.failed}`);

    return NextResponse.json({
      message: 'Training complete',
      results,
    });
  } catch (error) {
    console.error('❌ Training error:', error);
    return NextResponse.json(
      { error: 'Failed to train documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
