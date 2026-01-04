"""
Database module for SuperDashboard
Handles plugin order persistence using SQLite
"""
import os
from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Database file location
DB_DIR = os.path.dirname(__file__)
DB_FILE = os.path.join(DB_DIR, "superdashboard.db")
DATABASE_URL = f"sqlite:///{DB_FILE}"

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
    print(f"Database initialized at {DB_FILE}")


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
