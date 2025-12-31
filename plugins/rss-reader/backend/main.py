import os
import feedparser
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import hashlib

load_dotenv()

router = APIRouter()

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# In-memory storage (replace with database in production)
rss_feeds = []  # List of RSS feed URLs
articles = []  # List of articles from all feeds
article_qa_cache = {}  # Cache for generated Q&A: {article_id: [{q, a}, ...]}

# Scheduler for daily RSS fetching
scheduler = AsyncIOScheduler()

# Initialize scheduler on module load
def init_scheduler():
    """Initialize scheduler with daily RSS fetch job"""
    try:
        if not scheduler.running:
            scheduler.add_job(
                fetch_all_feeds,
                CronTrigger(hour=6, minute=0),
                id="daily_rss_fetch",
                replace_existing=True
            )
            scheduler.start()
            print("✅ RSS scheduler started - feeds will be fetched daily at 6 AM")
    except Exception as e:
        print(f"⚠️  Failed to start RSS scheduler: {e}")
        print("   Scheduler will not run but plugin will still work")

# Start scheduler when module loads
init_scheduler()


class RSSFeed(BaseModel):
    id: Optional[str] = None
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    added_at: str
    last_fetched: Optional[str] = None
    article_count: int = 0


class Article(BaseModel):
    id: str
    feed_id: str
    title: str
    link: str
    description: Optional[str] = None
    content: Optional[str] = None
    published: Optional[str] = None
    author: Optional[str] = None
    fetched_at: str


class QuestionRequest(BaseModel):
    question: str


class QAPair(BaseModel):
    question: str
    answer: str


def generate_id(text: str) -> str:
    """Generate a unique ID from text using hash"""
    return hashlib.md5(text.encode()).hexdigest()[:12]


async def fetch_rss_feed(feed_url: str) -> List[Article]:
    """Fetch articles from an RSS feed"""
    try:
        print(f"📡 Fetching RSS feed: {feed_url}")
        feed = feedparser.parse(feed_url)

        if feed.bozo:
            print(f"⚠️  Warning parsing feed {feed_url}: {feed.bozo_exception}")

        feed_id = generate_id(feed_url)
        new_articles = []

        for entry in feed.entries:
            # Generate unique article ID from link
            article_id = generate_id(entry.get('link', ''))

            # Skip if article already exists
            if any(a.id == article_id for a in articles):
                continue

            # Extract content (prefer content over summary)
            content = ""
            if hasattr(entry, 'content'):
                content = entry.content[0].value if entry.content else ""
            elif hasattr(entry, 'summary'):
                content = entry.summary

            article = Article(
                id=article_id,
                feed_id=feed_id,
                title=entry.get('title', 'No Title'),
                link=entry.get('link', ''),
                description=entry.get('summary', '')[:500] if entry.get('summary') else None,
                content=content,
                published=entry.get('published', entry.get('updated', None)),
                author=entry.get('author', None),
                fetched_at=datetime.now().isoformat()
            )

            new_articles.append(article)
            articles.append(article)

        print(f"✅ Fetched {len(new_articles)} new articles from {feed_url}")
        return new_articles

    except Exception as e:
        print(f"❌ Error fetching RSS feed {feed_url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch RSS feed: {str(e)}")


async def fetch_all_feeds():
    """Fetch articles from all RSS feeds (scheduled task)"""
    print("🔄 Running scheduled RSS fetch for all feeds...")
    for feed in rss_feeds:
        try:
            await fetch_rss_feed(feed['url'])
            # Update last_fetched timestamp
            for f in rss_feeds:
                if f['id'] == feed['id']:
                    f['last_fetched'] = datetime.now().isoformat()
                    f['article_count'] = len([a for a in articles if a.feed_id == feed['id']])
        except Exception as e:
            print(f"❌ Error in scheduled fetch for {feed['url']}: {str(e)}")
    print("✅ Scheduled RSS fetch completed")


async def generate_article_qa(article: Article, num_questions: int = 5) -> List[QAPair]:
    """Generate suggested Q&A for an article using OpenAI"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        # Prepare article content
        article_text = f"Title: {article.title}\n\n"
        if article.content:
            article_text += f"Content: {article.content[:3000]}"  # Limit to avoid token limits
        elif article.description:
            article_text += f"Description: {article.description}"

        prompt = f"""Based on this article, generate {num_questions} insightful questions and answers that would help a reader better understand the content. Focus on key concepts, implications, and practical applications.

{article_text}

