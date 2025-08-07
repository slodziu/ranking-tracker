<script lang="ts">
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import 'chartjs-adapter-date-fns';
  import { injectAnalytics } from '@vercel/analytics/sveltekit'
  
  // Navigation state
  injectAnalytics({ mode: dev ? 'development' : 'production' });
  let currentView = 'purplefish';
  let selectedClient: any = null;
  let clients: any[] = [];
  
  // Existing variables for Purplefish tracking
  let keywords: { id: number, keyword: string }[] = [];
  let newKeyword = '';
  let results: any[] = [];
  let loading = false;
  let error = '';
  let serpApiKey = '';
  let lastUpdated: string | null = null;
  
  // Client tracking variables
  let clientKeywords: any[] = [];
  let clientResults: any[] = [];
  let newClientKeyword = '';
  let newClientName = '';
  let newClientWebsite = '';
  let newClientGoogleBusinessName = '';
  let showAddClient = false;

  // Analytics/Graph variables
  let analyticsAccount = 'purplefish';
  let analyticsClient: any = null;
  let availableKeywords: string[] = [];
  let selectedKeywords: Set<string> = new Set();
  let chartInstance: Chart | null = null;
  let chartCanvas: HTMLCanvasElement;

  // New variables for historical data and timeframe selection
  let selectedTimeframe = '30';
  let customDateFrom = '';
  let customDateTo = '';
  let historicalData: any[] = [];

  // Ranking changes notification
  let rankingChanges: any[] = [];
  let notificationExpanded = false;
  let lastKnownResults: any = {};
  let showNotificationBanner = false;
  let notificationBannerMessage = '';
  let notificationBannerType = 'info'; // 'success', 'warning', 'info', 'error'

  // Auto-load Purplefish data on page load
  async function autoLoadPurplefishData() {
    if (keywords.length === 0) return;
    
    const todayResults = await fetchResults();
    results = [];
    let needsRefresh = 0;
    
    for (const k of keywords) {
      const cached = todayResults.find((r: any) => r.keyword_id === k.id);
      
      if (cached && cached.result_JSON !== null) {
        results = [...results, { keyword: k.keyword, ...cached.result_JSON }];
      } else {
        results = [...results, { 
          keyword: k.keyword, 
          organicRank: 'No data for today', 
          localRank: 'No data for today', 
          paa: [],
          needsRefresh: true 
        }];
        needsRefresh++;
      }
    }
    
    if (needsRefresh > 0) {
      error = `${needsRefresh} keyword${needsRefresh > 1 ? 's' : ''} need${needsRefresh === 1 ? 's' : ''} fresh data. Enter your SerpApi key and click Refresh.`;
    }
    
    lastUpdated = new Date().toLocaleString();
  }

  // Auto-load client data when client is selected
  async function autoLoadClientData() {
    if (!selectedClient || clientKeywords.length === 0) return;
    
    try {
      const resp = await fetch(`/api/client-results?client_id=${selectedClient.id}`);
      const todayResults = await resp.json();
      
      clientResults = [];
      let needsRefresh = 0;
      
      for (const k of clientKeywords) {
        const cached = todayResults.find((r: any) => r.client_keyword_id === k.id);
        
        if (cached && cached.result_JSON !== null) {
          clientResults = [...clientResults, { keyword: k.keyword, ...cached.result_JSON }];
        } else {
          clientResults = [...clientResults, { 
            keyword: k.keyword, 
            organicRank: 'No data for today', 
            localRank: 'No data for today', 
            paa: [],
            needsRefresh: true 
          }];
          needsRefresh++;
        }
      }
      
      if (needsRefresh > 0) {
        error = `${needsRefresh} client keyword${needsRefresh > 1 ? 's' : ''} need${needsRefresh === 1 ? 's' : ''} fresh data. Enter your SerpApi key and click Refresh.`;
      }
    } catch (e) {
      error = 'Could not load client data from database.';
    }
  }
  // Toggle keyword selection for chart
  function toggleKeyword(keyword: string) {
    if (selectedKeywords.has(keyword)) {
      selectedKeywords.delete(keyword);
    } else {
      selectedKeywords.add(keyword);
    }
    selectedKeywords = selectedKeywords;
    updateChart();
  }

  // Update chart with selected keywords
  function updateChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    
    if (!chartCanvas || selectedKeywords.size === 0) {
      return;
    }

    const datasets = [];
    const colors = ['#55c39f', '#676fff', '#d66f8d', '#f39c12', '#9b59b6', '#1abc9c'];
    let colorIndex = 0;

    Array.from(selectedKeywords).forEach(keyword => {
      const keywordData = historicalData
        .filter(d => {
          const keywordName = d.keywords?.keyword || d.client_keywords?.keyword;
          return keywordName === keyword;
        })
        .map(d => {
          const rank = d.result_JSON?.organicRank;
          return {
            x: d.date,
            y: rank === 'Not found' || rank === null || rank === undefined ? null : parseInt(rank) || null
          };
        })
        .filter(d => d.y !== null)
        .sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());

      if (keywordData.length > 0) {
        datasets.push({
          label: keyword,
          data: keywordData,
          borderColor: colors[colorIndex % colors.length],
          backgroundColor: colors[colorIndex % colors.length] + '40',
          fill: false,
          tension: 0.1,
          pointRadius: 8,
          pointHoverRadius: 12,
          pointBackgroundColor: colors[colorIndex % colors.length],
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          borderWidth: 4
        });
        colorIndex++;
      }
    });

    if (datasets.length === 0) {
      return;
    }

    let minDate = null;
    let maxDate = null;
    
    datasets.forEach(dataset => {
      if (dataset.data.length > 0) {
        const firstDate = new Date(dataset.data[0].x);
        const lastDate = new Date(dataset.data[dataset.data.length - 1].x);
        
        if (!minDate || firstDate < minDate) minDate = firstDate;
        if (!maxDate || lastDate > maxDate) maxDate = lastDate;
      }
    });

    chartInstance = new Chart(chartCanvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM dd'
              }
            },
            min: minDate,
            max: maxDate,
            title: {
              display: true,
              text: 'Date',
              font: {
                family: 'Raleway',
                size: 14
              }
            }
          },
          y: {
            reverse: true,
            min: 1,
            suggestedMax: 10,
            title: {
              display: true,
              text: 'Ranking Position',
              font: {
                family: 'Raleway',
                size: 14
              }
            },
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `${analyticsAccount === 'purplefish' ? 'Purplefish' : analyticsClient?.name || 'Client'} - Organic Ranking Over Time`,
            font: {
              family: 'Raleway',
              size: 16,
              weight: 'bold'
            }
          },
          legend: {
            display: true,
            labels: {
              font: {
                family: 'Raleway'
              }
            }
          }
        }
      }
    });
  }


  // Auto-load Purplefish data on page load
  onMount(async () => {
    // Load initial data
    keywords = await fetchKeywords();
    await fetchClients();
    
    // Auto-load data based on current view
    if (currentView === 'purplefish' && keywords.length > 0) {
      await autoLoadPurplefishData();
    } else if (currentView === 'analytics') {
      await loadAnalyticsData();
    }
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  });

  // Modified fetchClientRankings to preserve data on API errors
  async function fetchClientRankings() {
  if (!serpApiKey || !selectedClient) {
    error = 'Please enter your SerpApi key and select a client.';
    return;
  }
  
  loading = true;
  error = '';
  // DON'T clear clientResults immediately - preserve existing data
  const today = new Date().toISOString().slice(0, 10);
  const newResults = []; // Build new results separately
  let apiErrorOccurred = false;
  
  for (const k of clientKeywords) {
    try {
      const resp = await fetch('/api/serpapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: k.keyword, apiKey: serpApiKey })
      });
      
      // CHECK if API response is ok
      if (!resp.ok) {
        const errorData = await resp.json();
        console.error('❌ SerpAPI error for', k.keyword, ':', errorData);
        
        // Keep existing result if available, otherwise show error
        const existingResult = clientResults.find(r => r.keyword === k.keyword);
        if (existingResult) {
          newResults.push(existingResult); // Keep old data
        } else {
          newResults.push({
            keyword: k.keyword,
            organicRank: 'API Error',
            localRank: 'API Error',
            paa: [],
            error: errorData.error || 'API request failed'
          });
        }
        apiErrorOccurred = true;
        continue;
      }
      
      const serpRes = await resp.json();
      
      // Check if serpRes has error
      if (serpRes.error) {
        console.error('❌ SerpAPI returned error for', k.keyword, ':', serpRes.error);
        
        // Keep existing result if available
        const existingResult = clientResults.find(r => r.keyword === k.keyword);
        if (existingResult) {
          newResults.push(existingResult);
        } else {
          newResults.push({
            keyword: k.keyword,
            organicRank: 'API Error',
            localRank: 'API Error',
            paa: [],
            error: serpRes.error
          });
        }
        apiErrorOccurred = true;
        continue;
      }

      const organic = serpRes.organic_results || [];
      
      // FIXED: Better client website matching
      let clientIndex = -1;
      if (selectedClient.website_url) {
        const clientDomain = selectedClient.website_url
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '')
          .toLowerCase();
        
        clientIndex = organic.findIndex((r: any) => {
          if (!r.link) return false;
          
          const resultDomain = r.link
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .toLowerCase();
          
          return resultDomain.includes(clientDomain) || clientDomain.includes(resultDomain);
        });
      }
      
      const local = serpRes.local_results?.places || [];
      let clientLocalIndex = -1;
      const businessName = (selectedClient.google_business_name || selectedClient.name || '').toLowerCase();
      
      if (businessName) {
        clientLocalIndex = local.findIndex((r: any) => {
          if (!r.title) return false;
          const localTitle = r.title.toLowerCase();
          return localTitle.includes(businessName) || businessName.includes(localTitle);
        });
      }
      
      const paa = serpRes.related_questions?.map((q: any) => q.question) || [];

      const result = {
        organicRank: clientIndex >= 0 ? clientIndex + 1 : 'Not found',
        localRank: clientLocalIndex >= 0 ? clientLocalIndex + 1 : 'Not found',
        paa
      };
      
      newResults.push({ keyword: k.keyword, ...result });

      // Save result to database
      await fetch('/api/client-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          client_keyword_id: k.id, 
          result_JSON: result, 
          date: today 
        })
      });
      
    } catch (e) {
      console.error('❌ Network/fetch error for', k.keyword, ':', e);
      
      // Keep existing result if available
      const existingResult = clientResults.find(r => r.keyword === k.keyword);
      if (existingResult) {
        newResults.push(existingResult);
      } else {
        newResults.push({
          keyword: k.keyword,
          organicRank: 'Network Error',
          localRank: 'Network Error',
          paa: [],
          error: 'Network error - check connection'
        });
      }
      apiErrorOccurred = true;
    }
  }
  
  // Detect ranking changes after fetching client results
  await detectRankingChanges(newResults, 'client');
  
  // Only update clientResults if we have new data
  clientResults = newResults;
  
  // Set appropriate error messages
  if (apiErrorOccurred) {
    error = 'Some API requests failed. Check your SerpAPI key and quota. Previous results preserved where possible.';
  } else {
    error = ''; // Clear any previous errors
    lastUpdated = new Date().toLocaleString();
  }
  
  loading = false;
}

  // Fetch clients
  async function fetchClients() {
    const resp = await fetch('/api/clients');
    const data = await resp.json();
    if (!data.error) clients = data;
  }

  // Add new client
  async function addClient() {
    if (newClientName.trim()) {
      const resp = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName.trim(),
          website_url: newClientWebsite.trim(),
          google_business_name: newClientGoogleBusinessName.trim() // Changed from google_business_url
        })
      });
      const data = await resp.json();
      if (!data.error) {
        clients = [...clients, data];
        newClientName = '';
        newClientWebsite = '';
        newClientGoogleBusinessName = ''; // Changed
        showAddClient = false;
      }
    }
  }

  // Add keyword for selected client
  async function addClientKeyword() {
    if (newClientKeyword.trim() && selectedClient) {
      const resp = await fetch('/api/client-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          keyword: newClientKeyword.trim()
        })
      });
      const data = await resp.json();
      if (!data.error) {
        clientKeywords = [...clientKeywords, data];
        newClientKeyword = '';
        // Fetch rankings to detect new keyword appearance
        fetchClientRankings();
      }
    }
  }

  // Select client and load their keywords
  async function selectClient(client: any) {
    if (client && client.id) {
      selectedClient = client;
      
      // Load keywords for the selected client
      const resp = await fetch(`/api/client-keywords?client_id=${client.id}`);
      const data = await resp.json();
      if (!data.error) {
        clientKeywords = data;
        // Auto-load data if we're in client view
        if (currentView === 'clients') {
          await autoLoadClientData();
        }
      } else {
        error = data.error;
      }
    } else {
      selectedClient = null;
      clientKeywords = [];
      clientResults = [];
    }
  }

  // Fetch keywords from Supabase
  async function fetchKeywords() {
    const resp = await fetch('/api/keywords');
    const data = await resp.json();
    if (data.error) {
      error = data.error;
      return [];
    }
    return data;
  }

  // Fetch today's results from Supabase
  async function fetchResults() {
    const resp = await fetch('/api/results');
    const data = await resp.json();
    if (data.error) {
      error = data.error;
      return [];
    }
    return data;
  }

  // Add a new keyword to Supabase and refresh
  async function addKeyword() {
    if (newKeyword.trim() && !keywords.find(k => k.keyword === newKeyword.trim())) {
      const resp = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim() })
      });
      const data = await resp.json();
      if (!data.error) {
        keywords = [...keywords, data];
        newKeyword = '';
        fetchRankings();
      } else {
        error = data.error;
      }
    }
  }

  // Delete a keyword from Supabase
  async function deleteKeyword(id: number) {
    const keywordToDelete = keywords.find(k => k.id === id);
    const keywordName = keywordToDelete?.keyword || 'this keyword';
    
    if (!confirm(`Are you sure you want to delete "${keywordName}"? This will also delete all historical data for this keyword. This action cannot be undone.`)) {
      return;
    }
    
    const resp = await fetch('/api/keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await resp.json();
    if (!data.error) {
      keywords = keywords.filter(k => k.id !== id);
      // Optionally, refresh results
      results = results.filter(r => r.keyword !== keywordName);
      error = `✅ Keyword "${keywordName}" has been deleted successfully.`;
      setTimeout(() => { error = ''; }, 3000);
    } else {
      error = data.error;
    }
  }

  // Main function: get keywords, get today's results, call SerpApi if needed
  async function fetchRankings() {
    if (!serpApiKey) {
      error = 'Please enter your SerpApi key.';
      return;
    }
    loading = true;
    error = '';
    
    const newResults = [];
    const todayResults = await fetchResults();
    
    for (const k of keywords) {
      const cached = todayResults.find((r: any) => r.keyword_id === k.id);
      
      // Check if cached result exists AND has valid result_JSON (not null)
      if (cached && cached.result_JSON !== null) {
        newResults.push({ keyword: k.keyword, ...cached.result_JSON });
        continue;
      }
      
      // Call SerpApi if no cached result OR if result_JSON is null
      try {
        const resp = await fetch('/api/serpapi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k.keyword, apiKey: serpApiKey })
        });
        const serpRes = await resp.json();

        const organic = serpRes.organic_results || [];
        const pfIndex = organic.findIndex((r: any) =>
          r.link && r.link.includes('purplefish.agency')
        );
        const local = serpRes.local_results?.places || [];
        const pfLocalIndex = local.findIndex((r: any) =>
          (r.title && r.title.toLowerCase().includes('purplefish'))
        );
        const paa = serpRes.related_questions?.map((q: any) => q.question) || [];

        const result = {
          organicRank: pfIndex >= 0 ? pfIndex + 1 : 'Not found',
          localRank: pfLocalIndex >= 0 ? pfLocalIndex + 1 : 'Not found',
          paa
        };
        newResults.push({ keyword: k.keyword, ...result });

        // Save/update result to Supabase
        const today = new Date().toISOString().slice(0, 10);
        await fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword_id: k.id, result_JSON: result, date: today })
        });
      } catch (e) {
        newResults.push({
          keyword: k.keyword,
          organicRank: 'Error',
          localRank: 'Error',
          paa: [],
          error: 'Error fetching this keyword'
        });
        error = 'Some keywords could not be fetched. Check your API key and quota.';
      }
    }
    
    // Detect ranking changes after fetching
    await detectRankingChanges(newResults, 'purplefish');
    
    results = newResults;
    loading = false;
    lastUpdated = new Date().toLocaleString();
  }

  // Add this function after your other functions
  async function deleteClientKeyword(id: number | undefined) {
    if (!id) {
      error = 'Cannot delete keyword: ID not found';
      return;
    }
    
    const keywordToDelete = clientKeywords.find(k => k.id === id);
    const keywordName = keywordToDelete?.keyword || 'this keyword';
    const clientName = selectedClient?.name || 'this client';
    
    if (!confirm(`Are you sure you want to delete "${keywordName}" for ${clientName}? This will also delete all historical data for this keyword. This action cannot be undone.`)) {
      return;
    }
    
    const resp = await fetch('/api/client-keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await resp.json();
    if (!data.error) {
      // Find the keyword being deleted to remove from results
      const deletedKeyword = clientKeywords.find(k => k.id === id);
      
      // Update arrays
      clientKeywords = clientKeywords.filter(k => k.id !== id);
      if (deletedKeyword) {
        clientResults = clientResults.filter(r => r.keyword !== deletedKeyword.keyword);
      }
      error = `✅ Keyword "${keywordName}" has been deleted successfully for ${clientName}.`;
      setTimeout(() => { error = ''; }, 3000);
    } else {
      error = data.error;
    }
  }

  // Helper function to download CSV
  function downloadCSV(data, filename) {
    if (data.length === 0) {
      error = 'No data to export.';
      return;
    }
    
    // Convert to CSV with proper escaping
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let value = row[header] || '';
          
          // Convert to string if not already
          value = String(value);
          
          // Always wrap in quotes if contains comma, semicolon, quote, or newline
          if (value.includes(',') || value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            // Escape any existing quotes by doubling them
            value = value.replace(/"/g, '""');
            return `"${value}"`;
          }
          
          return value;
        }).join(',')
      )
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    // Show success message
    error = `✅ Downloaded ${data.length} records to ${filename}`;
    setTimeout(() => { error = ''; }, 3000);
  }


  // Export historical data for analytics
  function exportHistoricalData() {
    if (historicalData.length === 0) {
      error = 'No historical data to export. Select keywords and timeframe first.';
      return;
    }
    
    const dataToExport = [];
    
    // Process historical data for selected keywords
    Array.from(selectedKeywords).forEach(keyword => {
      const keywordData = historicalData.filter(d => {
        const keywordName = d.keywords?.keyword || d.client_keywords?.keyword;
        return keywordName === keyword;
      });
      
      keywordData.forEach(d => {
        const rank = d.result_JSON?.organicRank;
        const localRank = d.result_JSON?.localRank;
        const paa = d.result_JSON?.paa || [];
        
        dataToExport.push({
          Account: analyticsAccount === 'purplefish' ? 'Purplefish' : analyticsClient?.name || 'Client',
          Keyword: keyword,
          Date: d.date,
          'Organic Rank': rank === 'Not found' || rank === null ? '' : rank,
          'Local Rank': localRank === 'Not found' || localRank === null ? '' : localRank,
          'People Also Ask': paa.join(' | '),
          'Has Organic Ranking': rank !== 'Not found' && rank !== null ? 'Yes' : 'No',
          'Has Local Ranking': localRank !== 'Not found' && localRank !== null ? 'Yes' : 'No'
        });
      });
    });
    
    // Sort by keyword (A-Z), then by date (newest first)
    dataToExport.sort((a, b) => {
      const keywordCompare = a.Keyword.localeCompare(b.Keyword);
      if (keywordCompare !== 0) return keywordCompare;
      // Descending date (newest first)
      return new Date(b.Date).getTime() - new Date(a.Date).getTime();
    });
    
    const accountName = analyticsAccount === 'purplefish' ? 'purplefish' : analyticsClient?.name || 'client';
    const timeframeName = selectedTimeframe === 'custom' ? `${customDateFrom}-to-${customDateTo}` : `${selectedTimeframe}days`;
    
    downloadCSV(dataToExport, `${accountName}-historical-${timeframeName}.csv`);
  }

  // Export all historical data for an account
  async function exportAllHistoricalData() {
    try {
      loading = true;
      
      // Fetch all historical data without date limits
      const params = new URLSearchParams({
        type: analyticsAccount === 'purplefish' ? 'purplefish' : 'client',
        days: 'all'
      });
      
      if (analyticsAccount !== 'purplefish') {
        params.append('client_id', analyticsAccount);
      }
      
      const resp = await fetch(`/api/historical?${params}`);
      const allData = await resp.json();
      
      if (allData.error) {
        error = 'Failed to fetch complete historical data.';
        return;
      }
      
      const dataToExport = allData.map(d => {
        const keywordName = d.keywords?.keyword || d.client_keywords?.keyword;
        const rank = d.result_JSON?.organicRank;
        const localRank = d.result_JSON?.localRank;
        const paa = d.result_JSON?.paa || [];
        
        return {
          Account: analyticsAccount === 'purplefish' ? 'Purplefish' : analyticsClient?.name || 'Client',
          Keyword: keywordName,
          Date: d.date,
          'Organic Rank': rank === 'Not found' || rank === null ? '' : rank,
          'Local Rank': localRank === 'Not found' || localRank === null ? '' : localRank,
          'People Also Ask': paa.join(' | '),
          'Has Organic Ranking': rank !== 'Not found' && rank !== null ? 'Yes' : 'No',
          'Has Local Ranking': localRank !== 'Not found' && localRank !== null ? 'Yes' : 'No',
          'Created At': new Date(d.created_at).toISOString()
        };
      });
      
      // Sort by keyword (A-Z), then by date (newest first)
      dataToExport.sort((a, b) => {
        const keywordCompare = a.Keyword.localeCompare(b.Keyword);
        if (keywordCompare !== 0) return keywordCompare;
        // Descending date (newest first)
        return new Date(b.Date).getTime() - new Date(a.Date).getTime();
      });
      
      const accountName = analyticsAccount === 'purplefish' ? 'purplefish' : analyticsClient?.name || 'client';
      downloadCSV(dataToExport, `${accountName}-complete-history.csv`);
      
    } catch (e) {
      error = 'Error exporting historical data: ' + e.message;
    } finally {
      loading = false;
    }
  }

  // Export current results to CSV
  function exportCurrentResults() {
    let dataToExport = [];
    
    if (currentView === 'purplefish') {
      dataToExport = results.map(r => ({
        Account: 'Purplefish',
        Keyword: r.keyword,
        Date: new Date().toISOString().split('T')[0],
        'Organic Rank': r.organicRank,
        'Local Rank': r.localRank,
        'People Also Ask': r.paa ? r.paa.join(' | ') : ''
      }));
    } else if (currentView === 'clients' && selectedClient) {
      dataToExport = clientResults.map(r => ({
        Account: selectedClient.name,
        Keyword: r.keyword,
        Date: new Date().toISOString().split('T')[0],
        'Organic Rank': r.organicRank,
        'Local Rank': r.localRank,
        'People Also Ask': r.paa ? r.paa.join(' | ') : ''
      }));
    }
    
    // Sort by keyword (A-Z) for current results
    dataToExport.sort((a, b) => a.Keyword.localeCompare(b.Keyword));
    
    if (dataToExport.length > 0) {
      downloadCSV(dataToExport, `${currentView}-rankings-${new Date().toISOString().split('T')[0]}.csv`);
    }
  }


  // Add this function to detect changes - now uses database instead of localStorage
  async function detectRankingChanges(newResults: any[], accountType: 'purplefish' | 'client' = 'purplefish') {
    const changes = [];
    
    try {
      // Fetch previous results from database (yesterday's data)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      
      let previousResults = {};
      
      if (accountType === 'purplefish') {
        // Get previous Purplefish results from database
        const params = new URLSearchParams({
          type: 'purplefish',
          date_from: twoDaysAgo,
          date_to: yesterday
        });
        
        const resp = await fetch(`/api/historical?${params}`);
        const historicalData = await resp.json();
        
        if (!historicalData.error && historicalData.length > 0) {
          // Get the most recent result for each keyword
          const keywordLatestResults = {};
          historicalData.forEach(d => {
            const keyword = d.keywords?.keyword;
            if (keyword) {
              if (!keywordLatestResults[keyword] || d.date > keywordLatestResults[keyword].date) {
                keywordLatestResults[keyword] = {
                  organicRank: d.result_JSON?.organicRank,
                  localRank: d.result_JSON?.localRank,
                  date: d.date
                };
              }
            }
          });
          previousResults = keywordLatestResults;
        }
      } else if (accountType === 'client' && selectedClient) {
        // Get previous client results from database
        const params = new URLSearchParams({
          type: 'client',
          client_id: selectedClient.id.toString(),
          date_from: twoDaysAgo,
          date_to: yesterday
        });
        
        const resp = await fetch(`/api/historical?${params}`);
        const historicalData = await resp.json();
        
        if (!historicalData.error && historicalData.length > 0) {
          // Get the most recent result for each keyword
          const keywordLatestResults = {};
          historicalData.forEach(d => {
            const keyword = d.client_keywords?.keyword;
            if (keyword) {
              if (!keywordLatestResults[keyword] || d.date > keywordLatestResults[keyword].date) {
                keywordLatestResults[keyword] = {
                  organicRank: d.result_JSON?.organicRank,
                  localRank: d.result_JSON?.localRank,
                  date: d.date
                };
              }
            }
          });
          previousResults = keywordLatestResults;
        }
      }
      
      // Compare new results with previous results
      newResults.forEach(newResult => {
        const keyword = newResult.keyword;
        const prevResult = previousResults[keyword];
        
        if (!prevResult) {
          // New keyword or first time ranking - check if it has valid rankings
          if (newResult.organicRank && newResult.organicRank !== 'Not found' && newResult.organicRank !== 'Error') {
            changes.push({
              keyword,
              type: 'appeared',
              message: `New keyword "${keyword}" found ranking #${newResult.organicRank} in organic results!`,
              icon: '🆕',
              change: `+${newResult.organicRank}`,
              timestamp: new Date().toISOString()
            });
          }
          if (newResult.localRank && newResult.localRank !== 'Not found' && newResult.localRank !== 'Error') {
            changes.push({
              keyword,
              type: 'appeared',
              message: `New keyword "${keyword}" found ranking #${newResult.localRank} in local results!`,
              icon: '🗺️',
              change: `+${newResult.localRank}`,
              timestamp: new Date().toISOString()
            });
          }
          return;
        }
        
        // Check organic ranking changes
        const prevOrganic = prevResult.organicRank;
        const newOrganic = newResult.organicRank;
        
        if (prevOrganic !== newOrganic) {
          let changeInfo = analyzeRankingChange(keyword, prevOrganic, newOrganic, 'organic');
          if (changeInfo) changes.push(changeInfo);
        }
        
        // Check local ranking changes
        const prevLocal = prevResult.localRank;
        const newLocal = newResult.localRank;
        
        if (prevLocal !== newLocal) {
          let changeInfo = analyzeRankingChange(keyword, prevLocal, newLocal, 'local');
          if (changeInfo) changes.push(changeInfo);
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching previous results for comparison:', error);
      // Fall back to basic new keyword detection if database fetch fails
      newResults.forEach(newResult => {
        const keyword = newResult.keyword;
        
        if (newResult.organicRank && newResult.organicRank !== 'Not found' && newResult.organicRank !== 'Error') {
          changes.push({
            keyword,
            type: 'new_data',
            message: `Updated ranking data for "${keyword}": #${newResult.organicRank} in organic results`,
            icon: '📊',
            change: `#${newResult.organicRank}`,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
    
    // Show notifications if changes were detected
    if (changes.length > 0) {
      rankingChanges = [...rankingChanges, ...changes];
      
      // Show notification banner
      showNotificationBanner = true;
      const accountName = accountType === 'purplefish' ? 'Purplefish' : selectedClient?.name || 'Client';
      
      if (changes.length === 1) {
        notificationBannerMessage = `📊 ${accountName}: ${changes[0].message}`;
        notificationBannerType = changes[0].type === 'improved' || changes[0].type === 'appeared' ? 'success' : 'warning';
      } else {
        const improvements = changes.filter(c => c.type === 'improved' || c.type === 'appeared').length;
        const drops = changes.filter(c => c.type === 'dropped' || c.type === 'disappeared').length;
        
        if (improvements > 0 && drops === 0) {
          notificationBannerMessage = `🎉 ${accountName}: ${improvements} keyword${improvements > 1 ? 's' : ''} improved!`;
          notificationBannerType = 'success';
        } else if (drops > 0 && improvements === 0) {
          notificationBannerMessage = `⚠️ ${accountName}: ${drops} keyword${drops > 1 ? 's' : ''} dropped in rankings`;
          notificationBannerType = 'warning';
        } else {
          notificationBannerMessage = `📊 ${accountName}: ${changes.length} ranking changes detected (${improvements} improved, ${drops} dropped)`;
          notificationBannerType = 'info';
        }
      }
      
      // Auto-hide banner after 10 seconds
      setTimeout(() => {
        showNotificationBanner = false;
      }, 10000);
      
      // Optional: Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`🔔 ${changes.length} SEO ranking changes detected!`, {
          body: changes[0].message,
          icon: '/favicon.ico'
        });
      }
    }
  }

  function analyzeRankingChange(keyword: string, oldRank: any, newRank: any, type: 'organic' | 'local') {
    const typeLabel = type === 'organic' ? 'Organic' : 'Local';
    
    // Convert ranks to numbers for comparison
    const oldNum = oldRank === 'Not found' ? null : parseInt(oldRank);
    const newNum = newRank === 'Not found' ? null : parseInt(newRank);
    
    if (oldNum === null && newNum !== null) {
      // Appeared in rankings
      return {
        keyword,
        type: 'appeared',
        message: `${typeLabel}: Now ranking #${newNum}`,
        icon: '🎉',
        change: `+${newNum}`,
        timestamp: new Date().toISOString()
      };
    } else if (oldNum !== null && newNum === null) {
      // Disappeared from rankings
      return {
        keyword,
        type: 'disappeared', 
        message: `${typeLabel}: No longer ranking (was #${oldNum})`,
        icon: '⚠️',
        change: `-${oldNum}`,
        timestamp: new Date().toISOString()
      };
    } else if (oldNum !== null && newNum !== null) {
      const difference = oldNum - newNum; // Positive = improvement, negative = drop
      
      if (difference > 0) {
        // Improved ranking (lower number = better)
        return {
          keyword,
          type: 'improved',
          message: `${typeLabel}: #${oldNum} → #${newNum} (↑${difference})`,
          icon: '📈',
          change: `+${difference}`,
          timestamp: new Date().toISOString()
        };
      } else if (difference < 0) {
        // Dropped ranking
        return {
          keyword,
          type: 'dropped',
          message: `${typeLabel}: #${oldNum} → #${newNum} (↓${Math.abs(difference)})`,
          icon: '📉', 
          change: `${difference}`,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return null;
  }

  function clearNotifications() {
    rankingChanges = [];
  }

  // Update the onMount function
  onMount(async () => {
    // Load initial data
    keywords = await fetchKeywords();
    await fetchClients();
    
    // Auto-load data based on current view
    if (currentView === 'purplefish' && keywords.length > 0) {
      await autoLoadPurplefishData();
    } else if (currentView === 'analytics') {
      await loadAnalyticsData();
    }
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  });

  // Update loadAnalyticsData to be safer
  async function loadAnalyticsData() {
    // Don't run on server side
    if (typeof window === 'undefined') return;
    
    if (analyticsAccount === 'purplefish') {
      // Load Purplefish keywords
      await loadHistoricalData('purplefish');
      // Filter keywords that have at least one ranking position
      availableKeywords = keywords
        .map(k => k.keyword)
        .filter(keyword => {
          return historicalData.some(d => {
            const keywordName = d.keywords?.keyword;
            const rank = d.result_JSON?.organicRank;
            return keywordName === keyword && rank !== 'Not found' && rank !== null && rank !== undefined;
          });
        });
    } else {
      // Load client keywords
      const clientId = parseInt(analyticsAccount);
      analyticsClient = clients.find(c => c.id === clientId);
      
      if (analyticsClient) {
        // Fetch client keywords
        const resp = await fetch(`/api/client-keywords?client_id=${clientId}`);
        const data = await resp.json();
        if (!data.error) {
          await loadHistoricalData('client', clientId);
          // Filter keywords that have at least one ranking position
          availableKeywords = data
            .map((k: any) => k.keyword)
            .filter(keyword => {
              return historicalData.some(d => {
                const keywordName = d.client_keywords?.keyword;
                const rank = d.result_JSON?.organicRank;
                return keywordName === keyword && rank !== 'Not found' && rank !== null && rank !== undefined;
              });
            });
        }
      }
    }
    selectedKeywords.clear();
    updateChart();
  }

  // Update loadHistoricalData to be safer
  async function loadHistoricalData(type: string, clientId?: number) {
    // Don't run on server side
    if (typeof window === 'undefined') return;
    
    console.log('🔄 Loading historical data:', { type, clientId, timeframe: selectedTimeframe });
    
    const params = new URLSearchParams({
      type,
      days: selectedTimeframe
    });
    
    // Add custom date range if specified
    if (selectedTimeframe === 'custom' && customDateFrom && customDateTo) {
      params.set('date_from', customDateFrom);
      params.set('date_to', customDateTo);
      params.delete('days'); // Don't use days for custom range
    }
    
    if (type === 'client' && clientId) {
      params.append('client_id', clientId.toString());
    }

    try {
      const resp = await fetch(`/api/historical?${params}`);
      const data = await resp.json();
      
      console.log('📥 Historical data response:', data);
      
      if (!data.error) {
        historicalData = data;
        console.log('✅ Historical data loaded:', historicalData.length, 'records');
        
        // Update chart if keywords are selected
        if (selectedKeywords.size > 0) {
          updateChart();
        }
      } else {
        console.error('❌ API error:', data.error);
        historicalData = [];
      }
    } catch (e) {
      console.error('❌ Error loading historical data:', e);
      historicalData = [];
    }
  }

  // Update the analytics account selection to call loadAnalyticsData manually
  async function onAnalyticsAccountChange() {
    if (typeof window !== 'undefined' && currentView === 'analytics') {
      await loadAnalyticsData();
    }
  }

  // Update switchView function
  function switchView(view: string) {
    currentView = view;
    error = '';
    
    // Auto-load data when switching views (only on client side)
    if (typeof window !== 'undefined') {
      if (view === 'purplefish' && keywords.length > 0) {
        autoLoadPurplefishData();
      } else if (view === 'clients' && selectedClient && clientKeywords.length > 0) {
        autoLoadClientData();
      } else if (view === 'analytics') {
        loadAnalyticsData();
      } else {
        results = [];
        clientResults = [];
      }
    }
  }

  // Update the timeframe change handlers
  function onTimeframeChange() {
    if (typeof window === 'undefined') return;
    
    if (selectedTimeframe !== 'custom') {
      // Don't auto-clear dates - let user keep them for future use
    }
    
    // Reload data with new timeframe
    if (analyticsAccount === 'purplefish') {
      loadHistoricalData('purplefish');
    } else {
      const clientId = parseInt(analyticsAccount);
      loadHistoricalData('client', clientId);
    }
  }

  function onCustomDateChange() {
    if (typeof window === 'undefined') return;
    
    // If both dates are filled and valid, automatically switch to custom
    if (customDateFrom && customDateTo && customDateFrom <= customDateTo) {
      selectedTimeframe = 'custom';  // Auto-switch to custom
      
      // Reload data with custom range
      if (analyticsAccount === 'purplefish') {
        loadHistoricalData('purplefish');
      } else {
        const clientId = parseInt(analyticsAccount);
        loadHistoricalData('client', clientId);
      }
    }
  }

  // ... rest of your existing functions remain the same ...
</script>

<div class="app-container">
  <!-- Notification Banner -->
  {#if showNotificationBanner}
    <div class="notification-banner {notificationBannerType}">
      <div class="notification-content">
        <span class="notification-message">{notificationBannerMessage}</span>
        <button class="notification-close" on:click={() => showNotificationBanner = false}>×</button>
      </div>
    </div>
  {/if}

  <!-- Sidebar -->
  <nav class="sidebar">
    <h2>SEO Tracker</h2>
    <ul>
      <li class:active={currentView === 'purplefish'}>
        <button on:click={() => switchView('purplefish')}>
          🐟 Purplefish
        </button>
      </li>
      <li class:active={currentView === 'clients'}>
        <button on:click={() => switchView('clients')}>
          👥 Clients
        </button>
      </li>
      <li class:active={currentView === 'analytics'}>
        <button on:click={() => switchView('analytics')}>
          📊 Analytics
        </button>
      </li>
    </ul>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    {#if currentView === 'purplefish'}
      <!-- Your existing Purplefish tracking UI -->
      <h1>Purplefish SEO Ranking Tracker</h1>

      <div class="form-row">
        <input bind:value={newKeyword} placeholder="Add keyword..." />
        <button on:click={addKeyword}>Add</button>
        <button on:click={fetchRankings} disabled={loading}>Refresh</button>
      </div>

      <div class="form-row">
        <label>
          SerpApi Key:
          <input type="password" bind:value={serpApiKey} />
        </label>
      </div>

      {#if loading}
        <p>Loading...</p>
      {/if}

      {#if error}
        <p style="color:red">{error}</p>
      {/if}

      {#if results.length}
        <table>
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Organic Rank</th>
              <th>Google Business Rank</th>
              <th>People Also Ask</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {#each results as r}
              <tr class:needs-refresh={r.needsRefresh}>
                <td>{r.keyword}</td>
                <td class:placeholder={r.needsRefresh}>{r.organicRank}</td>
                <td class:placeholder={r.needsRefresh}>{r.localRank}</td>
                <td>
                  {#if r.needsRefresh}
                    <span class="placeholder">No data</span>
                  {:else if r.error}
                    <span style="color:red">{r.error}</span>
                  {:else if r.paa && r.paa.length}
                    <ul>
                      {#each r.paa as q}
                        <li>{q}</li>
                      {/each}
                    </ul>
                  {:else}
                    <span>-</span>
                  {/if}
                </td>
                <td>
                  <button on:click={() => deleteKeyword(keywords.find(k => k.keyword === r.keyword)?.id)} style="background:#d66f8d;">🗑️</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else if !loading}
        <p>No results to display. Try refreshing or check your API key.</p>
      {/if}

      {#if lastUpdated}
        <p class="last-updated">Last updated: {lastUpdated}</p>
      {/if}

      <!-- Add export section after the results table -->
      {#if results.length > 0}
        <div class="export-section">
          <h3>📊 Export Data</h3>
          <div class="export-buttons">
            <button on:click={exportCurrentResults} class="export-btn">
              📋 Export Today's Results
            </button>
          </div>
        </div>
      {/if}

    {:else if currentView === 'clients'}
      <h1>Client SEO Tracking</h1>
      
      <!-- Add SerpApi key field at the top -->
      <div class="form-row">
        <label>
          SerpApi Key:
          <input type="password" bind:value={serpApiKey} />
        </label>
      </div>
      
      <!-- Client Selection -->
      <div class="client-section">
        <div class="form-row">
          <select bind:value={selectedClient} on:change={() => selectClient(selectedClient)}>
            <option value={null}>Select a client...</option>
            {#each clients as client}
              <option value={client}>{client.name}</option>
            {/each}
          </select>
          <button on:click={() => showAddClient = !showAddClient}>Add Client</button>
        </div>

        {#if showAddClient}
          <div class="add-client-form">
            <input bind:value={newClientName} placeholder="Client name..." />
            <input bind:value={newClientWebsite} placeholder="Website URL..." />
            <input bind:value={newClientGoogleBusinessName} placeholder="Google Business name..." />
            <button on:click={addClient}>Save Client</button>
          </div>
        {/if}
      </div>

      {#if selectedClient}
        <div class="client-info">
          <h3>Client name: {selectedClient.name}</h3>
          <p>Website: {selectedClient.website_url || 'Not specified'}</p>
          <p>Google business name: {selectedClient.google_business_name || 'Not specified'}</p>
        </div>

        <!-- Keywords for selected client -->
        <div class="form-row">
          <input bind:value={newClientKeyword} placeholder="Add keyword for {selectedClient.name}..." />
          <button on:click={addClientKeyword}>Add</button>
          <button on:click={fetchClientRankings} disabled={loading}>Refresh</button>
        </div>

        <!-- Results table for client -->
        {#if clientResults.length}
          <table>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Organic Rank</th>
                <th>Local Rank</th>
                <th>People Also Ask</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {#each clientResults as r}
                <tr class:needs-refresh={r.needsRefresh}>
                  <td>{r.keyword}</td>
                  <td class:placeholder={r.needsRefresh}>{r.organicRank}</td>
                  <td class:placeholder={r.needsRefresh}>{r.localRank}</td>
                  <td>
                    {#if r.needsRefresh}
                      <span class="placeholder">No data</span>
                    {:else if r.paa && r.paa.length}
                      <ul>
                        {#each r.paa as q}
                          <li>{q}</li>
                        {/each}
                      </ul>
                    {:else}
                      <span>-</span>
                    {/if}
                  </td>
                  <td>
                    <button 
                      on:click={() => {
                        const keywordId = clientKeywords.find(k => k.keyword === r.keyword)?.id;
                        if (keywordId) {
                          deleteClientKeyword(keywordId);
                        } else {
                          error = 'Cannot delete: keyword ID not found';
                        }
                      }} 
                      style="background:#d66f8d;"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        <!-- Add status messages for clients section -->
        {#if loading}
          <p>Loading...</p>
        {/if}

        {#if error}
          <p style="color:red">{error}</p>
        {/if}

        {#if lastUpdated}
          <p class="last-updated">Last updated: {lastUpdated}</p>
        {/if}
      {/if}

      <!-- Add export section after client results -->
      {#if selectedClient && clientResults.length > 0}
        <div class="export-section">
          <h3>📊 Export Data</h3>
          <div class="export-buttons">
            <button on:click={exportCurrentResults} class="export-btn">
              📋 Export Today's Results
            </button>
          </div>
        </div>
      {/if}

    {:else if currentView === 'analytics'}
      <h1>SEO Analytics & Trends</h1>
      
      <!-- Account Selection -->
      <div class="form-row">
        <label>
          Select Account:
          <select bind:value={analyticsAccount} on:change={onAnalyticsAccountChange}>
            <option value="purplefish">Purplefish</option>
            {#each clients as client}
              <option value={client.id.toString()}>{client.name}</option>
            {/each}
          </select>
        </label>
      </div>

      <!-- Add this to your analytics section, before the keyword checkboxes -->
      {#if currentView === 'analytics'}
        <div class="analytics-controls">
          <div class="form-row">
            <div class="form-group">
              <label for="timeframe">Time Frame:</label>
              <select id="timeframe" bind:value={selectedTimeframe} on:change={onTimeframeChange}>
                <option value="7">Last 7 days</option>
                <option value="14">Last 2 weeks</option>
                <option value="30">Last 30 days</option>
                <option value="60">Last 2 months</option>
                <option value="90">Last 3 months</option>
                <option value="180">Last 6 months</option>
                <option value="365">Last year</option>
                <option value="all">All time</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="date-from">Custom Range:</label>
              <div class="date-range">
                <input type="date" 
                       id="date-from" 
                       bind:value={customDateFrom} 
                       on:change={onCustomDateChange}>
                <span>to</span>
                <input type="date" 
                       id="date-to" 
                       bind:value={customDateTo} 
                       on:change={onCustomDateChange}>
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if availableKeywords.length > 0}
        <!-- Keyword Selection -->
        <div class="analytics-section">
          <h3>Select Keywords to Track</h3>
          <p class="helper-text">Only keywords with ranking positions are shown</p>
          <div class="keyword-checkboxes">
            {#each availableKeywords as keyword}
              <label class="keyword-checkbox">
                <input 
                  type="checkbox" 
                  checked={selectedKeywords.has(keyword)}
                  on:change={() => toggleKeyword(keyword)}
                />
                <span>{keyword}</span>
              </label>
            {/each}
          </div>

          {#if selectedKeywords.size > 0}
            <!-- Chart Container -->
            <div class="chart-container">
              <canvas bind:this={chartCanvas} height="400"></canvas>
            </div>
          {:else}
            <div class="empty-chart">
              <p>Select keywords above to see their ranking trends over time</p>
              <p><small>Charts will start from the first date each keyword achieved a ranking position</small></p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>No keywords with ranking positions found for the selected account.</p>
          <p>Keywords must have at least one ranking position to appear in analytics.</p>
          <p>Add some keywords and refresh rankings in the {analyticsAccount === 'purplefish' ? 'Purplefish' : 'Clients'} section first.</p>
        </div>
      {/if}

      <!-- Add export section after keyword selection -->
      {#if availableKeywords.length > 0}
        <div class="export-section">
          <h3>📊 Export Historical Data</h3>
          <div class="export-buttons">
            {#if selectedKeywords.size > 0}
              <button on:click={exportHistoricalData} class="export-btn">
                📈 Export Selected Keywords ({selectedKeywords.size})
              </button>
            {/if}
            <button on:click={exportAllHistoricalData} class="export-btn" disabled={loading}>
              📦 Export All Historical Data
            </button>
          </div>
          <p class="helper-text">
            Selected keywords: exports data for current timeframe • All data: exports complete history
          </p>
        </div>
      {/if}
    {/if}
  </main>
</div>

{#if rankingChanges.length > 0}
  <div class="notification-banner">
    <div class="notification-header">
      <span class="bell-icon">🔔</span>
      <span class="notification-title">Ranking Changes Detected!</span>
      <button class="dismiss-btn" on:click={clearNotifications}>✕</button>
    </div>
    <div class="changes-list">
      {#each rankingChanges.slice(0, 5) as change}
        <div class="change-item" class:positive={change.type === 'improved'} class:negative={change.type === 'dropped'} class:new={change.type === 'appeared'} class:lost={change.type === 'disappeared'}>
          <span class="keyword">{change.keyword}</span>
          <span class="change-text">{change.message}</span>
          <span class="change-indicator">{change.icon}</span>
        </div>
      {/each}
      {#if rankingChanges.length > 5}
        <div class="more-changes">+{rankingChanges.length - 5} more changes</div>
      {/if}
    </div>
  </div>
{/if}

<style>
@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;700;800&display=swap');

:root {
  --primary1: #55c39f;
  --primary2: #676fff;
  --primary3: #d66f8d;
  --bg: var(--primary1);
  --text: #222;
  --radius: 1.2em;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  min-height: 100vh;
  margin: 0;
}

.app-container {
  display: flex;
  min-height: 100vh;
}
.export-section {
  background: #f8f9fa;
  padding: 1.5em;
  border-radius: var(--radius);
  margin-top: 2em;
  border: 1px solid #e1e5e9;
}

.export-section h3 {
  margin-top: 0;
  margin-bottom: 1em;
  color: var(--primary2);
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.export-buttons {
  display: flex;
  gap: 1em;
  flex-wrap: wrap;
}

.export-btn {
  background: linear-gradient(135deg, var(--primary1), var(--primary2));
  color: white;
  border: none;
  padding: 0.8em 1.5em;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.export-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  background: linear-gradient(135deg, var(--primary2), var(--primary3));
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 600px) {
  .export-buttons {
    flex-direction: column;
  }
  
  .export-btn {
    width: 100%;
  }
}

.sidebar {
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  width: 250px;
  background: var(--primary1);
  color: white;
  padding: 2em 1em;
}

.sidebar h2 {
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  margin-bottom: 2em;
  color: white;
}

.sidebar ul {
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  list-style: none;
  padding: 0;
}

.sidebar li {
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  margin-bottom: 1em;
}

.sidebar button {
  width: 100%;
  background: transparent;
  color: white;
  border: 2px solid rgba(255,255,255,0.3);
  padding: 1em;
  border-radius: var(--radius);
  cursor: pointer;
}

.sidebar li.active button {
  background: rgba(255,255,255,0.2);
  border-color: white;
}

.main-content {
  flex: 1;
  padding: 2em;
}

.main-container {
  background: #fff;
  border-radius: var(--radius);
  box-shadow: 0 4px 32px #0002;
  max-width: 700px;
  margin: 3em auto 2em auto;
  padding: 2.5em 2em 2em 2em;
  display: flex;
  flex-direction: column;
  align-items: center;
}

h1 {
  color: var(--primary2);
  text-align: center;
  margin-bottom: 1.5em;
  font-weight: 800;
  letter-spacing: 1px;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.form-row {
  width: 100%;
  display: flex;
  gap: 1em;
  align-items: center;
  justify-content: center;
  margin-bottom: 1em;
}

input[type="text"], input[type="password"] {
  padding: 0.6em 1em;
  border: 2px solid var(--primary1);
  border-radius: var(--radius);
  font-size: 1em;
  outline: none;
  transition: border 0.2s;
  background: #fff;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

input[type="text"]:focus, input[type="password"]:focus {
  border-color: var(--primary2);
}

button {
  background: linear-gradient(90deg, var(--primary1), var(--primary2), var(--primary3));
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.6em 1.5em;
  font-size: 1em;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 2px 8px #0001;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background: linear-gradient(90deg, var(--primary3), var(--primary2), var(--primary1));
  transform: translateY(-2px) scale(1.04);
}

table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 2em 0 0 0;
  background: #fff;
  border-radius: var(--radius);
  box-shadow: 0 2px 16px #0002;
  overflow: hidden;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

th, td {
  padding: 1em;
  text-align: left;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

th {
  background: var(--primary1);
  color: #fff;
  font-weight: 700;
  letter-spacing: 0.5px;
}

tr:nth-child(even) {
  background: #f3f7f6;
}

tr:hover {
  background: #fbe6ee;
  transition: background 0.2s;
}

ul {
  margin: 0.3em 0 0 1em;
  padding: 0;
}

.last-updated {
  margin-top: 1.5em;
  font-size: 0.9em;
  color: #666;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.client-section {
  margin-bottom: 2em;
}

.helper-text {
  font-size: 0.9em;
  color: #666;
  margin-bottom: 1em;
  font-style: italic;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.analytics-section {
  margin-top: 2em;
}

.keyword-checkboxes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1em;
  margin: 1.5em 0 2em 0;
  padding: 1.5em;
  background: #f8f9fa;
  border-radius: var(--radius);
}
.add-client-form {
  display: flex;
  gap: 1em;
  margin-top: 1em;
  flex-wrap: wrap;
}

.client-info {
  background: #f8f9fa;
  padding: 1em;
  border-radius: var(--radius);
  margin: 1em 0;
}

.keyword-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5em;
}

.keyword-chip {
  background: var(--primary1);
  color: white;
  padding: 0.5em 1em;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.2s;
}

.keyword-chip.selected {
  background: var(--primary2);
}

.keyword-chip:hover {
  background: var(--primary2);
}

.chart-container {
  background: white;
  padding: 2em;
  border-radius: var(--radius);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-top: 2em;
  height: 500px;
}

.empty-chart {
  background: white;
  padding: 4em 2em;
  border-radius: var(--radius);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  margin-top: 2em;
  text-align: center;
  color: #666;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.empty-state {
  text-align: center;
  margin-top: 4em;
  color: #666;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

select {
  padding: 0.6em 1em;
  border: 2px solid var(--primary1);
  border-radius: var(--radius);
  font-size: 1em;
  outline: none;
  background: white;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
  cursor: pointer;
}

select:focus {
  border-color: var(--primary2);
}

.analytics-controls {
    background: #f8f9fa;
    padding: 1.5em;
    border-radius: var(--radius);
    margin-bottom: 1.5em;
    border: 1px solid #e1e5e9;
  }

  .date-range {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .date-range input[type="date"] {
    padding: 0.5em;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.9em;
  }

  .date-range span {
    color: #666;
    font-size: 0.9em;
  }

  /* Update the timeframe selector option */
  .analytics-controls select {
    min-width: 150px;
  }

.export-section {
  background: #f8f9fa;
  padding: 1.5em;
  border-radius: var(--radius);
  margin-top: 2em;
  text-align: center;
}

.export-buttons {
  display: flex;
  justify-content: center;
  gap: 1em;
  margin-top: 1em;
}

.export-btn {
  background: linear-gradient(90deg, var(--primary1), var(--primary2), var(--primary3));
  color: #fff;
  border: none;
  border-radius: var(--radius);
  padding: 0.6em 1.5em;
  font-size: 1em;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  box-shadow: 0 2px 8px #0001;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, var(--primary3), var(--primary2), var(--primary1));
  transform: translateY(-2px) scale(1.04);
}

.notification-banner {
  background: #fff3cd;
  color: #856404;
  padding: 1em;
  border-radius: var(--radius);
  margin-bottom: 2em;
  border: 1px solid #ffeeba;
  position: relative;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5em;
}

.bell-icon {
  font-size: 1.2em;
  margin-right: 0.5em;
}

.notification-title {
  font-weight: 700;
  font-family: 'Raleway', 'Segoe UI', Arial, sans-serif;
}

.dismiss-btn {
  background: transparent;
  border: none;
  color: #856404;
  cursor: pointer;
  font-size: 1.2em;
  position: absolute;
  top: 0.5em;
  right: 0.5em;
}

.changes-list {
  max-height: 300px;
  overflow-y: auto;
}

.change-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5em 0;
  border-bottom: 1px solid #e1e5e9;
}

.change-item:last-child {
  border-bottom: none;
}

.keyword {
  font-weight: 600;
}

.change-text {
  flex: 1;
  margin: 0 0.5em;
}

.change-indicator {
  font-size: 1.2em;
}

.positive {
  color: #155724;
}

.negative {
  color: #721c24;
}

.new {
  color: #0c5460;
}

.lost {
  color: #721c24;
}

.more-changes {
  text-align: center;
  padding: 0.5em 0;
  color: #856404;
  font-weight: 500;
}
@media (max-width: 800px) {
  .main-container {
    max-width: 98vw;
    padding: 1em 0.5em;
  }
  table, th, td {
    font-size: 0.95em;
  }
  .form-row {
    flex-direction: column;
    gap: 0.5em;
  }
  
  .keyword-checkboxes {
    grid-template-columns: 1fr;
    gap: 0.5em;
  }
  
  .chart-container {
    padding: 1em;
    height: 400px;
  }
}
.notification-banner {
  background: linear-gradient(135deg, #fff8e1, #f3e5f5);
  border: 2px solid var(--primary1);
  border-radius: var(--radius);
  margin-bottom: 2em;
  box-shadow: 0 4px 20px rgba(85, 195, 159, 0.2);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1em 1.5em;
  background: rgba(85, 195, 159, 0.1);
  border-bottom: 1px solid rgba(85, 195, 159, 0.2);
}

.bell-icon {
  font-size: 1.2em;
  margin-right: 0.5em;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-10deg); }
  75% { transform: rotate(10deg); }
}

.notification-title {
  font-weight: 700;
  color: var(--primary2);
  font-family: 'Raleway', sans-serif;
}

.dismiss-btn {
  background: transparent;
  border: none;
  font-size: 1.2em;
  color: #666;
  cursor: pointer;
  padding: 0.2em 0.5em;
  border-radius: 50%;
  transition: background 0.2s;
}

.dismiss-btn:hover {
  background: rgba(0,0,0,0.1);
  transform: none;
}

.changes-list {
  padding: 1em 1.5em;
}

.change-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.keyword-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em;
  background: white;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.2s;
  font-family: 'Raleway', sans-serif;
}

.keyword-checkbox:hover {
  background: #f0f8ff;
}

.keyword-checkbox input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}

.needs-refresh {
  background: #fff3cd !important;
}

.placeholder {
  color: #856404;
  font-style: italic;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  margin-right: 1em;
}

.form-group label {
  font-weight: 600;
  color: var(--primary2);
  font-size: 0.9em;
}

/* Fix notification styles */
.change-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8em 1em;
  margin-bottom: 0.5em;
  border-radius: var(--radius);
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.change-item:hover {
  transform: translateX(5px);
}

.change-item.positive {
  border-left: 4px solid #4caf50;
  background: linear-gradient(90deg, #e8f5e8, white);
}

.change-item.negative {
  border-left: 4px solid #f44336;
  background: linear-gradient(90deg, #ffebee, white);
}

.keyword {
  font-weight: 600;
  color: var(--primary2);
  min-width: 120px;
}

.change-text {
  flex: 1;
  margin: 0 1em;
  font-size: 0.9em;
}

.change-indicator {
  font-size: 1.2em;
}

/* Notification Banner Styles */
.notification-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 1em 1.5em;
  color: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  transform: translateY(-100%);
  animation: slideDown 0.3s ease-out forwards;
}

.notification-banner.success {
  background: linear-gradient(90deg, #4caf50, #45a049);
}

.notification-banner.warning {
  background: linear-gradient(90deg, #ff9800, #f57c00);
}

.notification-banner.info {
  background: linear-gradient(90deg, #2196f3, #1976d2);
}

.notification-banner.error {
  background: linear-gradient(90deg, #f44336, #d32f2f);
}

.notification-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
}

.notification-message {
  font-weight: 500;
  font-size: 0.95em;
}

.notification-close {
  background: none;
  border: none;
  color: white;
  font-size: 1.5em;
  cursor: pointer;
  padding: 0;
  margin-left: 1em;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.notification-close:hover {
  opacity: 1;
}

@keyframes slideDown {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}

/* Adjust app container to accommodate notification banner */
.app-container {
  padding-top: 0;
  transition: padding-top 0.3s ease;
}

.notification-banner ~ .sidebar,
.notification-banner ~ .main-content {
  margin-top: 4em;
}
</style>
