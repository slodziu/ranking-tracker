<script lang="ts">
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import 'chartjs-adapter-date-fns';
  
  // Navigation state
  let currentView = 'purplefish'; // 'purplefish', 'clients', or 'analytics'
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
  let analyticsAccount = 'purplefish'; // 'purplefish' or client ID
  let analyticsClient: any = null;
  let availableKeywords: string[] = [];
  let selectedKeywords: Set<string> = new Set();
  let chartInstance: Chart | null = null;
  let chartCanvas: HTMLCanvasElement;
  let historicalData: any[] = [];

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
        // Add placeholder for keywords that need fresh data
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
          // Add placeholder for keywords that need fresh data
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

  // Switch between views
  function switchView(view: string) {
    currentView = view;
    error = '';
    
    // Auto-load data when switching views
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

  // Load analytics data when account changes
  async function loadAnalyticsData() {
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

  // Load historical data for chart
  async function loadHistoricalData(type: string, clientId?: number) {
    const params = new URLSearchParams({
      type,
      days: '30'
    });
    
    if (type === 'client' && clientId) {
      params.append('client_id', clientId.toString());
    }

    try {
      const resp = await fetch(`/api/historical?${params}`);
      const data = await resp.json();
      
      if (!data.error) {
        historicalData = data;
      }
    } catch (e) {
      console.error('Error loading historical data:', e);
      historicalData = [];
    }
  }

  // Toggle keyword selection for chart
  function toggleKeyword(keyword: string) {
    if (selectedKeywords.has(keyword)) {
      selectedKeywords.delete(keyword);
    } else {
      selectedKeywords.add(keyword);
    }
    selectedKeywords = selectedKeywords; // Trigger reactivity
    updateChart();
  }

  // Update chart with selected keywords
  function updateChart() {
  console.log('🔍 DEBUG: updateChart called');
  console.log('📊 Selected keywords:', Array.from(selectedKeywords));
  console.log('📈 Historical data:', historicalData);
  
  if (!chartCanvas || selectedKeywords.size === 0) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
  }

  const datasets = [];
  const colors = ['#55c39f', '#676fff', '#d66f8d', '#f39c12', '#9b59b6', '#1abc9c'];
  let colorIndex = 0;

  Array.from(selectedKeywords).forEach(keyword => {
    console.log(`🔎 Processing keyword: ${keyword}`);
    
    const keywordData = historicalData
      .filter(d => {
        const keywordName = d.keywords?.keyword || d.client_keywords?.keyword;
        const matches = keywordName === keyword;
        console.log(`  📝 Data point: ${keywordName} matches ${keyword}? ${matches}`, d);
        return matches;
      })
      .map(d => {
        const rank = d.result_JSON?.organicRank;
        const dataPoint = {
          x: d.date,
          y: rank === 'Not found' || rank === null || rank === undefined ? null : parseInt(rank) || null,
          originalRank: rank
        };
        console.log(`  📊 Data point mapped:`, dataPoint);
        return dataPoint;
      })
      .filter(d => {
        const hasValidY = d.y !== null;
        console.log(`  ✅ Data point has valid Y (${d.y})?`, hasValidY);
        return hasValidY;
      }) // Only include actual rankings
      .sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime());

    console.log(`📈 Final keyword data for ${keyword}:`, keywordData);

    if (keywordData.length > 0) {
      datasets.push({
        label: keyword,
        data: keywordData,
        borderColor: colors[colorIndex % colors.length],
        backgroundColor: colors[colorIndex % colors.length] + '40', // More visible background
        fill: false,
        tension: 0.1,
        pointRadius: 8, // Bigger points
        pointHoverRadius: 12, // Even bigger on hover
        pointBackgroundColor: colors[colorIndex % colors.length], // Point color
        pointBorderColor: '#fff', // White border for contrast
        pointBorderWidth: 2,
        borderWidth: 4 // Thicker line
      });
      colorIndex++;
    }
  });

  console.log('📊 Final datasets:', datasets);

  // Find the earliest and latest dates across all selected keywords
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
          suggestedMax: 10, // Add this to ensure Y-axis shows properly
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
      elements: {
        point: {
          radius: 6, // Make points bigger
          hoverRadius: 8
        },
        line: {
          borderWidth: 3 // Make lines thicker
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

  // Watch for analytics account changes
  $: if (analyticsAccount) {
    loadAnalyticsData();
  }

  // Update selectClient to auto-load data
  async function selectClient(client: any) {
    selectedClient = client;
    const resp = await fetch(`/api/client-keywords?client_id=${client.id}`);
    const data = await resp.json();
    if (!data.error) {
      clientKeywords = data;
      await autoLoadClientData(); // Auto-load after getting keywords
    }
  }

  // Modified fetchClientRankings to save to database
  async function fetchClientRankings() {
    if (!serpApiKey || !selectedClient) {
      error = 'Please enter your SerpApi key and select a client.';
      return;
    }
    
    loading = true;
    error = '';
    clientResults = [];
    const today = new Date().toISOString().slice(0, 10);
    
    for (const k of clientKeywords) {
      try {
        const resp = await fetch('/api/serpapi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k.keyword, apiKey: serpApiKey })
        });
        const serpRes = await resp.json();

        const organic = serpRes.organic_results || [];
        const clientIndex = organic.findIndex((r: any) =>
          r.link && r.link.includes(selectedClient.website_url?.replace('https://', '').replace('http://', ''))
        );
        
        const local = serpRes.local_results?.places || [];
        const clientLocalIndex = local.findIndex((r: any) =>
          r.title && r.title.toLowerCase().includes(selectedClient.google_business_name?.toLowerCase() || selectedClient.name.toLowerCase())
        );
        
        const paa = serpRes.related_questions?.map((q: any) => q.question) || [];

        const result = {
          organicRank: clientIndex >= 0 ? clientIndex + 1 : 'Not found',
          localRank: clientLocalIndex >= 0 ? clientLocalIndex + 1 : 'Not found',
          paa
        };
        
        clientResults = [...clientResults, { keyword: k.keyword, ...result }];

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
        clientResults = [...clientResults, {
          keyword: k.keyword,
          organicRank: 'Error',
          localRank: 'Error',
          paa: [],
          error: 'Error fetching this keyword'
        }];
      }
    }
    loading = false;
    lastUpdated = new Date().toLocaleString();
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
      }
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
    const resp = await fetch('/api/keywords', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await resp.json();
    if (!data.error) {
      keywords = keywords.filter(k => k.id !== id);
      // Optionally, refresh results
      results = results.filter(r => r.keyword !== keywords.find(k => k.id === id)?.keyword);
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
    results = [];
    const todayResults = await fetchResults();
    
    for (const k of keywords) {
      const cached = todayResults.find((r: any) => r.keyword_id === k.id);
      
      // Check if cached result exists AND has valid result_JSON (not null)
      if (cached && cached.result_JSON !== null) {
        results = [...results, { keyword: k.keyword, ...cached.result_JSON }];
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
        results = [...results, { keyword: k.keyword, ...result }];

        // Save/update result to Supabase
        const today = new Date().toISOString().slice(0, 10);
        await fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword_id: k.id, result_JSON: result, date: today })
        });
      } catch (e) {
        results = [...results, {
          keyword: k.keyword,
          organicRank: 'Error',
          localRank: 'Error',
          paa: [],
          error: 'Error fetching this keyword'
        }];
        error = 'Some keywords could not be fetched. Check your API key and quota.';
      }
    }
    loading = false;
    lastUpdated = new Date().toLocaleString();
  }

  // On mount: fetch keywords, then fetch rankings
  onMount(async () => {
    keywords = await fetchKeywords();
    await fetchClients();
    
    // Auto-load Purplefish data if keywords exist
    if (keywords.length > 0) {
      await autoLoadPurplefishData();
    }
  });

  // Add this function after your other functions
  async function deleteClientKeyword(id: number | undefined) {
    if (!id) {
      error = 'Cannot delete keyword: ID not found';
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
    } else {
      error = data.error;
    }
  }
</script>

<div class="app-container">
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

    {:else if currentView === 'analytics'}
      <h1>SEO Analytics & Trends</h1>
      
      <!-- Account Selection -->
      <div class="form-row">
        <label>
          Select Account:
          <select bind:value={analyticsAccount}>
            <option value="purplefish">Purplefish</option>
            {#each clients as client}
              <option value={client.id.toString()}>{client.name}</option>
            {/each}
          </select>
        </label>
      </div>

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
    {/if}
  </main>
</div>

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
</style>
