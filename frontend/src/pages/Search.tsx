import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchApi, SearchUser, SearchHashtag } from '../api/search';
import UserSearchResult from '../components/UserSearchResult';
import HashtagSearchResult from '../components/HashtagSearchResult';

const Search: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'hashtags'>(
    (searchParams.get('tab') as any) || 'all'
  );
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [hashtags, setHashtags] = useState<SearchHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Update URL when query or tab changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (activeTab !== 'all') params.set('tab', activeTab);
    setSearchParams(params, { replace: true });
  }, [query, activeTab, setSearchParams]);

  useEffect(() => {
    if (query.trim() === '') {
      setUsers([]);
      setHashtags([]);
      setHasSearched(false);
      return;
    }

    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for debounced search
    debounceTimeoutRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, activeTab]);

  const performSearch = async () => {
    if (query.trim() === '') return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const results = await searchApi.search(query, activeTab, 20);
      setUsers(results.users || []);
      setHashtags(results.hashtags || []);
    } catch (error) {
      console.error('Search error:', error);
      setUsers([]);
      setHashtags([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserUpdate = (updatedUser: SearchUser) => {
    setUsers(prev => prev.map(user => 
      user.id === updatedUser.id ? updatedUser : user
    ));
  };

  const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'users' as const, label: 'People' },
    { key: 'hashtags' as const, label: 'Hashtags' }
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Search Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="p-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg 
                className="h-5 w-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search users and hashtags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-12 pr-4 py-3 text-lg border-2 border-gray-200 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200"
              autoFocus
            />
          </div>
        </div>

        {/* Search Tabs */}
        {query.trim() && (
          <div className="border-t border-gray-100">
            <nav className="flex space-x-0">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-4 px-4 text-center font-medium text-sm transition-colors border-b-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <span className="text-gray-600 font-medium">Searching...</span>
            </div>
          </div>
        ) : !hasSearched ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center max-w-sm mx-auto px-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg 
                  className="h-8 w-8 text-blue-500" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Search Twitter Clone</h3>
              <p className="text-gray-600 leading-relaxed">
                Find people and hashtags by typing in the search box above. Discover new users to follow and trending topics.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Users Results */}
            {(activeTab === 'all' || activeTab === 'users') && users.length > 0 && (
              <div>
                {activeTab === 'all' && (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">People</h3>
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  {users.map(user => (
                    <UserSearchResult
                      key={user.id}
                      user={user}
                      onUserUpdate={handleUserUpdate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags Results */}
            {(activeTab === 'all' || activeTab === 'hashtags') && hashtags.length > 0 && (
              <div>
                {activeTab === 'all' && users.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900">Hashtags</h3>
                  </div>
                )}
                <div className="divide-y divide-gray-100">
                  {hashtags.map(hashtag => (
                    <HashtagSearchResult
                      key={hashtag.id}
                      hashtag={hashtag}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {hasSearched && users.length === 0 && hashtags.length === 0 && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center max-w-sm mx-auto px-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg 
                      className="h-8 w-8 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No results found</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Try searching with different keywords or check for typos. You can search for users by name or username, and hashtags with #.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
