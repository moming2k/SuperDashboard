import os
import feedparser
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import hashlib
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from sqlalchemy.orm import Session
import sys
import os

# Add the plugin directory to the path for imports
sys.path.insert(0, os.path.dirname(__file__))

# Import database and models
from database import get_db, init_db
from models import Feed as FeedModel, Article as ArticleModel

load_dotenv()

router = APIRouter()

# OpenAI configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Database availability flag
database_available = False

# Initialize database tables
try:
    init_db()
    database_available = True
    print("📚 Database initialized successfully")
except Exception as e:
    print(f"⚠️  Database initialization error: {e}")
    print("   Plugin will work with limited functionality (no persistence)")


# Cache for generated Q&A: {article_id: [{q, a}, ...]}
article_qa_cache = {}

# Scheduler for daily RSS fetching
scheduler = AsyncIOScheduler()
scheduler_initialized = False

# Initialize scheduler when event loop is available
def init_scheduler():
    """Initialize scheduler with daily RSS fetch job"""
    global scheduler_initialized
    if scheduler_initialized:
        return
    
    try:
        if not scheduler.running:
            scheduler.add_job(
                fetch_all_feeds,
                CronTrigger(hour=6, minute=0),
                id="daily_rss_fetch",
                replace_existing=True
            )
            scheduler.start()
            scheduler_initialized = True
            print("✅ RSS scheduler started - feeds will be fetched daily at 6 AM")
    except Exception as e:
        print(f"⚠️  Failed to start RSS scheduler: {e}")
        print("   Scheduler will not run but plugin will still work")



class RSSFeed(BaseModel):
    id: Optional[str] = None
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    added_at: Optional[str] = None
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
    is_read: bool = False
    is_starred: bool = False
    read_at: Optional[str] = None


class QuestionRequest(BaseModel):
    question: str


class QAPair(BaseModel):
    question: str
    answer: str


def generate_id(text: str) -> str:
    """Generate a unique ID from text using hash"""
    return hashlib.md5(text.encode()).hexdigest()[:12]


async def discover_rss_feed(url: str) -> Optional[str]:
    """Auto-discover RSS feed URL from a website"""
    try:
        print(f"🔍 Attempting to discover RSS feed from: {url}")
        
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            
        soup = BeautifulSoup(response.text, 'lxml')
        
        # Look for RSS/Atom feed links in <link> tags
        feed_links = soup.find_all('link', type=['application/rss+xml', 'application/atom+xml'])
        
        if feed_links:
            # Get the first RSS feed link
            feed_url = feed_links[0].get('href')
            if feed_url:
                # Convert relative URLs to absolute
                absolute_url = urljoin(url, feed_url)
                print(f"✅ Discovered RSS feed: {absolute_url}")
                return absolute_url
        
        # Fallback: Look for common RSS feed URLs
        common_paths = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml']
        base_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        
        for path in common_paths:
            try:
                test_url = urljoin(base_url, path)
                parsed = feedparser.parse(test_url)
                if parsed.entries:
                    print(f"✅ Found RSS feed at common path: {test_url}")
                    return test_url
            except:
                continue
        
        print(f"❌ No RSS feed found for {url}")
        return None
        
    except Exception as e:
        print(f"⚠️  Error during RSS discovery: {str(e)}")
        return None


async def fetch_rss_feed(feed_url: str, db: Session) -> List[Article]:
    """Fetch articles from an RSS feed and save to database"""
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

            # Skip if article already exists in database
            existing = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
            if existing:
                continue

            # Extract content (prefer content over summary)
            content = ""
            if hasattr(entry, 'content'):
                content = entry.content[0].value if entry.content else ""
            elif hasattr(entry, 'summary'):
                content = entry.summary

            # Parse published date
            published = None
            if entry.get('published'):
                try:
                    from dateutil import parser as date_parser
                    published = date_parser.parse(entry.get('published'))
                except:
                    pass

            article = ArticleModel(
                id=article_id,
                feed_id=feed_id,
                title=entry.get('title', 'No Title'),
                link=entry.get('link', ''),
                description=entry.get('summary', '')[:500] if entry.get('summary') else None,
                content=content,
                published=published,
                author=entry.get('author', None),
                fetched_at=datetime.utcnow()
            )

            db.add(article)
            new_articles.append(article)

        db.commit()
        print(f"✅ Fetched {len(new_articles)} new articles from {feed_url}")
        return new_articles

    except Exception as e:
        print(f"❌ Error fetching RSS feed {feed_url}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to fetch RSS feed: {str(e)}")


