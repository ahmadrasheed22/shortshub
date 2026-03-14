import ytdl from '@distube/ytdl-core';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';

/**
 * API route to stream a YouTube video.
 * Uses @distube/ytdl-core for bypass.
 * Provides necessary headers for video seeking and browser compatibility.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  try {
    if (!videoId || !ytdl.validateID(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Get info with updated headers
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    });

    // Select best muxed format
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: (f) => f.hasVideo && f.hasAudio && f.container === 'mp4'
    }) || ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: (f) => f.hasVideo && f.hasAudio
    });

    if (!format) {
      return NextResponse.json({ error: 'No suitable streaming format found' }, { status: 404 });
    }

    const videoStream = ytdl(videoUrl, { format });

    const stream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        videoStream.on('end', () => {
          controller.close();
        });
        videoStream.on('error', (err) => {
          console.error('Stream playback error:', err);
          controller.error(err);
        });
      },
      cancel() {
        videoStream.destroy();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': format.mimeType?.split(';')[0] || 'video/mp4',
        'Content-Length': format.contentLength || '',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    const message = handleApiError(error);
    console.error(`Stream API Error [${videoId}]:`, message);

    if (message.includes('quota') || message.includes('Forbidden') || message.includes('403')) {
      return NextResponse.json({ error: 'YouTube restricted access to this video stream.' }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
