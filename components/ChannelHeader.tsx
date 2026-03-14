import Image from 'next/image';
import { Users, PlaySquare, ChevronLeft } from 'lucide-react';
import { YouTubeChannel } from '@/lib/types';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ChannelHeaderProps {
  channel: YouTubeChannel;
}

export default function ChannelHeader({ channel }: ChannelHeaderProps) {
  const { snippet, statistics, brandingSettings } = channel;
  const banner = brandingSettings?.image?.bannerExternalUrl;
  const avatar = snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url;

  const subscriberCount = parseInt(statistics?.subscriberCount || '0');
  const videoCount = parseInt(statistics?.videoCount || '0');

  return (
    <div className="w-full relative">
      {/* Banner Section */}
      <div className="relative w-full h-[300px] md:h-[400px] bg-[#0a0a0a] overflow-hidden">
        {banner ? (
          <Image
            src={banner}
            alt="Banner"
            fill
            className="object-cover opacity-60"
            priority
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        
        {/* Back Navigation */}
        <div className="absolute top-8 left-8 z-20">
          <Link 
            href="/" 
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-colors bg-black/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/5"
          >
            <ChevronLeft size={14} />
            Back to Search
          </Link>
        </div>
      </div>

      {/* Channel Identity */}
      <div className="max-w-[1400px] mx-auto px-6 -mt-24 md:-mt-32 pb-16 relative z-10">
        <div className="flex flex-col md:flex-row items-end md:items-center gap-8">
          <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-[48px] border-[8px] border-black overflow-hidden bg-zinc-900 shadow-2xl flex-shrink-0">
            {avatar && (
              <Image
                src={avatar}
                alt={snippet?.title || 'Avatar'}
                fill
                className="object-cover"
                unoptimized
              />
            )}
          </div>
          
          <div className="flex-1 space-y-4 md:mb-6 w-full">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight break-words leading-none">
                {snippet?.title}
              </h1>
              {snippet?.customUrl && (
                <p className="text-blue-500 font-bold text-sm md:text-base tracking-tight italic">
                  {snippet.customUrl}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <div className="flex flex-col">
                <span className="text-white font-black text-xl leading-none">
                  {subscriberCount.toLocaleString()}
                </span>
                <span className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-bold mt-1">Subscribers</span>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-xl leading-none">
                  {videoCount.toLocaleString()}
                </span>
                <span className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-bold mt-1">Total Videos</span>
              </div>
            </div>

            {snippet?.description && (
              <p className="text-xs md:text-sm text-white/30 line-clamp-2 max-w-2xl font-medium leading-relaxed italic">
                {snippet.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
