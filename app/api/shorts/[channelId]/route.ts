import { NextRequest, NextResponse } from 'next/server';
import { getShorts } from '@/lib/youtube';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const { searchParams } = new URL(req.url);
  const after = searchParams.get('after') || undefined;
  const pageToken = searchParams.get('pageToken') || undefined;

  try {
    const data = await getShorts(channelId, after, pageToken);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Shorts Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch shorts' }, { status: 500 });
  }
}
