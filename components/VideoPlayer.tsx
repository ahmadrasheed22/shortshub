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
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/40">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <p className="text-xs uppercase tracking-widest font-bold">Bypassing Restrictions...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center gap-4 text-white">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <p className="text-lg font-bold">Playback Error</p>
              <p className="text-sm text-white/60">{error}</p>
              <button 
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
              >
                Close
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
            className={`w-full h-full object-contain ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            onLoadedData={() => setLoading(false)}
            onError={(e) => {
              console.error('Video Player Error:', e);
              setLoading(false);
              setError('YouTube is blocking this stream. Try downloading instead.');
            }}
          />

          {/* Header Controls */}
          <div className="absolute top-6 right-6 flex flex-col gap-4">
            <button
              onClick={onClose}
              className="p-3 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-all border border-white/10"
            >
              <X size={20} />
            </button>
            <button
              onClick={handleDownload}
              className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full backdrop-blur-md transition-all shadow-lg shadow-blue-900/40"
            >
              <Download size={20} />
            </button>
          </div>

          <div className="absolute bottom-16 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent pointer-events-none">
             <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Encrypted Server Stream</span>
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
