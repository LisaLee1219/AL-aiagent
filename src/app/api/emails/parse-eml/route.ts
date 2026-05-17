import { NextRequest, NextResponse } from 'next/server';
import { ensureEnvLoaded } from '@/lib/env-loader';
import { parseEmlSource } from '@/lib/parse-eml';

export const runtime = 'nodejs';

const MAX_EML_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  await ensureEnvLoaded();

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing .eml file' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.eml')) {
      return NextResponse.json({ error: 'Only .eml files are supported' }, { status: 400 });
    }

    if (file.size > MAX_EML_BYTES) {
      return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const email = await parseEmlSource(buffer);

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error) {
    console.error('[parse-eml]', error);
    const message = error instanceof Error ? error.message : 'Failed to parse .eml file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
