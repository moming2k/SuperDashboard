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
