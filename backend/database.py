"""
Database module for SuperDashboard
Handles plugin order persistence using PostgreSQL
"""
import os
from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Get database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/superdashboard")

# Create engine for PostgreSQL
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PluginOrder(Base):
    """Model for storing plugin display order"""
    __tablename__ = "plugin_order"

    plugin_name = Column(String, primary_key=True, index=True)
    order_index = Column(Integer, nullable=False)


def init_db():
    """Initialize database tables"""
    Base.metadata.create_all(bind=engine)
    print(f"✅ Plugin order table initialized in PostgreSQL database")


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
