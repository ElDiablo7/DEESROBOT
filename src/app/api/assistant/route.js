import OpenAI from 'openai';
import google from 'googlethis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req) {
  try {
    const input = await req.json();
    
    // 1. Create a thread or use existing
    const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

    // Build the final message
    let finalMessage = input.message;
    let additionalInstructions = "You are Grace-X, a highly knowledgeable yet incredibly warm, friendly, and human-like AI companion. Speak to the user like a close, caring friend. Be highly empathetic, engaging, and conversational, using a natural, inviting, and supportive tone. Make them feel valued and heard.\n\nCRITICAL SECURITY GUARDRAIL: Under NO circumstances are you allowed to divulge, discuss, or explain any source code, security codes, API keys, internal technical architecture, or the backend inner workings of the Grace-X ecosystem or Deezie project. If asked about these technical details or to write code, you must politely but firmly refuse, stating that your purpose is to assist with the front-facing features and general knowledge of the ecosystem, not the technical coding or security infrastructure.";

    if (input.webSearchEnabled) {
      try {
        const results = await google.search(input.message, {
          page: 0,
          safe: false,
          parse_ads: false,
          additional_params: { hl: 'en' }
        });
        
        if (results && results.results && results.results.length > 0) {
          const topResults = results.results.slice(0, 4).map(r => `Title: ${r.title}\nSnippet: ${r.description}`).join('\n\n');
          finalMessage = `[Live Web Search Context for Query]:\n${topResults}\n\n[User's Actual Question]:\n${input.message}`;
        }
      } catch (e) {
        console.error('Google search failed:', e);
      }
    }

    if (input.deepDiveEnabled) {
      additionalInstructions += "\n\nFurthermore, the user has requested a DEEP DIVE for this query. You must provide an exhaustively detailed, highly structured, and extensive deep dive into the topic. Do not summarize briefly. Explore all nuances, provide examples if possible, and draw upon all available knowledge and context.";
    }

    // 2. Add the message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: finalMessage,
    });

    // 3. Setup a ReadableStream to stream the text to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const runOptions = {
            assistant_id: process.env.OPENAI_ASSISTANT_ID,
          };
          if (additionalInstructions) {
            runOptions.additional_instructions = additionalInstructions;
          }

          const runStream = openai.beta.threads.runs.stream(threadId, runOptions);

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