async def fetch_all_feeds():
    """Fetch articles from all RSS feeds (scheduled task)"""
    print("🔄 Running scheduled RSS fetch for all feeds...")
    db = next(get_db())
    try:
        feeds = db.query(FeedModel).all()
        for feed in feeds:
            try:
                await fetch_rss_feed(feed.url, db)
                # Update last_fetched timestamp
                feed.last_fetched = datetime.utcnow()
                feed.article_count = db.query(ArticleModel).filter(ArticleModel.feed_id == feed.id).count()
                db.commit()
            except Exception as e:
                print(f"❌ Error in scheduled fetch for {feed.url}: {str(e)}")
        print("✅ Scheduled RSS fetch completed")
    finally:
        db.close()


# Scheduler will be initialized lazily on first API call



async def generate_article_qa(article: Article, num_questions: int = 5, language: str = "Traditional Chinese") -> List[QAPair]:
    """Generate suggested Q&A for an article using OpenAI"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        # Prepare article content
        article_text = f"Title: {article.title}\\n\\n"
        if article.content:
            article_text += f"Content: {article.content[:3000]}"  # Limit to avoid token limits
        elif article.description:
            article_text += f"Description: {article.description}"

        prompt = f"""Based on this article, generate {num_questions} insightful questions and answers IN {language} that would help a reader better understand the content. Focus on key concepts, implications, and practical applications.

{article_text}

IMPORTANT: Generate all questions and answers in {language}.

