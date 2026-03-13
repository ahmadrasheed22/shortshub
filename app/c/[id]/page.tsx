import { resolveChannel } from '@/lib/youtube';
import ChannelHeader from '@/components/ChannelHeader';
import ShortsFeed from '@/components/ShortsFeed';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const channelId = params.id;
  try {
    const channel = await resolveChannel(channelId);
    if (!channel) return { title: 'Channel Not Found' };

    return {
      title: `${channel.snippet?.title} - Shorts Downloader`,
      description: `Watch and download the latest shorts from ${channel.snippet?.title} in high quality.`,
      openGraph: {
        images: [channel.snippet?.thumbnails?.high?.url || ''],
      },
    };
  } catch {
    return { title: 'Channel Not Found' };
  }
}

export default async function ChannelPage({ params }: PageProps) {
  const channelId = params.id;
  const channel = await resolveChannel(channelId);

  if (!channel) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-black">
      <ChannelHeader channel={channel} />
      <div className="mt-8">
        <ShortsFeed channelId={channel.id!} />
      </div>
    </main>
  );
}
