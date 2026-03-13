'use client';

import { Play, Download, Share2, Eye, Clock, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface ShortCardProps {
  video: any;
  onPlay: (videoId: string) => void;
  isNew?: boolean;
}

export default function ShortCard({ video, onPlay, isNew }: ShortCardProps) {
  const [downloading, setDownloading] = useState(false);
  const { id, snippet, statistics } = video;
  const videoId = typeof id === 'string' ? id : id.videoId;
  
  // YouTube thumbnail fallback sequence
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

  const publishedAt = new Date(snippet.publishedAt);
  
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloading(true);
      
      // Trigger download via hidden link to ensure it's handled as an attachment
      const link = document.createElement('a');
      link.href = `/api/download/${videoId}`;
      // Filename is set by the server via Content-Disposition, 
      // but we provide a fallback for simple browsers
      link.setAttribute('download', `${snippet.title}.mp4`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`Download started for: ${videoId}`);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Technical details: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      // Keep state for a moment to show completion
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/c/${snippet.channelId}`; // Share the channel feed
    if (navigator.share) {
      navigator.share({
        title: snippet.title,
        text: `Watch and download this YouTube Short: ${snippet.title}`,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <motion.div 
      initial={isNew ? { opacity: 0, y: -20, scale: 0.95 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="group relative flex flex-col bg-zinc-900/50 rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-300 shadow-xl"
    >
      {/* Thumbnail / Play Zone */}
      <div 
        className="relative aspect-[9/16] cursor-pointer overflow-hidden"
        onClick={() => onPlay(videoId)}
      >
        <Image
          src={thumbnail}
          alt={snippet.title}
          fill
          unoptimized={true}
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {isNew && (
          <div className="absolute top-4 left-4 z-10">
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg uppercase tracking-widest animate-pulse">
              New
            </span>
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 scale-75 group-hover:scale-100 transition-transform">
            <Play className="text-white fill-white ml-1" size={32} />
          </div>
        </div>

        {/* View Count Overlay */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-xs font-medium text-white shadow-sm">
          <Eye size={14} />
          <span>{formattedViews} views</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm line-clamp-2 leading-tight text-white/90 group-hover:text-white transition-colors">
            {snippet.title}
          </h3>
          <p className="text-[11px] text-white/40 flex items-center gap-1">
            <Clock size={10} />
            {formatDistanceToNow(publishedAt, { addSuffix: true })}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg ${
              downloading 
              ? 'bg-zinc-800 text-white/50 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
            }`}
          >
            {downloading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                PREPARING...
              </>
            ) : (
              <>
                <Download size={14} />
                DOWNLOAD
              </>
            )}
          </button>
          <button
            onClick={handleShare}
            className="w-11 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all active:scale-95 border border-white/5"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
