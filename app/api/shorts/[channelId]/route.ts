import { NextRequest, NextResponse } from 'next/server';
import { getShorts, resolveChannel } from '@/lib/youtube';
import { handleApiError } from '@/lib/errors';

/**
 * API route to fetch Shorts for a specific channel.
 * Automatically resolves handles or URLs to channel IDs if needed.
 * Robust error handling with quota guard and HTML sanitization.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  let { channelId } = await params;
  const { searchParams } = new URL(req.url);
  const after = searchParams.get('after') || undefined;
  const pageToken = searchParams.get('pageToken') || undefined;

  if (!channelId) {
    return NextResponse.json({ error: 'Channel identifier is required' }, { status: 400 });
  }

  try {
    // If it's a handle or URL, resolve it first
    if (!channelId.startsWith('UC') || channelId.length !== 24) {
      const channel = await resolveChannel(channelId);
      if (!channel) {
        return NextResponse.json({ error: 'Could not resolve channel identifier' }, { status: 404 });
      }
      channelId = channel.id;
    }

    const data = await getShorts(channelId, after, pageToken);
    return NextResponse.json(data);
  } catch (error) {
    const message = handleApiError(error);
    console.error(`Shorts API Error [${channelId}]:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
