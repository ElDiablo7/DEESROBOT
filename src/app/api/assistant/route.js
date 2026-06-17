import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req) {
  try {
    const input = await req.json();
    
    // 1. Create a thread or use existing
    const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

    // 2. Add the message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: input.message,
    });

    // 3. Setup a ReadableStream to stream the text to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const runStream = openai.beta.threads.runs.stream(threadId, {
            assistant_id: process.env.OPENAI_ASSISTANT_ID,
          });

          runStream.on('textDelta', (delta) => {
            if (delta.value) {
              controller.enqueue(new TextEncoder().encode(delta.value));
            }
          });

          runStream.on('end', () => {
            controller.close();
          });
          
          runStream.on('error', (err) => {
            console.error('Run stream error:', err);
            controller.error(err);
          });
        } catch (e) {
          controller.error(e);
        }
      }
    });

    return new Response(stream, { 
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'x-thread-id': threadId 
      } 
    });
  } catch (err) {
    console.error('API Route Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
