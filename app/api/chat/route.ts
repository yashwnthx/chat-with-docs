import { streamText, createDataStreamResponse } from 'ai';
import { google } from '@ai-sdk/google';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// System device ID for pre-trained modules
const SYSTEM_DEVICE_ID = 'system-training';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export const maxDuration = 60;

// Handle image generation requests using Gemini Imagen
async function handleImageGeneration(userPrompt: string, messages: any[], chatId: string | null, deviceId: string) {
  try {
    // Extract the actual image description from the prompt
    let imagePrompt = userPrompt;
    const patterns = [
      /(?:generate|create|make|draw)(?:\s+an?|\s+me)?\s+(?:image|picture|photo|illustration|drawing)\s+of\s+(.+)/i,
      /(?:generate|create|make|draw)(?:\s+an?|\s+me)?\s+(?:image|picture|photo|illustration|drawing)\s*:\s*(.+)/i,
      /image of\s+(.+)/i,
    ];

    for (const pattern of patterns) {
      const match = userPrompt.match(pattern);
      if (match && match[1]) {
        imagePrompt = match[1].trim();
        break;
      }
    }

    console.log('Generating image with Gemini 2.5 Flash Image (nano banana):', imagePrompt);

    // Generate image using Gemini 2.5 Flash Image model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image-preview',
    });

    // Generate image - gemini-2.5-flash-image-preview uses simple prompt format
    const result = await model.generateContent(imagePrompt);

    const response = result.response;

    // Check if there's an image in the response
    const imagePart = response.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image data returned from Gemini');
    }

    // Save the base64 image
    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const fileName = `${nanoid()}.png`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'generated');

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }

    const filePath = join(uploadDir, fileName);
    await writeFile(filePath, imageBuffer);

    const savedImageUrl = `/uploads/generated/${fileName}`;
    console.log('✅ Image generated with Gemini:', savedImageUrl);

    // Save to database
    let chat: any;
    if (chatId) {
      chat = await db.chat.findUnique({ where: { id: chatId } });
    }

    if (!chat) {
      chat = await db.chat.create({
        data: {
          sessionId: nanoid(10),
          title: userPrompt.substring(0, 100),
          deviceId,
        },
      });
    }

    // Save user message
    await db.message.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content: userPrompt,
        modelUsed: 'gemini-2.5-flash-image',
      },
    });

    // Save assistant message with image
    const responseText = `I've generated an image for you: "${imagePrompt}"\n\n![Generated Image](${savedImageUrl})`;
    await db.message.create({
      data: {
        chatId: chat.id,
        role: 'assistant',
        content: responseText,
        modelUsed: 'gemini-2.5-flash-image',
        imageUrl: savedImageUrl,
      },
    });

    // Return as streaming response for consistency with useChat hook
    return createDataStreamResponse({
      execute: async (dataStream) => {
        dataStream.writeData({
          imageUrl: savedImageUrl,
        });
        dataStream.writeMessageAnnotation({
          imageUrl: savedImageUrl,
        });
        // Note: responseText is already included in the stream via the execute function
      },
      onError: (error) => {
        console.error('Stream error:', error);
        return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      },
      headers: {
        'X-Chat-Id': chat.id,
      },
    });

  } catch (error: any) {
    console.error('❌ Image generation error:', error);

    // Check if it's a rate limit error
    const is429 = error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('rate limit');
    const errorMessage = is429
      ? '🚫 Rate limit reached for image generation. The free tier has daily limits. Please try again later or upgrade your API plan.'
      : error?.message || 'Unknown error occurred';

    const statusCode = is429 ? 429 : 500;

    return new Response(
      JSON.stringify({
        error: 'Failed to generate image',
        details: errorMessage,
      }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, chatId, deviceId, language = 'english' } = body;

    // Validate deviceId
    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'Device ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter out messages with system role from client (we'll add our own)
    const userMessages = messages.filter((m: any) => m.role !== 'system');

    // Check if this is an image generation request
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    const isImageRequest = /^(generate|create|make|draw)(\s+an?|\s+me)?\s+(image|picture|photo|illustration|drawing)/i.test(lastMessage.trim()) ||
                          lastMessage.toLowerCase().includes('image of');

    if (isImageRequest && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return await handleImageGeneration(lastMessage, userMessages, chatId, deviceId);
    }

    // Always use gemini-2.5-flash for all text and document queries
    const model = 'gemini-2.5-flash';

    // Language instructions
    const languageInstruction = language === 'hindi'
      ? `IMPORTANT: You MUST respond ONLY in Hindi (हिंदी). Use Devanagari script throughout your response. Do not mix English words unless they are technical terms that have no Hindi equivalent.`
      : `IMPORTANT: You MUST respond ONLY in English. Do not use Hindi or any other language.`;

    // Get knowledge base context - load system-trained documents
    let systemPrompt = `You are Didi Sakhi, a helpful AI assistant specialized in village development, Panchayati Raj, and rural governance in India.

You have been trained on official government documents and modules. Answer questions based on this knowledge.

${languageInstruction}

Format your responses clearly:
- Use numbered lists for steps or multiple points
- Use **bold** for important terms
- Use bullet points for related items
- Keep paragraphs short and readable`;

    let knowledgeSourceNames: string[] = [];

    // Load all system-trained documents
    const knowledge = await db.knowledge.findMany({
      where: { deviceId: SYSTEM_DEVICE_ID, isActive: true },
    });

    if (knowledge.length > 0) {
      // Store source names for later
      knowledgeSourceNames = knowledge.map(kb => kb.name);

      const knowledgeContext = knowledge
        .map(kb => {
          const content = (kb as any).content || '';
          return `Document: ${kb.name}\n${content.substring(0, 10000)}${content.length > 10000 ? '...' : ''}`;
        })
        .join('\n\n---\n\n');

      systemPrompt = `You are Didi Sakhi, a helpful AI assistant specialized in village development, Panchayati Raj, and rural governance in India.

You have been trained on these official government documents. Each document has [PAGE X] markers to help you identify page numbers:

${knowledgeContext}

${languageInstruction}

IMPORTANT INSTRUCTIONS:
1. Answer questions based ONLY on the information in these documents
2. Format your responses clearly with proper structure:
   - Use numbered lists (1. 2. 3.) for sequential steps
   - Use bullet points for related items
   - Use **bold** for key terms and important concepts
   - Keep paragraphs concise
3. At the VERY END of your response, on a new line, cite your sources in this EXACT format:
   <<SOURCE: Document Name | Page X>>
   Or for multiple pages: <<SOURCE: Document Name | Pages X, Y, Z>>
   Or for multiple documents: <<SOURCE: Doc1 | Page X>> <<SOURCE: Doc2 | Pages Y, Z>>
   - Include the ACTUAL page number(s) where you found the information
   - Look for [PAGE X] markers in the document content to find page numbers
   - Do NOT mention sources anywhere else in your response
4. If the question is not covered in the documents, politely say so and do not include a SOURCE tag

Be helpful and accurate.`;
    }

    // Prepare messages with system message at the start
    const enhancedMessages = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    // Use Gemini for text generation
    const aiModel = google(model);

    // Save chat and messages to database BEFORE streaming
    const userMessage = userMessages[userMessages.length - 1];

    let chat: any;
    if (chatId) {
      chat = await db.chat.findUnique({ where: { id: chatId } });
    }

    if (!chat) {
      // Create new chat with unique session ID for sharing
      chat = await db.chat.create({
        data: {
          sessionId: nanoid(10),
          title: userMessage.content.substring(0, 100),
          deviceId,
        },
      });
    }

    // Save user message
    await db.message.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content: userMessage.content,
        modelUsed: model,
      },
    });

    // Save assistant message placeholder
    const assistantMessage = await db.message.create({
      data: {
        chatId: chat.id,
        role: 'assistant',
        content: '',
        modelUsed: model,
        sources: knowledgeSourceNames.length > 0 ? JSON.stringify(knowledgeSourceNames) : null,
      },
    });

    // Update chat timestamp
    await db.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    // Stream the response with onFinish to save complete text
    const result = streamText({
      model: aiModel,
      messages: enhancedMessages,
      temperature: 0.7,
      maxTokens: 4096,
      async onFinish({ text }) {
        // Save the complete response after streaming finishes
        try {
          if (text && text.trim()) {
            await db.message.update({
              where: { id: assistantMessage.id },
              data: {
                content: text.trim(),
                sources: knowledgeSourceNames.length > 0 ? JSON.stringify(knowledgeSourceNames) : null,
              },
            });
          }
        } catch (err) {
          console.error('Error saving message:', err);
        }
      },
    });

    // Return the streaming response
    return result.toDataStreamResponse({
      headers: {
        'X-Chat-Id': chat.id,
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        details: error?.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
