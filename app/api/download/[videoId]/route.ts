import ytdl from '@distube/ytdl-core';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/errors';

/**
 * API route to download a YouTube video.
 * Uses @distube/ytdl-core to bypass standard restrictions.
 * Implements proper headers for file downloading and error handling.
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

    // Get video info with a modern User-Agent
    const info = await ytdl.getInfo(videoUrl, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    });

    // Clean title for filename
    const title = (info.videoDetails.title || 'video')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .substring(0, 50);

    const filename = `${title}-${videoId}.mp4`;

    // Choose the best quality format that has both video and audio
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestvideo',
      filter: 'videoandaudio'
    });

    if (!format) {
      return NextResponse.json({ error: 'No suitable format found' }, { status: 404 });
    }

    const videoStream = ytdl(videoUrl, { format });

    // Stream the data directly to the user
    const stream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        videoStream.on('end', () => {
          controller.close();
        });
        videoStream.on('error', (err) => {
          console.error('Download stream error:', err);
          controller.error(err);
        });
      },
      cancel() {
        videoStream.destroy();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': format.contentLength || '',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    const message = handleApiError(error);
    console.error(`Download API Error [${videoId}]:`, message);

    // Specific check for YouTube restrictions (403/Forbidden)
    if (message.includes('quota') || message.includes('Forbidden') || message.includes('403')) {
      return NextResponse.json({
        error: 'YouTube is blocking the request. The quota might be exceeded or this video is restricted.'
      }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
