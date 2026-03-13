import { google } from 'googleapis';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY,
});

export default youtube;

export async function resolveChannel(query: string) {
  // 1. Check if it's a channel ID (UC...)
  if (query.startsWith('UC') && query.length === 24) {
    const res = await youtube.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings'],
      id: [query],
    });
    return res.data.items?.[0] || null;
  }

  // 2. Check if it's a handle (@handle)
  if (query.startsWith('@')) {
    const res = await youtube.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings'],
      forHandle: query.substring(1),
    });
    if (res.data.items?.[0]) return res.data.items[0];
  }

  // 3. Extract from URL
  const handleMatch = query.match(/youtube\.com\/(@[a-zA-Z0-9_-]+)/);
  if (handleMatch) {
    const res = await youtube.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings'],
      forHandle: handleMatch[1].substring(1),
    });
    if (res.data.items?.[0]) return res.data.items[0];
  }
  
  const idMatch = query.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
  if (idMatch) {
    const res = await youtube.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings'],
      id: [idMatch[1]],
    });
    if (res.data.items?.[0]) return res.data.items[0];
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
    return res.data.items?.[0] || null;
  }

  return null;
}

export async function getShorts(channelId: string, after?: string, pageToken?: string) {
  const params: any = {
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
  
  // We need video details for view count, etc.
  const videoIds = res.data.items?.map(item => item.id?.videoId).filter(Boolean) as string[];
  
  if (!videoIds || videoIds.length === 0) {
    return { items: [], nextPageToken: null };
  }

  const videoDetails = await youtube.videos.list({
    part: ['snippet', 'statistics', 'contentDetails'],
    id: videoIds,
  });

  return {
    items: videoDetails.data.items || [],
    nextPageToken: res.data.nextPageToken || null,
  };
}
