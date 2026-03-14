'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import axios from 'axios';
import ShortCard from './ShortCard';
import VideoPlayer from './VideoPlayer';
import { useInView } from 'react-intersection-observer';
import { Loader2, AlertCircle, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { YouTubeVideo, ShortsResponse } from '@/lib/types';

interface ShortsFeedProps {
  channelId: string;
}

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export default function ShortsFeed({ channelId }: ShortsFeedProps) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null);
  const [newlyDetectedIds, setNewlyDetectedIds] = useState<Set<string>>(new Set());

  const { ref, inView } = useInView();
  const initialLoadRef = useRef(true);

  // Initial Fetch
  useEffect(() => {
    async function loadInitial() {
      if (!channelId) return;
      try {
        const data: ShortsResponse = await fetcher(`/api/shorts/${channelId}`);
        setVideos(data.items);
        setNextPageToken(data.nextPageToken);
        if (data.items.length > 0) {
          setLastPublishedAt(data.items[0].snippet.publishedAt);
        }
        initialLoadRef.current = false;
      } catch (err) {
        console.error('Failed to detect initial shorts:', err);
      }
    }
    loadInitial();
  }, [channelId]);

  // Infinite Scroll
  useEffect(() => {
    if (inView && nextPageToken && !loadingMore) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  async function loadMore() {
    if (!nextPageToken || !channelId) return;
    setLoadingMore(true);
    try {
      const data: ShortsResponse = await fetcher(`/api/shorts/${channelId}?pageToken=${nextPageToken}`);
      setVideos(prev => {
        const newItems = data.items.filter(item => {
          const id = typeof item.id === 'string' ? item.id : item.id.videoId;
          return !prev.some(p => (typeof p.id === 'string' ? p.id : p.id.videoId) === id);
        });
        return [...prev, ...newItems];
      });
      setNextPageToken(data.nextPageToken);
    } catch (err) {
      console.error('Failed to load older shorts:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  // Real-time Polling Engine (60s)
  const { data: pollData } = useSWR<ShortsResponse>(
    lastPublishedAt ? `/api/shorts/${channelId}?after=${lastPublishedAt}` : null,
    fetcher,
    {
      refreshInterval: 60000, 
      revalidateOnFocus: true,
      compare: (a, b) => {
          const aFirstId = a?.items?.[0]?.id;
          const bFirstId = b?.items?.[0]?.id;
          const aId = typeof aFirstId === 'string' ? aFirstId : aFirstId?.videoId;
          const bId = typeof bFirstId === 'string' ? bFirstId : bFirstId?.videoId;
          return aId === bId;
      }
    }
  );

  useEffect(() => {
    if (pollData?.items && pollData.items.length > 0) {
      const newItems = pollData.items.filter(newItem => {
        const newId = typeof newItem.id === 'string' ? newItem.id : newItem.id.videoId;
        return !videos.some(v => (typeof v.id === 'string' ? v.id : v.id.videoId) === newId);
      });

      if (newItems.length > 0) {
        const newIds = newItems.map(item => typeof item.id === 'string' ? item.id : item.id.videoId);
        
        setVideos(prev => [...newItems, ...prev]);
        setLastPublishedAt(newItems[0].snippet.publishedAt);
        setNewlyDetectedIds(prev => new Set([...Array.from(prev), ...newIds]));
        
        // Push Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('ShortsHub: New Video', {
            body: newItems[0].snippet.title,
            icon: newItems[0].snippet.thumbnails.default.url
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollData]);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-white/[0.05] pb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-3">
            Latest Content
            <AnimatePresence>
              {newlyDetectedIds.size > 0 && (
                <motion.span 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-blue-600 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-lg shadow-blue-500/20"
                >
                  {newlyDetectedIds.size} NEW
                </motion.span>
              )}
            </AnimatePresence>
          </h2>
          <p className="text-xs text-white/30 font-medium">Monitoring channel for real-time updates</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/[0.03] px-4 py-2 rounded-xl border border-white/[0.05]">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40">Radar Scanning Active</span>
        </div>
      </div>

      <motion.div
        layout
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 md:gap-8"
      >
        {videos.length === 0 && initialLoadRef.current ? (
          [...Array(10)].map((_, i) => (
            <div key={i} className="aspect-[9/16] bg-white/[0.02] rounded-3xl animate-pulse border border-white/[0.05]" />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {videos.map((video) => {
              const id = typeof video.id === 'string' ? video.id : video.id.videoId;
              return (
                <ShortCard
                  key={id}
                  video={video}
                  onPlay={setActiveVideo}
                  isNew={newlyDetectedIds.has(id)}
                />
              );
            })}
          </AnimatePresence>
        )}
      </motion.div>

      {videos.length === 0 && !loadingMore && !initialLoadRef.current && (
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
          <div className="p-6 bg-white/[0.02] rounded-full border border-white/[0.05]">
            <Radio size={32} className="text-white/20" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-white/60">No Shorts Detected</p>
            <p className="text-xs text-white/30">We're monitoring this channel for new uploads.</p>
          </div>
        </div>
      )}

      <div ref={ref} className="w-full flex justify-center pt-20">
        {(loadingMore || nextPageToken) && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 opacity-50" />
            <span className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-bold">Synchronizing Data</span>
          </div>
        )}
      </div>

      <VideoPlayer
        videoId={activeVideo}
        onClose={() => setActiveVideo(null)}
      />
    </div>
  );
}
