/**
 * Xiaohongshu-related OpenAI function calling tools
 */

import type OpenAI from 'openai';

// Tool schema for outputting xiaohongshu content
export const OUTPUT_XIAOHONGSHU_SCHEMA: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'output_xiaohongshu',
    description:
      'Output the generated Xiaohongshu card content. Call this when you have finished generating content for a Xiaohongshu-style social media post. Generate 3-6 cards with different content segments.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Eye-catching title for the post, 15-25 characters, should include emojis',
        },
        tags: {
          type: 'array',
          description: '3-5 relevant hashtag topics',
          items: {
            type: 'string',
          },
        },
        cards: {
          type: 'array',
          description: 'Array of content cards (3-6 cards), each containing a segment of the content',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Content segment for this card, with emojis, 50-100 characters',
              },
            },
            required: ['content'],
          },
        },
      },
      required: ['title', 'tags', 'cards'],
    },
  },
};

export function getXiaohongshuToolSchema(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return [OUTPUT_XIAOHONGSHU_SCHEMA];
}

// Type for a single card
export interface XiaohongshuCard {
  content: string;
}

// Type for the output_xiaohongshu tool arguments
export interface OutputXiaohongshuArgs {
  title: string;
  tags: string[];
  cards: XiaohongshuCard[];
}

// Parse xiaohongshu content from tool call arguments
export function parseXiaohongshuFromArgs(args: OutputXiaohongshuArgs) {
  return {
    title: args.title,
    tags: args.tags,
    cards: args.cards,
  };
}
