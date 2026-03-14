'use client';

import { Play, Download, Share2, Eye, Clock, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { YouTubeVideo } from '@/lib/types';

interface ShortCardProps {
  video: YouTubeVideo;
  onPlay: (videoId: string) => void;
  isNew?: boolean;
}

export default function ShortCard({ video, onPlay, isNew }: ShortCardProps) {
  const [downloading, setDownloading] = useState(false);
  const { id, snippet, statistics } = video;
  
  const videoId = typeof id === 'string' ? id : id.videoId;
  
  const thumbnail = snippet.thumbnails.maxres?.url || 
                    snippet.thumbnails.high?.url || 
                    snippet.thumbnails.medium?.url ||
                    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  
  const views = parseInt(statistics?.viewCount || '0');
  const formattedViews = views >= 1000000 
    ? (views / 1000000).toFixed(1) + 'M' 
    : views >= 1000 
      ? (views / 1000).toFixed(1) + 'K' 
      : views;

  const publishedAt = snippet.publishedAt ? new Date(snippet.publishedAt) : new Date();
  
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloading(true);
      
      const link = document.createElement('a');
      link.href = `/api/download/${videoId}`;
      link.setAttribute('download', `${snippet.title}.mp4`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download initiation failed:', error);
      alert('Could not start download. Please try again.');
    } finally {
      setTimeout(() => setDownloading(false), 3000);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `https://www.youtube.com/shorts/${videoId}`;
    if (navigator.share) {
      navigator.share({
        title: snippet.title,
        url: url
      }).catch(() => null);
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="group relative flex flex-col bg-white/[0.02] rounded-[32px] overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5"
    >
      {/* Thumbnail Area */}
      <div 
        className="relative aspect-[9/16] cursor-pointer overflow-hidden"
        onClick={() => onPlay(videoId)}
      >
        <Image
          src={thumbnail}
          alt={snippet.title}
          fill
          unoptimized={true}
          className="object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
        
        <AnimatePresence>
          {isNew && (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="absolute top-6 left-6 z-20"
            >
              <div className="flex items-center gap-2 bg-blue-600/90 backdrop-blur-md text-white text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg uppercase tracking-[0.2em] animate-pulse">
                <span className="w-1 h-1 bg-white rounded-full" />
                Live New
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
            <Play className="text-white fill-white ml-1" size={24} />
          </div>
        </div>

        {/* Info Overlay */}
        <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/50 bg-black/20 backdrop-blur-md w-fit px-2 py-1 rounded-md">
            <Eye size={12} />
            <span>{formattedViews}</span>
          </div>
          <h3 className="font-bold text-base line-clamp-2 leading-tight text-white group-hover:text-blue-400 transition-colors duration-300">
            {snippet.title}
          </h3>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-6 py-6 flex items-center gap-3">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`flex-1 relative flex items-center justify-center gap-2 h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${
            downloading 
            ? 'bg-white/5 text-white/20 cursor-not-allowed' 
            : 'bg-white text-black hover:bg-zinc-200'
          }`}
        >
          {downloading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processing
            </>
          ) : (
            <>
              <Download size={14} />
              Get Video
            </>
          )}
        </button>
        <button
          onClick={handleShare}
          className="w-12 h-12 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white rounded-2xl transition-all active:scale-95 border border-white/[0.05]"
        >
          <Share2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}
