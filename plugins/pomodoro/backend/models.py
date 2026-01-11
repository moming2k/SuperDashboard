from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime
import sys
import os

# Add the plugin directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from database import Base


class PomodoroState(Base):
    """Stores the current state of the Pomodoro timer"""
    __tablename__ = "pomodoro_state"
    __table_args__ = {'extend_existing': True}

    id = Column(String(50), primary_key=True, default="default")
    time_left = Column(Integer, nullable=False, default=1500)  # seconds
    mode = Column(String(20), nullable=False, default="work")  # work, break, idle
    is_running = Column(Integer, nullable=False, default=0)  # 0 or 1 (boolean)
    completed_pomodoros = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "timeLeft": self.time_left,
            "mode": self.mode,
            "isRunning": bool(self.is_running),
            "completedPomodoros": self.completed_pomodoros,
            "lastUpdated": self.last_updated.isoformat() if self.last_updated else None
        }


class PomodoroSession(Base):
    """Stores completed Pomodoro sessions for history tracking"""
    __tablename__ = "pomodoro_sessions"
    __table_args__ = {'extend_existing': True}

    id = Column(String(50), primary_key=True)
    session_type = Column(String(20), nullable=False)  # 'work' or 'break'
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    completed = Column(Integer, nullable=False, default=1)  # 1 if completed, 0 if interrupted
    notes = Column(String(500), nullable=True)
    tags = Column(String(200), nullable=True)  # Comma-separated tags
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "sessionType": self.session_type,
            "startTime": self.start_time.isoformat() if self.start_time else None,
            "endTime": self.end_time.isoformat() if self.end_time else None,
            "completed": bool(self.completed),
            "notes": self.notes,
            "tags": self.tags.split(",") if self.tags else [],
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }

