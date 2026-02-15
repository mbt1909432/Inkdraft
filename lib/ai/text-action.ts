/**
 * AI text actions (polish, expand, shrink, translate, summarize, correct).
 * Uses Tool Call (output_text_result) for stable structured output.
 */

import { getLLMConfig } from '@/lib/llm/config';
import {
  createOpenAIClient,
  chatCompletion,
  getTextActionToolSchema,
} from '@/lib/llm/openai-client';

export type TextActionType =
  | 'polish'
  | 'expand'
  | 'shrink'
  | 'translate'
  | 'summarize'
  | 'correct';

const ACTION_SYSTEM_PROMPT = `You are a text processing assistant. You must output the result by calling the output_text_result tool with the "result" parameter. Do not output the result in your message text. Put only the final text in the tool's result parameter.

Format: If the input is a Markdown heading (starts with one or more #), keep the same number of # in output and do not add extra. For "polish" you must actually refine the wording—do not return the input unchanged; the text after # may be rephrased to be more fluent or refined.

Markdown: Headings (## or ### etc.) must be on their own line. Always put a blank line before a heading line so that the line starts with #. Do not put ## or ### at the end of a paragraph (e.g. wrong: "...根源。## 爷爷的影响"; correct: "...根源。\\n\\n## 爷爷的影响").`;

const ACTION_USER_PROMPTS: Record<
  TextActionType,
  (text: string, options?: { targetLang?: string }) => string
> = {
  polish: (text) =>
    `请对以下内容进行润色，保持原意，使表达更流畅、得体。必须对文字做实际润色，不要原样返回。若原文是 Markdown 标题（以 # 开头），输出时保持相同数量的 #，但 # 后面的标题文字可以改写得更精炼或得体。重要：标题行（##、### 等）必须单独占一行，标题前要有空行，不要把 ## 或 ### 写在段落末尾（错误示例：句号后直接写 ## 标题；正确：先换行再空一行，再写 ## 标题）。完成后必须调用 output_text_result，将润色后的正文放入 result 参数。\n\n"""\n${text}\n"""`,
  expand: (text) =>
    `请将以下内容适度扩写，增加细节或展开说明，保持风格一致。完成后必须调用 output_text_result，将扩写后的正文放入 result 参数。\n\n"""\n${text}\n"""`,
  shrink: (text) =>
    `请将以下内容缩写为更简洁的表述，保留核心意思。完成后必须调用 output_text_result，将缩写后的正文放入 result 参数。\n\n"""\n${text}\n"""`,
  translate: (text, options) => {
    const target = options?.targetLang ?? '英文';
    return `请将以下内容翻译成${target}。完成后必须调用 output_text_result，将翻译结果放入 result 参数。\n\n"""\n${text}\n"""`;
  },
  summarize: (text) =>
    `请用一两句话总结以下内容的核心意思。完成后必须调用 output_text_result，将总结放入 result 参数。\n\n"""\n${text}\n"""`,
  correct: (text) =>
    `请修正以下文字中的错别字和明显语法错误，保持原意和风格。完成后必须调用 output_text_result，将修正后的正文放入 result 参数。\n\n"""\n${text}\n"""`,
};

const MAX_TEXT_LENGTH = 15000;
const LOG_TAG = '[llm/text-action]';

export async function runTextAction(
  action: TextActionType,
  text: string,
  options?: { targetLang?: string }
): Promise<string> {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is required');
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Text is required');
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text is too long. Maximum ${MAX_TEXT_LENGTH} characters.`);
  }

  console.log(LOG_TAG, 'Run', { action, textLen: trimmed.length, options });
  const config = getLLMConfig();
  const client = createOpenAIClient(config);
  const tools = getTextActionToolSchema();
  const userContent = ACTION_USER_PROMPTS[action](trimmed, options);

  const { message, toolCalls } = await chatCompletion(
    client,
    [
      { role: 'system', content: ACTION_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    config,
    tools,
    { forcedToolName: 'output_text_result', maxIterations: 3 }
  );

  const invocation = toolCalls?.find((t) => t.name === 'output_text_result');
  const fromTool = typeof invocation?.result === 'string';
  const result = fromTool
    ? String(invocation?.result ?? '').trim()
    : message?.trim();

  if (result == null || result === '') {
    console.warn(LOG_TAG, 'Empty result', { action, toolCallsCount: toolCalls?.length });
    throw new Error('No response from model');
  }
  console.log(LOG_TAG, 'Done', { action, resultLen: result.length, fromTool });
  return result;
}
