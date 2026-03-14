'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import axios, { AxiosError } from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      // First resolve to check if it exists and get clean ID
      const { data } = await axios.get(`/api/channel/resolve?q=${encodeURIComponent(query)}`);

      if (data.id) {
        router.push(`/c/${data.id}`);
      } else {
        setError('Channel not found. Try a full URL.');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ error?: string }>;
        setError(axiosError.response?.data?.error || 'Failed to resolve. Check your API key.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-0 bg-blue-500/10 blur-2xl group-focus-within:bg-blue-500/20 transition-all duration-500 rounded-full" />

        <div className="relative flex items-center bg-white/[0.03] border border-white/[0.08] group-focus-within:border-white/[0.15] group-focus-within:bg-white/[0.05] rounded-2xl transition-all duration-300 backdrop-blur-md overflow-hidden search-shadow">
          <div className="pl-6 text-white/20 group-focus-within:text-blue-400 transition-colors">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channel name, @handle or URL..."
            className="w-full px-5 py-5 bg-transparent text-white placeholder-white/20 focus:outline-none text-sm md:text-base font-medium"
            disabled={loading}
          />

          <div className="pr-3">
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 disabled:bg-white/10 disabled:text-white/20 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 active:scale-95"
            >
              {loading ? 'Searching' : 'Go'}
              {!loading && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-center"
          >
            <p className="text-red-400 text-[11px] font-bold uppercase tracking-wider bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20">
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
