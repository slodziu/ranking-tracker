# 🐟 SEO Ranking Tracker

A professional SEO ranking tracker built with SvelteKit and Supabase for monitoring keyword positions across Google Search and Google Business listings.

![SEO Tracker Dashboard](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

## Features

###  **Purplefish Tracking**
- Track your agency's organic search rankings
- Monitor Google Business Profile positions
- People Also Ask (PAA) analysis
- Historical ranking trends

###  **Multi-Client Management**
- Add unlimited clients with website URLs and Google Business names
- Individual keyword tracking per client
- Client-specific ranking reports
- Separate analytics for each client

###  **Advanced Analytics**
- Interactive time-series charts with Chart.js
- Flexible date range selection (7 days to 1 year + custom ranges)
- Keyword performance comparison
- Visual ranking trend analysis
- Professional data visualization

###  **Smart Data Management**
- Automatic daily result caching
- Preserve existing data on API errors
- Intelligent refresh system
- Real-time ranking updates

##  Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- SerpAPI account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/seo-ranking-tracker.git
cd seo-ranking-tracker
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase database**
Run these SQL commands in your Supabase SQL editor:

```sql
-- Keywords table for Purplefish
CREATE TABLE keywords (
  id SERIAL PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Results table for Purplefish
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  keyword_id INT REFERENCES keywords(id) ON DELETE CASCADE,
  result_JSON JSONB,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(keyword_id, date)
);

-- Clients table
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  website_url TEXT,
  google_business_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Client keywords table
CREATE TABLE client_keywords (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, keyword)
);

-- Client results table
CREATE TABLE client_results (
  id SERIAL PRIMARY KEY,
  client_keyword_id INT REFERENCES client_keywords(id) ON DELETE CASCADE,
  result_JSON JSONB,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_keyword_id, date)
);
```

5. **Run the development server**
```bash
npm run dev
```

6. **Open your browser**
Navigate to `http://localhost:5173`

## Usage

### Initial Setup
1. Enter your SerpAPI key in the password field
2. Add keywords you want to track
3. Click "Refresh" to get initial rankings

### Adding Clients
1. Navigate to the "Clients" tab
2. Click "Add Client" and fill in:
   - Client name
   - Website URL
   - Google Business name (for local search tracking)
3. Add keywords for each client
4. Refresh to get client rankings

### Analytics & Trends
1. Go to the "Analytics" tab
2. Select Purplefish or a client account
3. Choose your time frame (7 days to 1 year or custom range)
4. Select keywords to visualize
5. View interactive ranking charts

### Dashboard
- Clean, professional interface
- Real-time ranking data
- Color-coded results

### Analytics
- Interactive Chart.js visualizations
- Time-series ranking trends
- Multi-keyword comparison

### Client Management
- Individual client tracking
- Separate keyword sets
- Client-specific analytics

##  Tech Stack

- **Frontend**: SvelteKit, TypeScript, Chart.js
- **Backend**: SvelteKit API routes
- **Database**: Supabase (PostgreSQL)
- **APIs**: SerpAPI for search data
- **Styling**: Custom CSS with CSS Grid/Flexbox
- **Fonts**: Google Fonts (Raleway)

## API Endpoints

- `GET /api/keywords` - Get all keywords
- `POST /api/keywords` - Add new keyword
- `DELETE /api/keywords` - Delete keyword
- `GET /api/results` - Get today's results
- `POST /api/results` - Save ranking results
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Add new client
- `GET /api/historical` - Get historical data for charts
- `POST /api/serpapi` - Proxy to SerpAPI

## Security Features

- Environment variables for sensitive data
- Password-protected SerpAPI key input
- Error handling with data preservation
- Supabase Row Level Security ready

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Environment Variables for Production
```env
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_supabase_key
```

## Features in Detail

### Ranking Tracking
- **Organic Search**: Track positions 1-100+ on Google
- **Local Search**: Monitor Google Business Profile rankings
- **PAA Analysis**: Capture "People Also Ask" opportunities
- **Historical Data**: Store and analyze ranking changes over time

### Client Management
- **Multi-tenant**: Separate data for each client
- **Flexible Setup**: Custom website URLs and business names
- **Individual Analytics**: Client-specific trend analysis

### Smart Caching
- **Daily Results**: Automatic result storage
- **API Optimization**: Minimize SerpAPI calls
- **Error Recovery**: Preserve data during API failures


