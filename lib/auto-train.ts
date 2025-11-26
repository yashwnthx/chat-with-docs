import { db } from '@/lib/db';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// System device ID for pre-trained modules
export const SYSTEM_DEVICE_ID = 'system-training';

// Track if training has been initiated this server session
let trainingInitiated = false;
let trainingPromise: Promise<void> | null = null;

// Helper to extract text from PDF
async function extractPdfText(buffer: Buffer, fileName: string): Promise<{ content: string; hasImages: boolean }> {
  try {
    const pdfParse = (await import('pdf-parse-fork')).default;
    const pdfData = await pdfParse(buffer);
    return {
      content: pdfData.text,
      hasImages: pdfData.numpages > 0,
    };
  } catch (error) {
    console.error(`Error extracting PDF text from ${fileName}:`, error);
    return {
      content: `PDF Document: ${fileName} - Text extraction failed`,
      hasImages: true,
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
    // Directory might not exist, which is fine
    if ((error as any)?.code !== 'ENOENT') {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }

  return files;
}

// Train a single document
async function trainDocument(filePath: string, fileName: string, category: string): Promise<boolean> {
  try {
    // Check if already trained
    const existing = await db.knowledge.findFirst({
      where: {
        originalFilename: fileName,
        deviceId: SYSTEM_DEVICE_ID,
      },
    });

    if (existing) {
      return true; // Already trained, skip silently
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

    // Count chunks
    const wordCount = content.split(/\s+/).length;
    const documentCount = Math.max(1, Math.ceil(wordCount / 500));

    // Create name with category prefix
    const displayName = category ? `[${category}] ${fileName}` : fileName;

    // Save to database
    await db.knowledge.create({
      data: {
        name: displayName,
        content: content.substring(0, 50000),
        originalFilename: fileName,
        filePath: filePath,
        fileType: fileType,
        fileSize: fileSize,
        documentCount,
        hasImages,
        deviceId: SYSTEM_DEVICE_ID,
      } as any,
    });

    return true;
  } catch (error) {
    console.error(`Error training ${fileName}:`, error);
    return false;
  }
}

// Main auto-training function - runs in background
async function runAutoTraining(): Promise<void> {
  try {
    const modulesPath = join(process.cwd(), 'modules');
    const files = await getAllFiles(modulesPath);

    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      const existingDoc = await db.knowledge.findFirst({
        where: {
          originalFilename: file.name,
          deviceId: SYSTEM_DEVICE_ID,
        },
      });

      if (!existingDoc) {
        await trainDocument(file.path, file.name, file.category);
      }
    }
  } catch (error) {
    console.error('Auto-training error:', error);
  }
}

/**
 * Initialize auto-training. Call this from any API route that loads early.
 * Training runs in the background and won't block the request.
 */
export function initAutoTraining(): void {
  if (trainingInitiated) {
    return;
  }

  trainingInitiated = true;
  trainingPromise = runAutoTraining();
  trainingPromise.catch(() => {});
}

/**
 * Wait for training to complete (useful for testing)
 */
export async function waitForTraining(): Promise<void> {
  if (trainingPromise) {
    await trainingPromise;
  }
}
