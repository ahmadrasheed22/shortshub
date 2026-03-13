'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import axios from 'axios';

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
      const { data } = await axios.get(`/api/channel/resolve?q=${encodeURIComponent(query)}`);
      
      if (data.id) {
        // Use the channel ID as the primary identifier
        router.push(`/c/${data.id}`);
      } else {
        setError('Could not resolve channel. Try a full URL or ID.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve channel. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSearch} className="relative group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter YouTube @handle, channel name, channel ID or URL (e.g. @MrBeast, UCX6OQ3DkcsbYNE6H8uQQuVA, https://youtube.com/@mrbeast)"
          className="w-full px-6 py-4 pl-14 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300 group-hover:bg-white/10"
        />
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-blue-400 transition-colors">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white font-medium rounded-xl transition-all"
        >
          {loading ? 'Searching...' : 'Go'}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-red-400 text-sm text-center animate-pulse">{error}</p>
      )}
    </div>
  );
}
