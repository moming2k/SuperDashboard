from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import sys
import os

# Add the plugin directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from database import Base



class Feed(Base):
    __tablename__ = "feeds"

    id = Column(String(12), primary_key=True)
    url = Column(Text, nullable=False, unique=True)
    title = Column(Text)
    description = Column(Text)
    added_at = Column(DateTime, default=datetime.utcnow)
    last_fetched = Column(DateTime, nullable=True)
    article_count = Column(Integer, default=0)

    # Relationship to articles
    articles = relationship("Article", back_populates="feed", cascade="all, delete-orphan")

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "url": self.url,
            "title": self.title,
            "description": self.description,
            "added_at": self.added_at.isoformat() if self.added_at else None,
            "last_fetched": self.last_fetched.isoformat() if self.last_fetched else None,
            "article_count": self.article_count
        }


class Article(Base):
    __tablename__ = "articles"

    id = Column(String(12), primary_key=True)
    feed_id = Column(String(12), ForeignKey("feeds.id", ondelete="CASCADE"), nullable=False)
    title = Column(Text, nullable=False)
    link = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    published = Column(DateTime, nullable=True)
    author = Column(Text, nullable=True)
    fetched_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    is_read = Column(Integer, default=0)  # 0 = unread, 1 = read
    is_starred = Column(Integer, default=0)  # 0 = not starred, 1 = starred
    read_at = Column(DateTime, nullable=True)

    # Relationship to feed
    feed = relationship("Feed", back_populates="articles")

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "feed_id": self.feed_id,
            "title": self.title,
            "link": self.link,
            "description": self.description,
            "content": self.content,
            "published": self.published.isoformat() if self.published else None,
            "author": self.author,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
            "is_read": bool(self.is_read),
            "is_starred": bool(self.is_starred),
            "read_at": self.read_at.isoformat() if self.read_at else None
        }