Format your response as a JSON array of objects with 'question' and 'answer' fields. Example:
[
  {{"question": "What is the main topic?", "answer": "The main topic is..."}},
  {{"question": "Why is this important?", "answer": "This is important because..."}}
]"""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that generates insightful questions and answers about articles to help readers understand the content better."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1500
        )

        # Parse the response
        import json
        qa_text = response.choices[0].message.content.strip()

        # Try to extract JSON from the response
        if qa_text.startswith('['):
            qa_data = json.loads(qa_text)
        else:
            # Try to find JSON array in the response
            start = qa_text.find('[')
            end = qa_text.rfind(']') + 1
            if start != -1 and end > start:
                qa_data = json.loads(qa_text[start:end])
            else:
                qa_data = []

        qa_pairs = [QAPair(**item) for item in qa_data]
        return qa_pairs

    except Exception as e:
        print(f"❌ Error generating Q&A: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Q&A: {str(e)}")


async def answer_question(article: Article, question: str) -> str:
    """Answer a follow-up question about an article using OpenAI"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        # Prepare article content
        article_text = f"Title: {article.title}\n\n"
        if article.content:
            article_text += f"Content: {article.content[:3000]}"
        elif article.description:
            article_text += f"Description: {article.description}"

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that answers questions about articles. Base your answers on the article content provided."},
                {"role": "user", "content": f"Article:\n{article_text}\n\nQuestion: {question}"}
            ],
            temperature=0.7,
            max_tokens=500
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Error answering question: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")


@router.get("/feeds")
async def get_feeds():
    """Get all RSS feeds"""
    return rss_feeds


@router.post("/feeds")
async def add_feed(feed: RSSFeed):
    """Add a new RSS feed and fetch initial articles"""
    # Generate ID from URL
    feed_id = generate_id(feed.url)

    # Check if feed already exists
    if any(f['id'] == feed_id for f in rss_feeds):
        raise HTTPException(status_code=400, detail="Feed already exists")

    # Try to fetch the feed to validate it
    try:
        parsed_feed = feedparser.parse(feed.url)
        if parsed_feed.bozo and not parsed_feed.entries:
            raise HTTPException(status_code=400, detail="Invalid RSS feed URL")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse RSS feed: {str(e)}")

    # Create feed object
    new_feed = {
        "id": feed_id,
        "url": feed.url,
        "title": parsed_feed.feed.get('title', feed.url),
        "description": parsed_feed.feed.get('description', ''),
        "added_at": datetime.now().isoformat(),
        "last_fetched": None,
        "article_count": 0
    }

    rss_feeds.append(new_feed)

    # Fetch articles from the new feed
    await fetch_rss_feed(feed.url)

    # Update article count
    new_feed['last_fetched'] = datetime.now().isoformat()
    new_feed['article_count'] = len([a for a in articles if a.feed_id == feed_id])

    return new_feed


@router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: str):
    """Delete an RSS feed and its articles"""
    global rss_feeds, articles

    # Find and remove feed
    feed = next((f for f in rss_feeds if f['id'] == feed_id), None)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    rss_feeds = [f for f in rss_feeds if f['id'] != feed_id]

    # Remove articles from this feed
    articles = [a for a in articles if a.feed_id != feed_id]

    # Remove Q&A cache for articles from this feed
    article_qa_cache.clear()  # Simple clear for now

    return {"message": "Feed deleted successfully", "feed_id": feed_id}


@router.post("/feeds/{feed_id}/refresh")
async def refresh_feed(feed_id: str):
    """Manually refresh a specific feed"""
    feed = next((f for f in rss_feeds if f['id'] == feed_id), None)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    new_articles = await fetch_rss_feed(feed['url'])

    # Update last_fetched and article_count
    feed['last_fetched'] = datetime.now().isoformat()
    feed['article_count'] = len([a for a in articles if a.feed_id == feed_id])

    return {
        "message": "Feed refreshed successfully",
        "new_articles": len(new_articles),
        "total_articles": feed['article_count']
    }


@router.get("/articles")
async def get_articles(feed_id: Optional[str] = None, limit: int = 50):
    """Get articles, optionally filtered by feed_id"""
    filtered_articles = articles

    if feed_id:
        filtered_articles = [a for a in articles if a.feed_id == feed_id]

    # Sort by fetched_at (most recent first)
    sorted_articles = sorted(
        filtered_articles,
        key=lambda a: a.fetched_at,
        reverse=True
    )

    return sorted_articles[:limit]


@router.get("/articles/{article_id}")
async def get_article(article_id: str):
    """Get a specific article"""
    article = next((a for a in articles if a.id == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return article


@router.get("/articles/{article_id}/qa")
async def get_article_qa(article_id: str, regenerate: bool = False):
    """Get or generate suggested Q&A for an article"""
    article = next((a for a in articles if a.id == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check cache
    if article_id in article_qa_cache and not regenerate:
        return article_qa_cache[article_id]

    # Generate Q&A
    qa_pairs = await generate_article_qa(article)

    # Cache the results
    article_qa_cache[article_id] = [qa.dict() for qa in qa_pairs]

    return article_qa_cache[article_id]


@router.post("/articles/{article_id}/question")
async def ask_question(article_id: str, request: QuestionRequest):
    """Ask a follow-up question about an article"""
    article = next((a for a in articles if a.id == article_id), None)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    answer = await answer_question(article, request.question)

    return {
        "question": request.question,
        "answer": answer
    }


@router.get("/stats")
async def get_stats():
    """Get RSS reader statistics"""
    return {
        "total_feeds": len(rss_feeds),
        "total_articles": len(articles),
        "articles_by_feed": {
            feed['title']: len([a for a in articles if a.feed_id == feed['id']])
            for feed in rss_feeds
        },
        "scheduler_running": scheduler.running
    }
