import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { initAutoTraining, SYSTEM_DEVICE_ID } from '@/lib/auto-train';

// GET all knowledge bases (user's docs + system-trained modules)
export async function GET(req: Request) {
  // Trigger auto-training on first API call (runs in background)
  initAutoTraining();

  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    // Fetch both user's documents and system-trained modules
    const knowledge = await db.knowledge.findMany({
      where: {
        isActive: true,
        OR: [
          { deviceId },
          { deviceId: SYSTEM_DEVICE_ID }, // Include pre-trained modules for all users
        ],
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return NextResponse.json({ knowledge });
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
  }
}

// POST upload new knowledge base
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const textContent = formData.get('text') as string; // Manual text input option
    const deviceId = formData.get('deviceId') as string;

    if (!deviceId) {
      return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
    }

    // If manual text is provided, use that instead of file
    if (textContent && textContent.trim()) {
      const knowledge = await db.knowledge.create({
        data: {
          name: formData.get('name') as string || 'Text Document',
          content: textContent,
          originalFilename: 'text-input.txt',
          fileType: 'text/plain',
          fileSize: Buffer.byteLength(textContent, 'utf8'),
          documentCount: Math.max(1, Math.ceil(textContent.split(/\s+/).length / 500)),
          deviceId,
        } as any,
      });
      return NextResponse.json({ knowledge });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file or text provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, TXT, MD, and DOCX are supported.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Read file content (no filesystem save - Vercel is read-only)
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text content
    let content = '';
    let hasImages = false;

    if (file.type === 'text/plain' || file.type === 'text/markdown') {
      content = buffer.toString('utf-8');
    } else if (file.type === 'application/pdf') {
      // Extract text from PDF automatically using pdf-parse
      console.log('Extracting text from PDF:', file.name);
      try {
        // Dynamic import to avoid webpack issues
        const pdfParse = (await import('pdf-parse-fork')).default;
        const pdfData = await pdfParse(buffer);
        content = pdfData.text;
        hasImages = pdfData.numpages > 0;
        console.log(`✅ PDF Extraction Results:`);
        console.log(`   - File: ${file.name}`);
        console.log(`   - Pages: ${pdfData.numpages}`);
        console.log(`   - Characters extracted: ${content.length}`);
        console.log(`   - First 200 chars: ${content.substring(0, 200)}`);

        // If extraction failed or resulted in empty text
        if (!content || content.trim().length < 50) {
          console.log('⚠️ PDF extraction resulted in minimal text');
          console.log(`   Raw content: "${content}"`);
          content = `📄 PDF Document: ${file.name}

⚠️ TEXT EXTRACTION FAILED - This PDF appears to be:
- Image-based (scanned document)
- Password protected
- Contains non-extractable content

The AI CANNOT read the content of this document.

Solutions:
1. Upload a text-based PDF instead
2. Use OCR software to convert the PDF to text
3. Copy and paste the text content manually

File Details:
- File: ${file.name}
- Pages: ${pdfData.numpages}
- Size: ${(file.size / 1024).toFixed(2)} KB
- Characters extracted: ${content.length}`;
        }
      } catch (error) {
        console.error('PDF extraction error:', error);
        content = `📄 PDF Document: ${file.name}

⚠️ Text extraction failed. This might be an image-based PDF or encrypted.

You can manually add the content by clicking the edit/pencil icon on this document.

File Details:
- File: ${file.name}
- Size: ${(file.size / 1024).toFixed(2)} KB
- Uploaded: ${new Date().toISOString()}`;
        hasImages = true;
      }
    } else {
      content = `Document: ${file.name}

This file type may not contain extractable text. Please provide the content manually if you want the AI to reference it.`;
    }

    // Count chunks (simple word count / 500)
    const wordCount = content.split(/\s+/).length;
    const documentCount = Math.max(1, Math.ceil(wordCount / 500));

    // Save to database (no filePath since Vercel filesystem is read-only)
    const knowledge = await db.knowledge.create({
      data: {
        name: file.name,
        content: content.substring(0, 50000), // Limit content length
        originalFilename: file.name,
        filePath: null, // No file saved on Vercel
        fileType: file.type,
        fileSize: file.size,
        documentCount,
        hasImages,
        deviceId,
      } as any,
    });

    console.log('💾 Saved to database:');
    console.log(`   - ID: ${knowledge.id}`);
    console.log(`   - Name: ${knowledge.name}`);
    console.log(`   - Content length: ${(knowledge as any).content?.length || 0}`);
    console.log(`   - Document count: ${documentCount}`);

    return NextResponse.json({ knowledge });
  } catch (error) {
    console.error('Error uploading knowledge:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
