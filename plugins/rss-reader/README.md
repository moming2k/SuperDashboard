# RSS Reader Plugin

An AI-powered RSS feed reader for SuperDashboard with automated daily fetching, article management, and intelligent Q&A capabilities.

## Features

### Core Functionality
- 📰 **RSS Feed Management**: Add and manage multiple RSS feeds
- 🔄 **Automated Daily Fetching**: Scheduler automatically fetches new articles at 6 AM daily
- 📱 **Manual Refresh**: Refresh any feed on-demand to get latest articles
- 📚 **Article Storage**: All articles stored in-memory for quick access
- 🔍 **Feed Filtering**: View articles from all feeds or filter by specific feed

### AI-Powered Features
- 🤖 **AI-Generated Q&A**: Automatically generates 5 insightful questions and answers for each article
- 💬 **Follow-up Questions**: Ask custom questions about any article and get AI-powered answers
- 🧠 **Context-Aware**: AI answers are based on the article content using GPT-4

### User Interface
- 🎨 **Modern Design**: Glass-morphism UI consistent with SuperDashboard theme
- 📊 **Feed Statistics**: View article counts per feed and total statistics
- 📖 **Article Reader**: Clean reading experience with suggested Q&A
- 💡 **Interactive Q&A**: Chat-like interface for asking follow-up questions

## Prerequisites

- **OpenAI API Key**: Required for AI-powered Q&A features
- **Python Dependencies**: feedparser, APScheduler (auto-installed)

## Installation

### 1. Install Dependencies

The plugin requires additional Python packages. Install them:

```bash
cd backend
pip install feedparser APScheduler
```

Or reinstall all requirements:

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure OpenAI API Key

Add your OpenAI API key to `backend/.env`:

```bash
OPENAI_API_KEY=sk-your_openai_key_here
```

### 3. Restart Backend

```bash
cd backend
python main.py
```

The RSS Reader plugin will automatically be loaded and the scheduler will start.

## Usage

### Adding RSS Feeds

1. Click **RSS Reader** in the sidebar
2. Click **+ Add Feed** button
3. Enter the RSS feed URL (e.g., `https://techcrunch.com/feed/`)
4. Click **Add Feed**

The plugin will:
- Validate the RSS feed
- Fetch initial articles immediately
- Add the feed to your collection
- Start including it in daily fetches

### Viewing Articles

- **All Articles**: Click "All Articles" to view articles from all feeds
- **Filter by Feed**: Click any feed in the sidebar to view only its articles
- **Read Article**: Click any article to open the reader view

### Using AI Q&A Features

#### Suggested Q&A

When you open an article, the plugin automatically:
1. Analyzes the article content
2. Generates 5 insightful questions and answers
3. Displays them in the "Suggested Questions & Answers" section

These Q&A pairs help you:
- Understand key concepts quickly
- Grasp the main points
- See practical applications
- Learn implications and context

#### Ask Follow-up Questions

In the article reader:
1. Scroll to "Ask a Follow-up Question" section
2. Type your question in the input field
3. Click **Ask** or press Enter
4. Get an AI-powered answer based on the article content

Example questions:
- "What are the practical applications of this?"
- "How does this compare to existing solutions?"
- "What are the potential risks mentioned?"
- "Can you explain [specific term] in simpler terms?"

### Managing Feeds

#### Refresh a Feed

- Click **↻ Refresh** on any feed to fetch new articles immediately
- Useful when you know new content is available

#### Delete a Feed

- Click **Delete** on any feed
- Confirms before deletion
- Removes the feed and all its articles

### Scheduler

The plugin includes an automated scheduler that:
- Runs daily at **6:00 AM**
- Fetches new articles from all feeds
- Updates article counts
- Logs activity to console

The scheduler starts automatically when the backend starts.

## API Endpoints

### Feed Management

```bash
# Get all feeds
GET /plugins/rss-reader/feeds

# Add a new feed
POST /plugins/rss-reader/feeds
Body: {"url": "https://example.com/feed"}

# Delete a feed
DELETE /plugins/rss-reader/feeds/{feed_id}

# Refresh a feed
POST /plugins/rss-reader/feeds/{feed_id}/refresh
```

### Articles

```bash
# Get all articles (optionally filter by feed)
GET /plugins/rss-reader/articles?feed_id={feed_id}&limit=50

# Get specific article
GET /plugins/rss-reader/articles/{article_id}

# Get suggested Q&A for article
GET /plugins/rss-reader/articles/{article_id}/qa?regenerate=false

# Ask a question about article
POST /plugins/rss-reader/articles/{article_id}/question
Body: {"question": "Your question here"}
```

### Statistics

```bash
# Get RSS reader statistics
GET /plugins/rss-reader/stats
```

## Supported RSS Formats

The plugin supports:
- **RSS 2.0**: Most common format used by blogs and news sites
- **Atom 1.0**: Modern alternative to RSS
- **RSS 1.0 (RDF)**: Older format, still used by some sites

## Example RSS Feeds

Try these popular feeds:

### Technology
- **TechCrunch**: `https://techcrunch.com/feed/`
- **Hacker News**: `https://hnrss.org/frontpage`
- **The Verge**: `https://www.theverge.com/rss/index.xml`
- **Ars Technica**: `http://feeds.arstechnica.com/arstechnica/index`

