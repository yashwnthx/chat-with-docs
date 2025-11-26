import { db } from '@/lib/db';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// System device ID for pre-trained modules
export const SYSTEM_DEVICE_ID = 'system-training';

// Track if training has been initiated this server session
let trainingInitiated = false;
let trainingPromise: Promise<void> | null = null;

// Helper to extract text from PDF with page markers
async function extractPdfText(buffer: Buffer, fileName: string): Promise<{ content: string; hasImages: boolean; totalPages: number }> {
  try {
    const pdfParse = (await import('pdf-parse-fork')).default;

    // Custom page renderer to add page markers
    const options = {
      pagerender: async function(pageData: any) {
        const textContent = await pageData.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        return text;
      }
    };

    const pdfData = await pdfParse(buffer, options);
    const totalPages = pdfData.numpages || 1;

    // Split content by form feed (page break) or estimate pages
    const rawText = pdfData.text;
    const pageBreaks = rawText.split(/\f/);

    let contentWithPageMarkers = '';
    if (pageBreaks.length > 1) {
      // PDF has page breaks
      pageBreaks.forEach((pageText, index) => {
        if (pageText.trim()) {
          contentWithPageMarkers += `[PAGE ${index + 1}] ${pageText.trim()}\n\n`;
        }
      });
    } else {
      // No page breaks, estimate based on character count
      const charsPerPage = Math.ceil(rawText.length / totalPages);
      for (let i = 0; i < totalPages; i++) {
        const start = i * charsPerPage;
        const end = Math.min((i + 1) * charsPerPage, rawText.length);
        const pageText = rawText.substring(start, end).trim();
        if (pageText) {
          contentWithPageMarkers += `[PAGE ${i + 1}] ${pageText}\n\n`;
        }
      }
    }

    return {
      content: contentWithPageMarkers || rawText,
      hasImages: pdfData.numpages > 0,
      totalPages,
    };
  } catch (error) {
    console.error(`Error extracting PDF text from ${fileName}:`, error);
    return {
      content: `PDF Document: ${fileName} - Text extraction failed`,
      hasImages: true,
      totalPages: 0,
    };
  }
}// Helper to get file type
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
    let totalPages = 1;

    if (fileType === 'application/pdf') {
      const pdfResult = await extractPdfText(buffer, fileName);
      content = pdfResult.content;
      hasImages = pdfResult.hasImages;
      totalPages = pdfResult.totalPages;
    } else {
      content = buffer.toString('utf-8');
    }

    // Count chunks
    const wordCount = content.split(/\s+/).length;
    const documentCount = Math.max(1, Math.ceil(wordCount / 500));

    // Create name with category prefix and page count
    const displayName = category
      ? `[${category}] ${fileName}`
      : fileName;

    // Add page count to the name for display
    const nameWithPages = totalPages > 1
      ? `${displayName} (${totalPages} pages)`
      : displayName;

    // Save to database
    await db.knowledge.create({
      data: {
        name: nameWithPages,
        content: content.substring(0, 50000),
        originalFilename: fileName,
        filePath: filePath,
        fileType: fileType,
        fileSize: fileSize,
        documentCount: totalPages > 0 ? totalPages : documentCount,
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