Format your response as a JSON array of objects with 'question' and 'answer' fields. Example:
[
  {{"question": "What is the main topic?", "answer": "The main topic is..."}},
  {{"question": "Why is this important?", "answer": "This is important because..."}}
]"""

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"You are a helpful assistant that generates insightful questions and answers about articles in {language} to help readers understand the content better. Always respond in {language}."},
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
        article_text = f"Title: {article.title}\\n\\n"
        if article.content:
            article_text += f"Content: {article.content[:3000]}"
        elif article.description:
            article_text += f"Description: {article.description}"

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that answers questions about articles. Base your answers on the article content provided."},
                {"role": "user", "content": f"Article:\\n{article_text}\\n\\nQuestion: {question}"}
            ],
            temperature=0.7,
            max_tokens=500
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Error answering question: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to answer question: {str(e)}")


@router.get("/feeds")
async def get_feeds(db: Session = Depends(get_db)):
    """Get all RSS feeds"""
    # Initialize scheduler lazily on first API call
    init_scheduler()
    
    if not database_available:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please use devcontainer or set up PostgreSQL locally."
        )
    feeds = db.query(FeedModel).all()
    return [feed.to_dict() for feed in feeds]



@router.post("/feeds")
async def add_feed(feed: RSSFeed, db: Session = Depends(get_db)):
    """Add a new RSS feed and fetch initial articles"""
    feed_url = feed.url
    
    # Try to fetch the feed to validate it
    try:
        parsed_feed = feedparser.parse(feed_url)
        
        # If the URL is not a valid RSS feed, try to discover it
        if parsed_feed.bozo and not parsed_feed.entries:
            print(f"⚠️  URL is not a direct RSS feed, attempting auto-discovery...")
            discovered_url = await discover_rss_feed(feed_url)
            
            if discovered_url:
                feed_url = discovered_url
                parsed_feed = feedparser.parse(feed_url)
                
                if parsed_feed.bozo and not parsed_feed.entries:
                    raise HTTPException(status_code=400, detail="Discovered feed is invalid")
            else:
                raise HTTPException(status_code=400, detail="Invalid RSS feed URL and no feed could be discovered")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse RSS feed: {str(e)}")
    
    # Generate ID from the final feed URL (might be discovered URL)
    feed_id = generate_id(feed_url)

    # Check if feed already exists
    existing_feed = db.query(FeedModel).filter(FeedModel.id == feed_id).first()
    if existing_feed:
        raise HTTPException(status_code=400, detail="Feed already exists")

    # Create feed object (use the final feed_url which might be discovered)
    new_feed = FeedModel(
        id=feed_id,
        url=feed_url,
        title=parsed_feed.feed.get('title', feed_url),
        description=parsed_feed.feed.get('description', ''),
        added_at=datetime.utcnow(),
        last_fetched=None,
        article_count=0
    )

    db.add(new_feed)
    db.commit()

    # Fetch articles from the new feed (use discovered URL)
    await fetch_rss_feed(feed_url, db)

    # Update article count
    new_feed.last_fetched = datetime.utcnow()
    new_feed.article_count = db.query(ArticleModel).filter(ArticleModel.feed_id == feed_id).count()
    db.commit()
    db.refresh(new_feed)

    return new_feed.to_dict()


@router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: str, db: Session = Depends(get_db)):
    """Delete an RSS feed and its articles"""
    # Find and remove feed
    feed = db.query(FeedModel).filter(FeedModel.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    db.delete(feed)  # Articles will be cascade deleted
    db.commit()

    # Clear Q&A cache
    article_qa_cache.clear()

    return {"message": "Feed deleted successfully", "feed_id": feed_id}


@router.post("/feeds/{feed_id}/refresh")
async def refresh_feed(feed_id: str, db: Session = Depends(get_db)):
    """Manually refresh a specific feed"""
    feed = db.query(FeedModel).filter(FeedModel.id == feed_id).first()
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")

    new_articles = await fetch_rss_feed(feed.url, db)

    # Update last_fetched and article_count
    feed.last_fetched = datetime.utcnow()
    feed.article_count = db.query(ArticleModel).filter(ArticleModel.feed_id == feed_id).count()
    db.commit()

    return {
        "message": "Feed refreshed successfully",
        "new_articles": len(new_articles),
        "total_articles": feed.article_count
    }


@router.get("/articles")
async def get_articles(
    feed_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    filter_read: Optional[str] = None,  # "unread", "read", "all", "starred"
    db: Session = Depends(get_db)
):
    """Get articles, optionally filtered by feed_id and read status, with pagination support"""
    query = db.query(ArticleModel)

    if feed_id:
        query = query.filter(ArticleModel.feed_id == feed_id)

    # Filter by read status
    if filter_read == "unread":
        query = query.filter(ArticleModel.is_read == 0)
    elif filter_read == "read":
        query = query.filter(ArticleModel.is_read == 1)
    elif filter_read == "starred":
        query = query.filter(ArticleModel.is_starred == 1)
    # "all" or None = no filter

    # Get total count
    total_count = query.count()

    # Sort by published date (most recent first), fallback to fetched_at for articles without published date
    # Limit to max 200 articles total
    effective_limit = min(limit, 200 - offset) if offset < 200 else 0
    articles = query.order_by(ArticleModel.published.desc().nullslast(), ArticleModel.fetched_at.desc()).offset(offset).limit(effective_limit).all()

    return {
        "articles": [article.to_dict() for article in articles],
        "total_count": total_count,
        "offset": offset,
        "limit": effective_limit,
        "has_more": (offset + len(articles)) < min(total_count, 200)
    }


@router.get("/articles/{article_id}")
async def get_article(article_id: str, db: Session = Depends(get_db)):
    """Get a specific article"""
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    return article.to_dict()


@router.get("/articles/{article_id}/qa")
async def get_article_qa(article_id: str, regenerate: bool = False, language: str = "Traditional Chinese", db: Session = Depends(get_db)):
    """Get or generate suggested Q&A for an article"""
    article_model = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article_model:
        raise HTTPException(status_code=404, detail="Article not found")

    # Use language-specific cache key
    cache_key = f"{article_id}_{language}"
    
    # Check cache
    if cache_key in article_qa_cache and not regenerate:
        return article_qa_cache[cache_key]

    # Convert to Pydantic model for AI processing
    article = Article(**article_model.to_dict())

    # Generate Q&A with specified language
    qa_pairs = await generate_article_qa(article, language=language)

    # Cache the results
    article_qa_cache[cache_key] = [qa.dict() for qa in qa_pairs]

    return article_qa_cache[cache_key]


@router.post("/articles/{article_id}/question")
async def ask_question(article_id: str, request: QuestionRequest, db: Session = Depends(get_db)):
    """Ask a follow-up question about an article"""
    article_model = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article_model:
        raise HTTPException(status_code=404, detail="Article not found")

    # Convert to Pydantic model for AI processing
    article = Article(**article_model.to_dict())

    answer = await answer_question(article, request.question)

    return {
        "question": request.question,
        "answer": answer
    }


@router.post("/articles/{article_id}/read")
async def toggle_article_read(article_id: str, db: Session = Depends(get_db)):
    """Toggle article read status"""
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Toggle read status
    article.is_read = 1 if article.is_read == 0 else 0
    article.read_at = datetime.utcnow() if article.is_read == 1 else None

    db.commit()
    db.refresh(article)

    return {
        "id": article.id,
        "is_read": bool(article.is_read),
        "read_at": article.read_at.isoformat() if article.read_at else None
    }


@router.post("/articles/{article_id}/star")
async def toggle_article_star(article_id: str, db: Session = Depends(get_db)):
    """Toggle article starred status"""
    article = db.query(ArticleModel).filter(ArticleModel.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Toggle starred status
    article.is_starred = 1 if article.is_starred == 0 else 0

    db.commit()
    db.refresh(article)

    return {
        "id": article.id,
        "is_starred": bool(article.is_starred)
    }


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get RSS reader statistics"""
    total_feeds = db.query(FeedModel).count()
    total_articles = db.query(ArticleModel).count()
    unread_articles = db.query(ArticleModel).filter(ArticleModel.is_read == 0).count()
    starred_articles = db.query(ArticleModel).filter(ArticleModel.is_starred == 1).count()

    feeds = db.query(FeedModel).all()
    articles_by_feed = {}
    for feed in feeds:
        count = db.query(ArticleModel).filter(ArticleModel.feed_id == feed.id).count()
        articles_by_feed[feed.title] = count

    return {
        "total_feeds": total_feeds,
        "total_articles": total_articles,
        "unread_articles": unread_articles,
        "starred_articles": starred_articles,
        "articles_by_feed": articles_by_feed,
        "scheduler_running": scheduler.running
    }

# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "fetch-all",
                "label": "RSS: Fetch All Feeds",
                "description": "Update all RSS feeds and fetch new articles",
                "category": "RSS",
                "icon": "📰",
                "endpoint": "/fetch-all",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "add-feed",
                "label": "RSS: Add Feed",
                "description": "Subscribe to a new RSS feed",
                "category": "RSS",
                "icon": "➕",
                "endpoint": "/feeds",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "url",
                            "label": "Feed URL",
                            "type": "text",
                            "required": True,
                            "placeholder": "https://example.com/feed.xml"
                        }
                    ]
                }
            },
            {
                "id": "view-stats",
                "label": "RSS: View Statistics",
                "description": "Show feed and article statistics",
                "category": "RSS",
                "icon": "📊",
                "endpoint": "/stats",
                "method": "GET",
                "requiresInput": False
            }
        ]
    }
