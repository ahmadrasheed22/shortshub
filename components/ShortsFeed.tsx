'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import ShortCard from './ShortCard';
import VideoPlayer from './VideoPlayer';
import { useInView } from 'react-intersection-observer';
import { Loader2, Bell, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShortsFeedProps {
  channelId: string;
}

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function ShortsFeed({ channelId }: ShortsFeedProps) {
  const [videos, setVideos] = useState<any[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);

  const { ref, inView } = useInView();

  // Initial Fetch
  useEffect(() => {
    async function loadInitial() {
      try {
        const data = await fetcher(`/api/shorts/${channelId}`);
        setVideos(data.items);
        setNextPageToken(data.nextPageToken);
        if (data.items.length > 0) {
          setLastPublishedAt(data.items[0].snippet.publishedAt);
        }
      } catch (err) {
        console.error('Failed to load initial shorts');
      }
    }
    loadInitial();
  }, [channelId]);

  // Infinite Scroll Fetch
  useEffect(() => {
    if (inView && nextPageToken && !loadingMore) {
      loadMore();
    }
  }, [inView]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetcher(`/api/shorts/${channelId}?pageToken=${nextPageToken}`);
      setVideos(prev => [...prev, ...data.items]);
      setNextPageToken(data.nextPageToken);
    } catch (err) {
      console.error('Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }

  // Real-time Polling for New Shorts
  const { data: pollData } = useSWR(
    lastPublishedAt ? `/api/shorts/${channelId}?after=${lastPublishedAt}` : null,
    fetcher,
    { 
      refreshInterval: 8000, // 8 seconds
      compare: (a, b) => a?.items?.[0]?.id?.videoId === b?.items?.[0]?.id?.videoId
    }
  );

  useEffect(() => {
    if (pollData?.items && pollData.items.length > 0) {
      const newItems = pollData.items.filter(
        (newItem: any) => !videos.some(v => v.id === newItem.id)
      );
      
      if (newItems.length > 0) {
        setVideos(prev => [...newItems, ...prev]);
        setLastPublishedAt(newItems[0].snippet.publishedAt);
        setNewCount(prev => prev + newItems.length);
        
        // Browser Notification
        if (Notification.permission === 'granted') {
          new Notification('New Short uploaded!', {
            body: `${newItems[0].snippet.title}`,
            icon: newItems[0].snippet.thumbnails.default.url
          });
        }
      }
    }
  }, [pollData]);

  // Request Notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          Latest Shorts
          {newCount > 0 && (
            <span className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full animate-pulse">
              {newCount} NEW
            </span>
          )}
        </h2>
        
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Real-time polling active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {videos.length === 0 && !lastPublishedAt ? (
          // Initial skeletons
          [...Array(8)].map((_, i) => (
            <div key={i} className="aspect-[9/16] bg-zinc-900/50 rounded-2xl animate-pulse border border-white/5" />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {videos.map((video, idx) => (
              <ShortCard 
                key={video.id + idx} 
                video={video} 
                onPlay={setActiveVideo}
                isNew={idx < newCount}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {videos.length === 0 && !loadingMore && nextPageToken === null && (
        <div className="flex flex-col items-center justify-center py-20 text-white/20">
          <AlertCircle size={48} className="mb-4" />
          <p className="text-xl font-medium">No Shorts detected yet</p>
          <p className="text-sm">We'll keep watching for new uploads.</p>
        </div>
      )}

      {/* Loading State */}
      <div ref={ref} className="w-full flex justify-center py-10">
        {(loadingMore || nextPageToken) && (
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        )}
      </div>

      <VideoPlayer 
        videoId={activeVideo} 
        onClose={() => setActiveVideo(null)} 
      />
    </div>
  );
}
