import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Search, Filter, RefreshCw, Download, Bell, TrendingUp,
  Activity, DollarSign, Users, BarChart2, Settings,
  ChevronDown, Copy, ExternalLink, Zap
} from 'lucide-react';

// API configuration
const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/v1`;


// WebSocket connection
let ws = null;

const FomoDashboard = () => {
  // State management
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_creators: 0,
    total_tokens: 0,
    total_market_cap: 0,
    new_today: 0,
    trending_creators: [],
    recent_tokens: []
  });
const [statsHistory, setStatsHistory] = useState({
  total_creators_history: [],
  total_tokens_history: [],
  market_cap_history: [],
  new_tokens_today_history: []
});
  const [creators, setCreators] = useState([]);
  const [filteredCreators, setFilteredCreators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('total_market_cap');
  const [orderBy, setOrderBy] = useState('desc');
  const [filters, setFilters] = useState({
    minTokens: '',
    minMarketCap: '',
    dateRange: { start: '', end: '' }
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // API key from environment or user settings
  const API_KEY = 'demo-key';

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stats`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
const fetchStatsHistory = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/stats/history`, {
      headers: { 'X-API-Key': API_KEY }
    });
    const data = await response.json();

    // Map correctly to your expected state shape
    setStatsHistory({
      total_creators_history: data.map(item => ({ date: item.date, total_creators: item.total_creators })),
      total_tokens_history: data.map(item => ({ date: item.date, total_tokens: item.total_tokens })),
      market_cap_history: data.map(item => ({ date: item.date, market_cap: item.market_cap })),
      new_tokens_today_history: data.map(item => ({ date: item.date, new_tokens: item.new_tokens }))
    });

  } catch (error) {
    console.error('Error fetching historical stats:', error);
  }
};

// Call this in useEffect along with fetchStats
useEffect(() => {
  fetchStats();
  fetchStatsHistory(); // add this
}, []);

  // Fetch creators data
const fetchCreators = async (sortByParam = sortBy, orderByParam = orderBy) => {
  setLoading(true);
  try {
    const [tokensRes, creatorsRes, statsRes] = await Promise.all([
      fetch(`${import.meta.env.VITE_BACKEND_URL}/tokens`),
      fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v1/creators?sort_by=${sortByParam}&order=${orderByParam}`),
      fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v1/stats`)
    ]);

    const tokensData = await tokensRes.json();
    const creatorsData = await creatorsRes.json();
    const statsData = await statsRes.json();

    const updatedCreators = creatorsData.map((creator) => {
      const creatorTokens = tokensData.filter(token => token.creator_address === creator.creator_address);

      return {
        address: creator.creator_address,
        name: creatorTokens[0]?.creator_name || 'N/A',
        avatar_url: creatorTokens[0]?.creator_avatar_url && creatorTokens[0].creator_avatar_url !== "Unknown"
          ? creatorTokens[0].creator_avatar_url
          : null,
        tokens: creatorTokens,
        token_count: creatorTokens.length,
        total_market_cap: creatorTokens.reduce((acc, token) => acc + token.market_cap, 0),
        total_replies: creatorTokens.reduce((acc, token) => acc + token.comments, 0),
        first_token_date: creatorTokens.sort((a, b) => new Date(a.creation_date) - new Date(b.creation_date))[0]?.creation_date,
        latest_token_date: creatorTokens.sort((a, b) => new Date(b.creation_date) - new Date(a.creation_date))[0]?.creation_date
      };
    });

    setCreators(updatedCreators);
    setFilteredCreators(updatedCreators);
    setStats({
      total_creators: statsData.total_creators,
      total_tokens: statsData.total_tokens,
      total_market_cap: statsData.total_market_cap,
      new_today: statsData.new_today,
    });

  } catch (error) {
    console.error('Error fetching creators:', error);
  } finally {
    setLoading(false);
  }
};

  // Initialize WebSocket connection
  const initWebSocket = () => {
    if (ws) return;

    ws = new WebSocket(`${import.meta.env.VITE_BACKEND_URL.replace(/^http/, 'ws')}/ws/tokens`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_token') {
        // Update creators list with new token
        setCreators(prev => {
          const updatedCreators = [...prev];
          const creatorIndex = updatedCreators.findIndex(c => c.address === data.creator_address);
          
          if (creatorIndex !== -1) {
            updatedCreators[creatorIndex].tokens.push(data.token);
            updatedCreators[creatorIndex].token_count += 1;
            updatedCreators[creatorIndex].latest_token_date = data.token.created_at;
          } else {
            // New creator
            updatedCreators.unshift({
              address: data.creator_address,
              name: data.creator_name,
              tokens: [data.token],
              token_count: 1,
              total_market_cap: data.token.market_cap,
              first_token_date: data.token.created_at,
              latest_token_date: data.token.created_at
            });
          }
          
          return updatedCreators;
        });

        // Show notification
        showNotification(`New token: ${data.token.ticker} by ${data.creator_name}`);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected. Reconnecting...');
      setTimeout(initWebSocket, 5000);
    };
  };

  // Show notification
  const showNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Search and filter creators
  useEffect(() => {
    let filtered = creators;

    if (searchTerm) {
      filtered = filtered.filter(creator =>
        creator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        creator.tokens.some(token => 
          token.ticker.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredCreators(filtered);
  }, [searchTerm, creators]);

  // Initialize dashboard
  useEffect(() => {
  setSortBy('total_market_cap');
  setOrderBy('desc');
  fetchStats();
  fetchStatsHistory();
  fetchCreators('total_market_cap', 'desc');
  initWebSocket();

  const interval = setInterval(() => {
    fetchStats();
    fetchCreators(sortBy, orderBy); // explicitly maintain current sorting
  }, 300000);

  return () => {
    clearInterval(interval);
    if (ws) ws.close();
  };
}, []);


  // Handle sorting
const handleSort = (column) => {
  const sortedCreators = [...filteredCreators];

  if (column === 'total_market_cap') {
    sortedCreators.sort((a, b) => orderBy === 'desc' ? a.total_market_cap - b.total_market_cap : b.total_market_cap - a.total_market_cap);
  } else if (column === 'token_count') {
    sortedCreators.sort((a, b) => orderBy === 'desc' ? a.token_count - b.token_count : b.token_count - a.token_count);
  } else if (column === 'first_token_date' || column === 'latest_token_date') {
    sortedCreators.sort((a, b) => orderBy === 'desc' 
      ? new Date(a[column]) - new Date(b[column]) 
      : new Date(b[column]) - new Date(a[column]));
  }

  setFilteredCreators(sortedCreators);
  setOrderBy(orderBy === 'desc' ? 'asc' : 'desc');
  setSortBy(column);
};
  // Apply advanced filters
  const applyFilters = () => {
    fetchCreators();
    setShowAdvancedFilters(false);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Creator Name', 'Address', 'Token Count', 'Total Market Cap', 'First Token', 'Latest Token'];
    const csvData = filteredCreators.map(creator => [
      creator.name,
      creator.address,
      creator.token_count,
      creator.total_market_cap,
      creator.first_token_date,
      creator.latest_token_date
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fomo_creators_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Format market cap
  const formatMarketCap = (value) => {
    if (!value) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Copy address to clipboard
  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    showNotification('Address copied to clipboard', 'success');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white ${
              notification.type === 'success' ? 'bg-green-500' :
              notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
            } animate-slide-in`}
          >
            {notification.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">BrapShield Dashboard</h1>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Live
              </span>
            </div>
            <div className="flex items-center space-x-4">
<a
  href="https://fomo.biz/dex/swap?inputCurrency=TARA&outputCurrency=0x2F38caB64A252a87c68414BF24A1d01F977E6fbe"
  target="_blank"
  rel="noopener noreferrer"
  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
>
  Buy $FARTAX
</a>
              <button
                onClick={fetchCreators}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <RefreshCw size={18} className="mr-2" />
                Refresh
              </button>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Download size={18} className="mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
<div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm opacity-80">Total Creators</p>
      <p className="text-3xl font-bold mt-1">{stats.total_creators}</p>
    </div>
    <Users size={40} className="opacity-80" />
  </div>
  <ResponsiveContainer width="100%" height={100}>
<LineChart data={statsHistory.total_creators_history}>
  <XAxis dataKey="date" hide />
  <YAxis hide />
   <Tooltip cursor={false} content={<></>} />
  <Line type="monotone" dataKey="total_creators" stroke="#FFFFFF" strokeWidth={2} dot={false}/>
</LineChart>
  </ResponsiveContainer>
</div>
          
<div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm opacity-80">Total Tokens</p>
      <p className="text-3xl font-bold mt-1">{stats.total_tokens}</p>
    </div>
    <Activity size={40} className="opacity-80" />
  </div>
  <ResponsiveContainer width="100%" height={100}>
<LineChart data={statsHistory.total_tokens_history}>
  <XAxis dataKey="date" hide />
  <YAxis hide />
   <Tooltip cursor={false} content={<></>} />
  <Line type="monotone" dataKey="total_tokens" stroke="#FFFFFF" strokeWidth={2} dot={false}/>
</LineChart>
  </ResponsiveContainer>
</div>
          
<div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm opacity-80">Total Market Cap</p>
      <p className="text-3xl font-bold mt-1">{formatMarketCap(stats.total_market_cap)}</p>
    </div>
    <DollarSign size={40} className="opacity-80" />
  </div>
  <ResponsiveContainer width="100%" height={100}>
<LineChart data={statsHistory.market_cap_history}>
  <XAxis dataKey="date" hide />
  <YAxis hide />
  <Tooltip cursor={false} content={<></>} />
  <Line type="monotone" dataKey="market_cap" stroke="#FFFFFF" strokeWidth={2} dot={false}/>
</LineChart>
  </ResponsiveContainer>
</div>
          
<div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
  <div className="flex justify-between items-center">
    <div>
      <p className="text-sm opacity-80">New Today</p>
      <p className="text-3xl font-bold mt-1">{stats.new_today}</p>
    </div>
    <Zap size={40} className="opacity-80" />
  </div>
  <ResponsiveContainer width="100%" height={100}>
<LineChart data={statsHistory.new_tokens_today_history}>
  <XAxis dataKey="date" hide />
  <YAxis hide />
   <Tooltip cursor={false} content={<></>} />
  <Line type="monotone" dataKey="new_tokens" stroke="#FFFFFF" strokeWidth={2} dot={false}/>
</LineChart>
  </ResponsiveContainer>
</div>
</div>

        {/* Search and Filters */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by creator name, address, or token ticker..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex gap-4">
<select
  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  value={sortBy}
  onChange={(e) => {
    setSortBy(e.target.value);
    setOrderBy('desc'); // explicitly reset orderBy to desc on new selection
    fetchCreators(e.target.value, 'desc');
  }}
>
  <option value="token_count">Sort by: Token Count</option>
  <option value="total_market_cap">Sort by: Market Cap</option>
  <option value="latest_token_date">Sort by: Recent Activity</option>
</select>
              
              <button
                onClick={() => setShowAdvancedFilters(true)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center"
              >
                <Filter size={18} className="mr-2" />
                Advanced Filters
              </button>
            </div>
          </div>
        </div>

        {/* Creators Table */}
        <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creator</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('token_count')}>
                    Tokens {sortBy === 'token_count' && (orderBy === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">All Tokens</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('total_market_cap')}>
                    Market Cap {sortBy === 'total_market_cap' && (orderBy === 'desc' ? '↓' : '↑')}
                  </th>
                  {/*<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replies</th>*/}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('first_token_date')}>
  First Token {sortBy === 'first_token_date' && (orderBy === 'desc' ? '↓' : '↑')}
</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('latest_token_date')}>
  Latest Token {sortBy === 'latest_token_date' && (orderBy === 'desc' ? '↓' : '↑')}
</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Safety</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredCreators.map((creator) => (
                  <tr key={creator.address} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {creator.avatar_url ? (
                          <img src={creator.avatar_url} alt={creator.name} className="h-10 w-10 rounded-full" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500 font-medium">{creator.name ? creator.name[0] : 'N/A'}</span>
                          </div>
                        )}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
  <div className="text-sm text-gray-900 font-mono">
    {creator.address.slice(0, 13)}...
  </div>
  <div className="flex items-center mt-1">
    <button
      onClick={() => copyAddress(creator.address)}
      className="text-xs text-blue-600 hover:text-blue-800 mr-2 flex items-center"
    >
      <Copy size={14} className="inline mr-1" />
      Copy
    </button>
    <a
      href={`https://tara.to/address/${creator.address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
    >
      <ExternalLink size={14} className="inline mr-1" />
      View
    </a>
  </div>
</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {creator.token_count}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2 max-w-md overflow-x-auto">
                        {(creator.tokens || []).map((token, index) => (
                          <a
                            key={index}
                            href={token.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                          >
                            {token.ticker}
                            <ExternalLink size={12} className="ml-1" />
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatMarketCap(creator.total_market_cap)}</div>
                    </td>
{/*                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{creator.total_replies}</div>
                    </td>*/}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(creator.first_token_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{new Date(creator.latest_token_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
  <span className={`inline-block h-3 w-3 rounded-full ${
    creator.token_count === 1 ? 'bg-green-500' : 
    creator.token_count === 2 ? 'bg-yellow-500' : 
    'bg-red-500'
  }`}></span>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Advanced Filters Modal */}
      {showAdvancedFilters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Advanced Filters</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Token Count</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filters.minTokens}
                  onChange={(e) => setFilters({...filters, minTokens: e.target.value})}
                  placeholder="e.g., 5"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Market Cap ($)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={filters.minMarketCap}
                  onChange={(e) => setFilters({...filters, minMarketCap: e.target.value})}
                  placeholder="e.g., 10000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters({...filters, dateRange: {...filters.dateRange, start: e.target.value}})}
                  />
                  <input
                    type="date"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters({...filters, dateRange: {...filters.dateRange, end: e.target.value}})}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  onClick={() => setShowAdvancedFilters(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
              <button
                onClick={() => setShowAnalytics(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Token Creation Timeline */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Token Creation Timeline</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={analyticsData?.timeline || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                     <Tooltip cursor={false} content={<></>} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* Market Cap Distribution */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Market Cap Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData?.marketCapDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analyticsData?.marketCapDistribution?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                     <Tooltip cursor={false} content={<></>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {/* Top Creators by Token Count */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Top Creators by Token Count</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analyticsData?.topCreators || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                     <Tooltip cursor={false} content={<></>} />
                    <Bar dataKey="tokenCount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Activity Heatmap */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Hourly Activity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={analyticsData?.hourlyActivity || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                     <Tooltip cursor={false} content={<></>} />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default FomoDashboard;