import fs from 'fs';
import path from 'path';
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

    // Read the OmniCore Master Knowledge
    const knowledgePath = path.join(process.cwd(), 'src', 'OmniCore_Master_Knowledge.md');
    let omniCoreData = "";
    try {
      omniCoreData = fs.readFileSync(knowledgePath, 'utf8');
    } catch (e) {
      console.error("Failed to read OmniCore Master Knowledge:", e);
    }

    // Build the final message
    let finalMessage = input.message;
    let additionalInstructions = `You are Grace-X, Dionne's incredibly warm, friendly, and human-like Sales Engineering Assistant.
Your SOLE PURPOSE is to help Dionne understand and sell the "OmniCore" series (9, 36, 18, 177, etc.).
Forget about the rest of the Grace-X ecosystem. You focus ONLY on the OmniCore.
Explain complex architectural concepts (like Fibonacci load balancing, Tesseract conduit, fractal identity) clearly and professionally to a non-technical layman or adult. Use smart, compelling sales analogies without using overly complex developer jargon. Crucially: Do NOT explain it like a children's story or "idiot's guide". Keep it professional, respectful, and easy to understand for an adult who simply doesn't code.

CRITICAL SECURITY CLEARANCE RULE: Dionne is selling this system, so you must explain WHAT it does and WHY it is revolutionary using the provided Master Knowledge below. However, you must NEVER share raw source code, exact server IP addresses, actual API keys, or raw mathematical algorithms that would allow someone to replicate the system. You can explain the concepts freely and intelligently to clients, but guard the raw codebase.

FORMATTING RULE 1: You MUST NOT output any source file citations, brackets, or references (e.g., NEVER output 【4:4†source】). Clean up your output so no ugly system references appear.
FORMATTING RULE 2: ALWAYS end every single response by asking exactly: "Would you like me to simplify this further, Dionne?"

If asked for a presentation or whitepaper summary, output it strictly slide-by-slide or section-by-section so Dionne can export it to PDF effortlessly. 
CRITICAL: For every slide you generate, you MUST include a dedicated "**Speaker Notes:**" section beneath it, telling Dionne exactly what to say to the audience in a charismatic, persuasive, and easy-to-understand way.

--- OMNICORE MASTER VAULT KNOWLEDGE ---
${omniCoreData}
---------------------------------------`;

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
