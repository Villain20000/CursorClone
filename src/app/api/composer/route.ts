import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    system: `You are the Cursor Composer AI. Your job is to propose multi-file changes based on user instructions.
    Format your output as a list of changes:
    FILE: <filename>
    CONTENT:
    <new content>
    --- END OF FILE ---`,
    prompt: `Instruction: ${prompt}\n\nContext:\n${context}`,
  });

  return result.toDataStreamResponse();
}
