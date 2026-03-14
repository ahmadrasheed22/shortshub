import { NextRequest, NextResponse } from 'next/server';
import { resolveChannel } from '@/lib/youtube';
import { handleApiError } from '@/lib/errors';

/**
 * API route to resolve a YouTube channel from a query (handle, ID, URL, or name).
 * Proper error handling with sanitization for quota limits and HTML tags.
 */
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
  } catch (error) {
    const message = handleApiError(error);
    console.error('Channel Resolve API Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
