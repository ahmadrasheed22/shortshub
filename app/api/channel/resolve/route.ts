import { NextRequest, NextResponse } from 'next/server';
import { resolveChannel } from '@/lib/youtube';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const channel = await resolveChannel(q);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    return NextResponse.json(channel);
  } catch (error: any) {
    console.error('Resolve Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to resolve channel' }, { status: 500 });
  }
}
