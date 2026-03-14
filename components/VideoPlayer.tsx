'use client';

import { X, Download, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  videoId: string | null;
  onClose: () => void;
}

export default function VideoPlayer({ videoId, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoId) {
      document.body.style.overflow = 'hidden';
      setLoading(true);
      setError(null);
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [videoId]);

  if (!videoId) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/download/${videoId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12"
      >
        <div
          className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 40 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-[480px] aspect-[9/16] bg-zinc-950 rounded-[40px] overflow-hidden shadow-[0_0_100px_-20px_rgba(0,0,0,1)] border border-white/10"
        >
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-white/20">
              <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
                <div className="absolute inset-0 blur-xl bg-blue-500/20 rounded-full" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold">Encrypted Pipeline</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center gap-6 text-white z-20">
              <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black uppercase tracking-tight">Stream Blocked</p>
                <p className="text-xs text-white/40 leading-relaxed font-bold uppercase tracking-widest">{error}</p>
              </div>
              <button
                onClick={onClose}
                className="mt-4 px-10 py-4 bg-white text-black rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] active:scale-95 shadow-xl"
              >
                Go Back
              </button>
            </div>
          )}
          
          <video
            ref={videoRef}
            src={`/api/stream/${videoId}`}
            autoPlay
            controls
            playsInline
            crossOrigin="anonymous"
            className={`w-full h-full object-contain ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-1000`}
            onLoadedData={() => setLoading(false)}
            onError={(e) => {
              console.error('Core Video Pipeline Failure:', e);
              setLoading(false);
              setError('YouTube is restricting this direct stream.');
            }}
          />

          {/* Header Controls */}
          <div className="absolute top-8 right-8 flex flex-col gap-4 z-30">
            <button
              onClick={onClose}
              className="p-4 bg-black/40 hover:bg-black/60 text-white rounded-2xl backdrop-blur-md transition-all border border-white/10 active:scale-90"
            >
              <X size={20} />
            </button>
            <button
              onClick={handleDownload}
              className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl backdrop-blur-md transition-all shadow-xl shadow-blue-500/20 border border-blue-400/20 active:scale-90"
            >
              <Download size={20} />
            </button>
          </div>

          <div className="absolute bottom-16 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-20">
            <div className="flex items-center gap-3">
              <div className="relative h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </div>
              <span className="text-[9px] text-white/40 uppercase tracking-[0.3em] font-bold">Secure Server Stream</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