### News
- **NY Times Technology**: `https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml`
- **BBC News**: `http://feeds.bbci.co.uk/news/rss.xml`
- **Reuters**: `https://www.reutersagency.com/feed/`

### Development
- **Dev.to**: `https://dev.to/feed`
- **CSS Tricks**: `https://css-tricks.com/feed/`
- **Smashing Magazine**: `https://www.smashingmagazine.com/feed/`

### AI & ML
- **OpenAI Blog**: `https://openai.com/blog/rss/`
- **Google AI Blog**: `https://ai.googleblog.com/feeds/posts/default`

## Architecture

### Backend (`backend/main.py`)

```
┌─────────────────────┐
│   RSS Feeds DB      │
│  (in-memory list)   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  APScheduler        │
│  (Daily @ 6 AM)     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  feedparser         │
│  (Parse RSS/Atom)   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Articles DB       │
│  (in-memory list)   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   OpenAI GPT-4      │
│  (Q&A Generation)   │
└─────────────────────┘
```

### Frontend (`frontend/RSSReader.jsx`)

```
┌─────────────────────┐
│  Feed Management    │
│  (Add/Delete/List)  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Article List       │
│  (Grid View)        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Article Reader     │
│  - Content Display  │
│  - Suggested Q&A    │
│  - Follow-up Q&A    │
└─────────────────────┘
```

## Data Storage

Currently uses **in-memory storage** for simplicity:
- RSS feeds stored in `rss_feeds` list
- Articles stored in `articles` list
- Q&A cache in `article_qa_cache` dict

**For production**, consider:
- PostgreSQL or MongoDB for persistence
- Redis for Q&A caching
- Proper indexing for fast queries

## Scheduler Details

The APScheduler runs asynchronously and:
- **Trigger**: CronTrigger at 6:00 AM daily
- **Job ID**: `daily_rss_fetch`
- **Function**: `fetch_all_feeds()`
- **Behavior**: Fetches all feeds sequentially, logs errors but continues

To modify the schedule, edit this line in `backend/main.py`:

```python
scheduler.add_job(
    fetch_all_feeds,
    CronTrigger(hour=6, minute=0),  # Change time here
    id="daily_rss_fetch",
    replace_existing=True
)
```

## Performance Considerations

### Article Fetching
- Initial fetch happens when feed is added
- Daily scheduled fetch at 6 AM
- Manual refresh available per feed
- Duplicate detection by article link hash

### AI Q&A Generation
- Generated on-demand when article is viewed
- Cached after first generation
- Use `?regenerate=true` to regenerate Q&A
- Limited to ~3000 characters of article content to avoid token limits

### Frontend Polling
- Articles refresh every 60 seconds
- Can be adjusted in `RSSReader.jsx`

## Troubleshooting

### Feeds Not Loading

**Problem**: Feed returns error when adding

**Solutions**:
1. Verify the URL is a valid RSS/Atom feed
2. Check if the feed requires authentication
3. Look for CORS issues in browser console
4. Try the feed URL in a browser first

### Scheduler Not Running

**Problem**: Articles not fetching daily

**Solutions**:
1. Check backend console for scheduler logs
2. Verify scheduler started: "RSS scheduler started" message
3. Restart backend to reinitialize scheduler
4. Check `/plugins/rss-reader/stats` endpoint - `scheduler_running` should be `true`

### AI Q&A Not Working

**Problem**: Q&A generation fails or returns errors

**Solutions**:
1. Verify `OPENAI_API_KEY` is set in `.env`
2. Check OpenAI API credits/quota
3. Look for errors in backend console
4. Try regenerating with `?regenerate=true`

### Articles Have No Content

**Problem**: Articles show title but no content

**Solutions**:
1. Some feeds only provide summaries, not full content
2. Use "Read Original" link to view full article
3. This is a limitation of the feed itself, not the plugin

## Future Enhancements

Potential improvements:
- [ ] Database persistence (PostgreSQL/MongoDB)
- [ ] Full-text search across articles
- [ ] Categories/tags for feeds
- [ ] Favorite/bookmark articles
- [ ] Export articles to PDF/Markdown
- [ ] RSS feed discovery (suggest feeds)
- [ ] Customizable fetch schedule per feed
- [ ] Email digests of new articles
- [ ] Article read/unread tracking
- [ ] Social sharing integration

## Security Notes

1. **Input Validation**: Feed URLs are validated before parsing
2. **HTML Sanitization**: Article content should be sanitized (consider using DOMPurify)
3. **API Keys**: Never commit `.env` file with API keys
4. **Rate Limiting**: Consider adding rate limits for Q&A generation
5. **Content Safety**: OpenAI content policy applies to generated Q&A

## Cost Considerations

### OpenAI API Costs

- **Q&A Generation**: ~$0.02-0.05 per article (5 Q&A pairs)
- **Follow-up Questions**: ~$0.01-0.03 per question
- **Model**: GPT-4 (most accurate, higher cost)

**Cost-saving tips**:
- Cache generated Q&A (already implemented)
- Switch to GPT-3.5-Turbo for lower costs
- Limit Q&A generation to favorite articles
- Set monthly budget in OpenAI dashboard

### Typical Usage Costs

- **50 feeds, 100 articles/day**: ~$5-10/month
- **10 feeds, 20 articles/day**: ~$1-2/month

## License

MIT License - Copyright 2025 Chris Chan

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review backend logs for errors
3. Verify all prerequisites are met
4. Check OpenAI API status
