import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

const mockContextSearch = (query: string) => {
  return "Project context: This is a Cursor Clone project using Next.js and Monaco Editor.";
};

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    system: `You are an expert AI pair programmer. You are integrated into a Cursor-like IDE.
    You have access to the codebase context. Be concise, helpful, and provide code snippets when relevant.`,
    messages,
    tools: {
      searchCodebase: tool({
        description: 'Search the codebase for relevant context',
        parameters: z.object({
          query: z.string().describe('The search query'),
        }),
        // @ts-ignore
        execute: async ({ query }: { query: string }) => ({
          results: mockContextSearch(query),
        }),
      }),
      readFile: tool({
        description: 'Read the contents of a file',
        parameters: z.object({
          path: z.string().describe('The path to the file'),
        }),
        // @ts-ignore
        execute: async ({ path }: { path: string }) => ({
          content: `// Content of ${path} would be here`,
        }),
      }),
    },
  });

  // @ts-ignore
  return result.toDataStreamResponse();
}
