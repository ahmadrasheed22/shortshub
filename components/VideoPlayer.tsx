'use client';

import { X, Download, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  videoId: string | null;
  onClose: () => void;
}

export default function VideoPlayer({ videoId, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (videoId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [videoId]);

  if (!videoId) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
      >
        <div 
          className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-[450px] aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/40">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-xs uppercase tracking-widest font-bold">Fetching Stream...</p>
            </div>
          )}
          
          <video
            ref={videoRef}
            src={`/api/download/${videoId}`}
            autoPlay
            controls
            playsInline
            className="w-full h-full object-contain"
            onLoadedData={() => setLoading(false)}
          />

          {/* Header Controls */}
          <div className="absolute top-6 right-6 flex flex-col gap-4">
            <button
              onClick={onClose}
              className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
            >
              <X size={20} />
            </button>
            <a
              href={`/api/download/${videoId}`}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full backdrop-blur-md transition-all shadow-lg shadow-blue-900/40"
            >
              <Download size={20} />
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
