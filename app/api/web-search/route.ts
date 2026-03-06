import { NextResponse } from 'next/server';
import { ProxyAgent } from 'undici';
import { fetch as undiciFetch } from 'undici';

interface DuckDuckGoResponse {
  Abstract: string;
  AbstractText: string;
  AbstractSource: string;
  AbstractURL: string;
  Image: string;
  Heading: string;
  RelatedTopics: Array<{
    Text: string;
    FirstURL: string;
    Icon?: { URL: string };
  }>;
  Results: Array<{
    Text: string;
    FirstURL: string;
    Icon?: { URL: string };
  }>;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// Get proxy agent from environment
function getProxyAgent(): ProxyAgent | undefined {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    console.log('[web-search] Using proxy:', proxyUrl);
    return new ProxyAgent(proxyUrl);
  }
  return undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 });
  }

  console.log('[web-search] Searching for:', query);

  try {
    // DuckDuckGo Instant Answer API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    try {
      const proxyAgent = getProxyAgent();

      const response = await undiciFetch(ddgUrl, {
        signal: controller.signal,
        dispatcher: proxyAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MarkdownEditor/1.0)',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }

      const data = await response.json() as DuckDuckGoResponse;
      const results: SearchResult[] = [];

      // Add abstract if available
      if (data.Abstract && data.AbstractURL) {
        results.push({
          title: data.Heading || data.AbstractSource || 'Summary',
          url: data.AbstractURL,
          snippet: data.AbstractText || data.Abstract,
          source: data.AbstractSource || 'DuckDuckGo',
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 5)) {
          if (topic.FirstURL && topic.Text) {
            // Extract title from text (usually in format "Title - Description")
            const parts = topic.Text.split(' - ');
            const title = parts[0] || 'Related';
            const snippet = parts.slice(1).join(' - ') || topic.Text;

            results.push({
              title,
              url: topic.FirstURL,
              snippet,
              source: new URL(topic.FirstURL).hostname,
            });
          }
        }
      }

      // Add results section
      if (data.Results) {
        for (const result of data.Results.slice(0, 3)) {
          if (result.FirstURL && result.Text) {
            results.push({
              title: result.Text,
              url: result.FirstURL,
              snippet: '',
              source: new URL(result.FirstURL).hostname,
            });
          }
        }
      }

      console.log('[web-search] Found', results.length, 'results');

      // If no results, return a helpful message
      if (results.length === 0) {
        return NextResponse.json({
          query,
          results: [],
          message: 'No instant answers found. Try a different query.',
        });
      }

      return NextResponse.json({
        query,
        results,
        rawAbstract: data.Abstract, // For AI to use directly
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Handle timeout or network errors gracefully
      if (fetchError instanceof Error && (fetchError.name === 'AbortError' || fetchError.message.includes('timeout'))) {
        console.log('[web-search] DuckDuckGo timeout, returning fallback');
        return NextResponse.json({
          query,
          results: [],
          message: 'Search timed out. DuckDuckGo API may be unavailable in your region.',
          fallback: true,
        });
      }

      throw fetchError;
    }
  } catch (error) {
    console.error('[web-search] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search',
        details: error instanceof Error ? error.message : 'Unknown error',
        results: [],
      },
      { status: 500 }
    );
  }
}
