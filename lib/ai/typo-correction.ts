interface TypoSuggestion {
  original: string;
  suggestions: string[];
  message: string;
  offset: number;
  length: number;
}

interface TypoCheckResponse {
  typos: TypoSuggestion[];
}

interface LLMTypoResponse {
  typos: Array<{
    word: string;
    suggestions: string[];
    explanation: string;
  }>;
}

/**
 * Check text for typos using LLM API
 */
export async function checkTypos(text: string): Promise<TypoCheckResponse> {
  const endpoint = process.env.OPENAI_LLM_ENDPOINT;
  const apiKey = process.env.OPENAI_LLM_API_KEY;
  const model = process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini';

  // If no LLM config, fall back to dictionary-based check
  if (!endpoint || !apiKey) {
    return checkTyposWithDictionary(text);
  }

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a professional spelling and grammar checker. Your task is to identify typos, misspellings, and grammatical errors in the given text.

For each error found, return:
- word: the incorrect word/phrase
- suggestions: array of corrections (max 3)
- explanation: brief explanation in Chinese

Rules:
1. Only flag clear errors (typos, misspellings, wrong grammar)
2. Don't flag proper nouns, names, or technical terms
3. Don't flag stylistic choices
4. Be conservative - when in doubt, don't flag
5. Return empty array if no errors found

Respond ONLY with valid JSON in this exact format:
{
  "typos": [
    {"word": "错误词", "suggestions": ["正确词"], "explanation": "解释"}
  ]
}`,
          },
          {
            role: 'user',
            content: `Check this text for typos and errors:\n\n${text.slice(0, 3000)}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('LLM API error:', response.status);
      return checkTyposWithDictionary(text);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return checkTyposWithDictionary(text);
    }

    // Parse LLM response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return checkTyposWithDictionary(text);
    }

    const llmResult: LLMTypoResponse = JSON.parse(jsonMatch[0]);

    // Convert LLM response to our format with offsets
    const typos: TypoSuggestion[] = [];
    const lowerText = text.toLowerCase();

    for (const typo of llmResult.typos || []) {
      const lowerWord = typo.word.toLowerCase();
      let searchStart = 0;
      let found = false;

      // Find all occurrences of the typo word
      while (!found) {
        const index = lowerText.indexOf(lowerWord, searchStart);
        if (index === -1) break;

        // Verify exact match (not part of another word)
        const beforeChar = index > 0 ? text[index - 1] : ' ';
        const afterChar = index + typo.word.length < text.length ? text[index + typo.word.length] : ' ';

        if (/[\s.,!?;:'"()\[\]{}]/.test(beforeChar) && /[\s.,!?;:'"()\[\]{}]/.test(afterChar)) {
          typos.push({
            original: text.slice(index, index + typo.word.length),
            suggestions: typo.suggestions.slice(0, 3),
            message: typo.explanation,
            offset: index,
            length: typo.word.length,
          });
          found = true;
        }
        searchStart = index + 1;
      }
    }

    return { typos };
  } catch (error) {
    console.error('LLM typo check error:', error);
    return checkTyposWithDictionary(text);
  }
}

/**
 * Fallback: Dictionary-based typo check
 */
async function checkTyposWithDictionary(text: string): Promise<TypoCheckResponse> {
  const commonTypos: Record<string, string[]> = {
    'teh': ['the'],
    'adn': ['and'],
    'taht': ['that'],
    'wiht': ['with'],
    'thier': ['their'],
    'recieve': ['receive'],
    'occured': ['occurred'],
    'seperate': ['separate'],
    'definately': ['definitely'],
    'occassion': ['occasion'],
    'accomodate': ['accommodate'],
    'acheive': ['achieve'],
    'accross': ['across'],
    'beleive': ['believe'],
    'collegue': ['colleague'],
    'comming': ['coming'],
    'commitee': ['committee'],
    'completly': ['completely'],
    'diffrent': ['different'],
    'embarass': ['embarrass'],
    'enviroment': ['environment'],
    'exagerate': ['exaggerate'],
    'finaly': ['finally'],
    'foriegn': ['foreign'],
    'freind': ['friend'],
    'goverment': ['government'],
    'grammer': ['grammar'],
    'happend': ['happened'],
    'immediatly': ['immediately'],
    'independant': ['independent'],
    'knowlege': ['knowledge'],
    'neccessary': ['necessary'],
    'noticable': ['noticeable'],
    'oportunity': ['opportunity'],
    'paralel': ['parallel'],
    'posession': ['possession'],
    'recomend': ['recommend'],
    'relevent': ['relevant'],
    'remeber': ['remember'],
    'succesful': ['successful'],
    'suprise': ['surprise'],
    'tommorow': ['tomorrow'],
    'tounge': ['tongue'],
    'truley': ['truly'],
    'unfortunatly': ['unfortunately'],
    'unneccessary': ['unnecessary'],
    'wierd': ['weird'],
    'writting': ['writing'],
    // Chinese common typos
    '的地得': ['的地得用法需要检查'],
    '做作': ['做/作用法需要检查'],
  };

  const typos: TypoSuggestion[] = [];
  const words = text.split(/(\s+|[.,!?;:'"()\[\]{}])/);

  let offset = 0;
  for (const word of words) {
    if (!word.trim() || /^[.,!?;:'"()\[\]{}]+$/.test(word)) {
      offset += word.length;
      continue;
    }

    const lowerWord = word.toLowerCase();
    if (commonTypos[lowerWord]) {
      typos.push({
        original: word,
        suggestions: commonTypos[lowerWord],
        message: `Did you mean "${commonTypos[lowerWord][0]}"?`,
        offset,
        length: word.length,
      });
    }

    offset += word.length;
  }

  return { typos };
}

/**
 * Apply a typo correction to text
 */
export function applyCorrection(
  text: string,
  typo: TypoSuggestion,
  suggestion: string
): string {
  return (
    text.slice(0, typo.offset) +
    suggestion +
    text.slice(typo.offset + typo.length)
  );
}
