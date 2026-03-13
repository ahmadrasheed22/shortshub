import ytdl from '@distube/ytdl-core';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;
    
    if (!videoId || !ytdl.validateID(videoId)) {
      return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Get video info first to check if it exists
    const info = await ytdl.getInfo(videoUrl);
    
    // Get the best format (prioritize 720p or 360p for Shorts)
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestvideo',
      filter: format => format.hasVideo && format.hasAudio 
    });

    if (!format) {
      return NextResponse.json({ error: 'No suitable format found' }, { status: 404 });
    }

    // Stream the video
    const videoStream = ytdl(videoUrl, { 
      format: format,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    });

    // Create a readable stream for Next.js
    const stream = new ReadableStream({
      start(controller) {
        videoStream.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        videoStream.on('end', () => {
          controller.close();
        });
        videoStream.on('error', (error) => {
          controller.error(error);
        });
      },
      cancel() {
        videoStream.destroy();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json({ 
      error: 'Failed to stream video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
