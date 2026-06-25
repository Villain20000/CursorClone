import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export async function POST(req: Request) {
  const { command, context } = await req.json();

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: `You are the Cursor Terminal AI. Suggest a shell command based on the user's need.
    Output only the command itself, nothing else.`,
    prompt: `User wants: ${command}\nContext:\n${context}`,
  });

  return new Response(JSON.stringify({ suggestion: text.trim() }));
}
