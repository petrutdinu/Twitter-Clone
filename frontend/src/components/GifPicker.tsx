import React, { useState, useEffect, useRef } from 'react';

interface GifObject {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
      width: string;
      height: string;
    };
  };
}

interface GifPickerProps {
  onGifSelect: (gif: GifObject) => void;
  onClose: () => void;
}

const GifPicker: React.FC<GifPickerProps> = ({ onGifSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GifObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // GIPHY API configuration
  const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;
  const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

  // Check for missing API key
  useEffect(() => {
    if (!GIPHY_API_KEY) {
      setError('Giphy API key is missing. Please set VITE_GIPHY_API_KEY in your environment.');
      return;
    }
  }, []);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Load trending GIFs on mount
  useEffect(() => {
    if (GIPHY_API_KEY) {
      loadTrendingGifs();
    }
  }, [GIPHY_API_KEY]);

  // Search GIFs when query changes
  useEffect(() => {
    if (searchQuery.trim() && GIPHY_API_KEY) {
      const timeoutId = setTimeout(() => {
        searchGifs(searchQuery);
      }, 500); // Debounce search

      return () => clearTimeout(timeoutId);
    } else if (GIPHY_API_KEY) {
      loadTrendingGifs();
    }
  }, [searchQuery, GIPHY_API_KEY]);

  const loadTrendingGifs = async () => {
    if (!GIPHY_API_KEY) {
      setError('Giphy API key is missing. Please set VITE_GIPHY_API_KEY in your environment.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load trending GIFs');
      }
      
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      setError('Failed to load GIFs. Please try again.');
      console.error('Error loading trending GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!GIPHY_API_KEY) {
      setError('Giphy API key is missing. Please set VITE_GIPHY_API_KEY in your environment.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${GIPHY_BASE_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search GIFs');
      }
      
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      setError('Failed to search GIFs. Please try again.');
      console.error('Error searching GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGifClick = (gif: GifObject) => {
    onGifSelect(gif);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={containerRef} className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Choose a GIF</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search for GIFs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* GIF Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <button
                onClick={() => searchQuery ? searchGifs(searchQuery) : loadTrendingGifs()}
                className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : gifs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No GIFs found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => handleGifClick(gif)}
                  className="relative aspect-square overflow-hidden rounded-lg hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <img
                    src={gif.images.fixed_height_small.url}
                    alt={gif.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Powered by{' '}
            <a 
              href="https://giphy.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GIPHY
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default GifPicker;
