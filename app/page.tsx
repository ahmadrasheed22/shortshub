import SearchBar from '@/components/SearchBar';
import { Youtube } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
      <div className="w-full max-w-4xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 animate-bounce">
          <Youtube size={20} />
          <span className="text-sm font-semibold uppercase tracking-wider">ShortsHub Engine</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Track & Download <br />
          <span className="gradient-text">YouTube Shorts</span>
        </h1>
        
        <p className="text-lg text-white/60 max-w-xl mx-auto">
          The ultimate real-time shorts detector. Enter any channel to start tracking new uploads instantly.
        </p>

        <div className="pt-8">
          <SearchBar />
        </div>

        <div className="pt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { title: 'Real-time Detection', desc: 'New shorts appear in 3-10s without refresh.' },
            { title: 'Direct Download', desc: 'Highest quality MP4 files straight to your device.' },
            { title: 'Responsive Feed', desc: 'Optimized for mobile viewing and management.' }
          ].map((feature, i) => (
            <div key={i} className="glass p-6 rounded-2xl space-y-2 hover:border-white/20 transition-all">
              <h3 className="font-semibold text-white/90">{feature.title}</h3>
              <p className="text-sm text-white/40">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
      
      <footer className="fixed bottom-8 text-white/20 text-xs tracking-widest uppercase">
        Built for Production • Powered by Next.js 14
      </footer>
    </main>
  );
}
