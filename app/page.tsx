'use client';

import SearchBar from '@/components/SearchBar';
import { Youtube } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-black relative overflow-hidden">
      {/* Subtle Ambient Background */}
      <div className="absolute top-0 left-1/2 -track-x-1/2 w-full max-w-4xl h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-3xl text-center space-y-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-white/40 mb-4">
            <Youtube size={16} />
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">ShortsHub v2.0</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
            Track YouTube Shorts <br />
            <span className="opacity-40">With Precision.</span>
          </h1>
          
          <p className="text-sm md:text-base text-white/40 max-w-md mx-auto leading-relaxed">
            The professional tool for tracking real-time uploads. 
            Paste a channel link or @handle to begin.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="pt-4"
        >
          <SearchBar />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.8 }}
          className="pt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-center"
        >
          {[
            { title: 'Real-time', desc: 'No-refresh polling engine' },
            { title: 'Clean', desc: 'Minimalistic Inter UI' },
            { title: 'Fast', desc: 'Direct stream pipeline' }
          ].map((feature, i) => (
            <div key={i} className="space-y-1">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">{feature.title}</h3>
              <p className="text-[10px] text-white/30">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
      
      <footer className="absolute bottom-8 left-0 right-0 text-center">
        <span className="text-white/10 text-[9px] tracking-[0.3em] uppercase font-bold">
          ShortsHub Engineering • 2026
        </span>
      </footer>
    </main>
  );
}
