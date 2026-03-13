import Image from 'next/image';
import { Users, Video, Info } from 'lucide-react';

interface ChannelHeaderProps {
  channel: any;
}

export default function ChannelHeader({ channel }: ChannelHeaderProps) {
  const { snippet, statistics, brandingSettings } = channel;
  const banner = brandingSettings?.image?.bannerExternalUrl;
  const avatar = snippet?.thumbnails?.high?.url || snippet?.thumbnails?.default?.url;

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 bg-zinc-900 overflow-hidden">
        {banner ? (
          <Image
            src={banner}
            alt="Channel Banner"
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-zinc-900 to-zinc-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Profile Info */}
      <div className="max-w-7xl mx-auto px-6 -mt-12 md:-mt-16 pb-8 relative z-10">
        <div className="flex flex-col md:flex-row items-end md:items-center gap-6">
          <div className="relative w-24 h-24 md:w-40 md:h-40 rounded-full border-4 border-black overflow-hidden bg-zinc-800 shadow-2xl">
            {avatar && (
              <Image
                src={avatar}
                alt={snippet?.title}
                fill
                className="object-cover"
              />
            )}
          </div>
          
          <div className="flex-1 space-y-2 md:mb-4">
            <h1 className="text-3xl md:text-5xl font-bold text-white">{snippet?.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
              <span className="bg-white/10 px-3 py-1 rounded-full">{snippet?.customUrl}</span>
              <div className="flex items-center gap-1">
                <Users size={16} />
                <span>{parseInt(statistics?.subscriberCount).toLocaleString()} subscribers</span>
              </div>
              <div className="flex items-center gap-1">
                <Video size={16} />
                <span>{parseInt(statistics?.videoCount).toLocaleString()} videos</span>
              </div>
            </div>
            <p className="text-sm text-white/40 line-clamp-2 max-w-3xl mt-2">
              {snippet?.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
