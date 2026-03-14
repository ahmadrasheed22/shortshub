import { google, youtube_v3 } from 'googleapis';
import { YouTubeChannel, YouTubeVideo, ShortsResponse } from './types';
import { handleApiError } from './errors';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export default youtube;

/**
 * Resolves a channel query (ID, @handle, URL, or name) into a YouTubeChannel object.
 */
export async function resolveChannel(query: string): Promise<YouTubeChannel | null> {
  try {
    // 1. Check if it's a channel ID (UC...)
    if (query.startsWith('UC') && query.length === 24) {
      const res = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        id: [query],
      });
      return (res.data.items?.[0] as YouTubeChannel) || null;
    }

    // 2. Check if it's a handle (@handle)
    if (query.startsWith('@')) {
      const res = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        forHandle: query.substring(1),
      });
      if (res.data.items?.[0]) return res.data.items[0] as YouTubeChannel;
    }

    // 3. Extract from URL
    const handleMatch = query.match(/youtube\.com\/(@[a-zA-Z0-9_-]+)/);
    if (handleMatch) {
      const res = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        forHandle: handleMatch[1].substring(1),
      });
      if (res.data.items?.[0]) return res.data.items[0] as YouTubeChannel;
    }

    const idMatch = query.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (idMatch) {
      const res = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        id: [idMatch[1]],
      });
      if (res.data.items?.[0]) return res.data.items[0] as YouTubeChannel;
    }

    // 4. Search by name
    const searchRes = await youtube.search.list({
      part: ['snippet'],
      q: query,
      type: ['channel'],
      maxResults: 1,
    });

    if (searchRes.data.items?.[0]?.snippet?.channelId) {
      const res = await youtube.channels.list({
        part: ['snippet', 'statistics', 'brandingSettings'],
        id: [searchRes.data.items[0].snippet.channelId],
      });
      return (res.data.items?.[0] as YouTubeChannel) || null;
    }

    return null;
  } catch (error) {
    console.error('Error in resolveChannel:', error);
    // Explicitly throw a sanitized error message
    throw new Error(handleApiError(error));
  }
}

/**
 * Fetches shorts for a given channel ID.
 */
export async function getShorts(
  channelId: string,
  after?: string,
  pageToken?: string
): Promise<ShortsResponse> {
  try {
    const params: youtube_v3.Params$Resource$Search$List = {
      part: ['snippet', 'id'],
      channelId,
      type: ['video'],
      videoDuration: 'short',
      order: 'date',
      maxResults: 20,
    };

    if (after) {
      params.publishedAfter = after;
    }
    if (pageToken) {
      params.pageToken = pageToken;
    }

    const res = await youtube.search.list(params);

    // Extract video IDs
    const videoIds = res.data.items
      ?.map(item => item.id?.videoId)
      .filter((id): id is string => !!id);

    if (!videoIds || videoIds.length === 0) {
      return { items: [], nextPageToken: null };
    }

    // Get detailed info for these videos (statistics and contentDetails)
    const videoDetails = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    return {
      items: (videoDetails.data.items as YouTubeVideo[]) || [],
      nextPageToken: res.data.nextPageToken || null,
    };
  } catch (error) {
    console.error('Error in getShorts:', error);
    // Explicitly throw a sanitized error message
    throw new Error(handleApiError(error));
  }
}
