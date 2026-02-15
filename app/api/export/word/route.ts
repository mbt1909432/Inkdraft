import { NextResponse } from 'next/server';
import { buildWordBuffer } from '@/lib/export/markdown-to-docx-server';

export async function POST(request: Request) {
  try {
    let body: { title?: string; content?: string } = {};
    try {
      const raw = await request.text();
      console.log('[export/word] raw body length:', raw?.length ?? 0);
      if (raw) body = JSON.parse(raw) as { title?: string; content?: string };
    } catch (parseErr) {
      console.error('[export/word] body parse error:', parseErr);
      body = {};
    }
    const title = typeof body.title === 'string' ? body.title.trim() : 'document';
    const content = typeof body.content === 'string' ? body.content : '';
    console.log('[export/word] title:', title, 'content length:', content.length, 'hasDataImage:', content.includes('data:image'));

    const buffer = await buildWordBuffer(content);
    const filename = (title.endsWith('.docx') ? title : `${title}.docx`).replace(/[^\w\u4e00-\u9fff.-]/g, '_');

    console.log('[export/word] docx buffer size:', buffer.length);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[export/word] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
