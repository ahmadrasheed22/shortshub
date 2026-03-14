import { resolveChannel } from '@/lib/youtube';
import ChannelHeader from '@/components/ChannelHeader';
import ShortsFeed from '@/components/ShortsFeed';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const channel = await resolveChannel(id);
    if (!channel) return { title: 'Channel Not Found' };

    return {
      title: `${channel.snippet?.title} - ShortsHub`,
      description: `Watch and download the latest shorts from ${channel.snippet?.title} in high quality.`,
      openGraph: {
        images: [channel.snippet?.thumbnails?.high?.url || ''],
      },
    };
  } catch (error) {
    console.error('Metadata Resolve Error:', error);
    return { title: 'Channel Not Found' };
  }
}

export default async function ChannelPage({ params }: PageProps) {
  const { id } = await params;
  
  try {
    const channel = await resolveChannel(id);

    if (!channel) {
      notFound();
    }

    return (
      <main className="min-h-screen bg-black">
        <ChannelHeader channel={channel} />
        <ShortsFeed channelId={channel.id} />
      </main>
    );
  } catch (error: any) {
    console.error('Runtime Page Error:', error);
    
    const message = error instanceof Error ? error.message : String(error);
    
    // Aesthetic Error State
    if (message.includes('quota') || message.includes('LimitExceeded')) {
        return (
            <main className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
                <div className="max-w-md space-y-8">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-[24px] flex items-center justify-center mx-auto">
                        <AlertCircle size={32} className="text-red-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Access Restricted</h1>
                        <p className="text-sm text-white/30 leading-relaxed">
                            YouTube has temporarily capped our API requests for today. 
                            Our engineering team is monitoring the reset.
                        </p>
                    </div>
                    <Link 
                        href="/" 
                        className="inline-flex items-center gap-2 px-8 py-3 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
                    >
                        <ArrowLeft size={14} />
                        Return to Hub
                    </Link>
                </div>
            </main>
        );
    }
    
    notFound();
  }
}
