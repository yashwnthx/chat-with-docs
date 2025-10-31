import { streamText, createDataStreamResponse } from 'ai';
import { google } from '@ai-sdk/google';
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export const maxDuration = 60;

// Handle image generation requests using Gemini Imagen
async function handleImageGeneration(userPrompt: string, messages: any[], chatId: string | null) {
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
      chat = await prisma.chat.findUnique({ where: { id: chatId } });
    }

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          sessionId: nanoid(10),
          title: userPrompt.substring(0, 100),
        },
      });
    }

    // Save user message
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content: userPrompt,
        modelUsed: 'gemini-2.5-flash-image',
      },
    });

    // Save assistant message with image
    const responseText = `I've generated an image for you: "${imagePrompt}"\n\n![Generated Image](${savedImageUrl})`;
    await prisma.message.create({
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
    const { messages, chatId, knowledgeIds = [] } = body;

    console.log('Chat API called with:', { knowledgeIds, messageCount: messages?.length || 0 });

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No messages provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter out messages with system role from client (we'll add our own)
    const userMessages = messages.filter((m: any) => m.role !== 'system');
    console.log('User messages:', userMessages.length);

    // Check if this is an image generation request
    const lastMessage = userMessages[userMessages.length - 1]?.content || '';
    const isImageRequest = /^(generate|create|make|draw)(\s+an?|\s+me)?\s+(image|picture|photo|illustration|drawing)/i.test(lastMessage.trim()) ||
                          lastMessage.toLowerCase().includes('image of');

    if (isImageRequest && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.log('🎨 Detected image generation request');
      return await handleImageGeneration(lastMessage, userMessages, chatId);
    }

    // Always use gemini-2.5-flash for all text and document queries
    const model = 'gemini-2.5-flash';

    const hasKnowledge = knowledgeIds && knowledgeIds.length > 0;
    if (hasKnowledge) {
      console.log('📄 Document query, using: gemini-2.5-flash');
    } else {
      console.log('💬 Text query, using: gemini-2.5-flash');
    }

    // Get knowledge base context if knowledge IDs provided
    let systemPrompt = `You are a friendly, casual AI chatting via text message. Keep your responses conversational and natural, like you're texting a friend.

CRITICAL FORMATTING RULES - MUST FOLLOW:
- NEVER use asterisks (*) or double asterisks (**) for formatting
- NEVER use bullet points or numbered lists
- NEVER use markdown syntax of any kind
- NO bold, italic, or special formatting
- Write in plain text only, like a regular text message
- If listing things, just use natural paragraphs with line breaks between items
- Be conversational and casual, like texting a friend
- Use contractions and natural language

Example of good response:
"Hey! So here's what I found...

First thing is this really cool point about whatever.

Then there's also this other thing that's super important.

And lastly, this final bit wraps it all up nicely!"

NEVER format like this:
"**Key Points:**
* Point one
* Point two"`;

    let knowledgeSourceNames: string[] = [];

    if (knowledgeIds.length > 0) {
      console.log('Loading knowledge bases:', knowledgeIds);
      const knowledge = await prisma.knowledge.findMany({
        where: { id: { in: knowledgeIds }, isActive: true },
      });
      console.log('Found knowledge bases:', knowledge.length);

      if (knowledge.length > 0) {
        // Store source names for later
        knowledgeSourceNames = knowledge.map(kb => kb.name);

        const knowledgeContext = knowledge
          .map(kb => {
            // Get full content or first 10000 characters for better context
            const content = (kb as any).content || '';
            console.log(`📄 Document "${kb.name}": ${content.length} chars`);

            if (content.length < 100) {
              console.log(`⚠️  WARNING: Document has very little content (${content.length} chars)`);
              console.log(`   Content preview: "${content}"`);
            }

            return `Document: ${kb.name}\n${content.substring(0, 10000)}${content.length > 10000 ? '...' : ''}`;
          })
          .join('\n\n---\n\n');

        systemPrompt = `You are a friendly, casual AI chatting via text message. Keep your responses conversational and natural, like you're texting a friend.

You have access to these documents:

${knowledgeContext}

CRITICAL FORMATTING RULES - MUST FOLLOW:
- NEVER use asterisks (*) or double asterisks (**) for formatting
- NEVER use bullet points or numbered lists
- NEVER use markdown syntax of any kind
- NO bold, italic, or special formatting
- Write in plain text only, like a regular text message
- Answer questions using info from the documents naturally
- If listing things, just use natural paragraphs with line breaks
- Be conversational and casual, like texting a friend
- NO citations or file names in your response
- The system will show which documents were used separately

Example of good response:
"Hey! So from what I found, here's the deal...

The main thing is this really important point that came up.

Also worth noting is this other aspect that matters.

And that pretty much covers it!"

NEVER format like this:
"**Key Points:**
* Point one
* Point two"`;
        console.log('📋 System prompt length:', systemPrompt.length, 'characters');
      }
    }

    // Prepare messages with system message at the start
    const enhancedMessages = [
      { role: 'system', content: systemPrompt },
      ...userMessages,
    ];

    console.log('Enhanced messages:', enhancedMessages.map((m: any) => ({ role: m.role, contentLength: m.content?.length || 0 })));

    // Use Gemini for all text generation
    console.log('Using Gemini model:', model);
    const aiModel = google(model);

    console.log('Calling AI with', enhancedMessages.length, 'messages');

    // Stream the response
    const result = streamText({
      model: aiModel,
      messages: enhancedMessages,
      temperature: 0.7,
      maxTokens: 4096, // Increased from 2048 to allow longer responses
    });

    console.log('✅ Stream created successfully');

    // Save chat and messages to database
    const userMessage = userMessages[userMessages.length - 1];

    let chat: any;
    if (chatId) {
      chat = await prisma.chat.findUnique({ where: { id: chatId } });
    }

    if (!chat) {
      // Create new chat with unique session ID for sharing
      chat = await prisma.chat.create({
        data: {
          sessionId: nanoid(10),
          title: userMessage.content.substring(0, 100),
        },
      });

      // Link knowledge bases to chat
      if (knowledgeIds.length > 0) {
        await prisma.knowledgeOnChat.createMany({
          data: knowledgeIds.map((kbId: string) => ({
            chatId: chat.id,
            knowledgeId: kbId,
          })),
        });
      }
    }

    // Save user message
    await prisma.message.create({
      data: {
        chatId: chat.id,
        role: 'user',
        content: userMessage.content,
        modelUsed: model,
      },
    });

    // Save assistant message (will be updated as it streams)
    const assistantMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        role: 'assistant',
        content: '',
        modelUsed: model,
        sources: knowledgeSourceNames.length > 0 ? JSON.stringify(knowledgeSourceNames) : null,
      },
    });

    // Update chat timestamp
    await prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    // Save the full response in the background
    // We need to consume the stream to get the full text
    (async () => {
      try {
        const fullText = await result.text;
        if (fullText && fullText.trim()) {
          await prisma.message.update({
            where: { id: assistantMessage.id },
            data: {
              content: fullText.trim(),
              sources: knowledgeSourceNames.length > 0 ? JSON.stringify(knowledgeSourceNames) : null,
            },
          });
          console.log('✅ Message saved to database:', fullText.length, 'chars');
          if (knowledgeSourceNames.length > 0) {
            console.log('📚 Sources:', knowledgeSourceNames.join(', '));
          }
        }
      } catch (err) {
        console.error('❌ Error saving message:', err);
      }
    })();

    // Return the streaming response
    return result.toDataStreamResponse({
      headers: {
        'X-Chat-Id': chat.id,
        'X-Sources': knowledgeSourceNames.length > 0 ? JSON.stringify(knowledgeSourceNames) : '',
      },
    });
  } catch (error: any) {
    console.error('❌ Chat API error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
    });

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
