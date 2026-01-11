from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import sys
import os

# Add the plugin directory to the path for imports
sys.path.insert(0, os.path.dirname(__file__))

# Import database and models
from database import get_db, init_db
from models import PomodoroState as PomodoroStateModel

router = APIRouter()

# Database availability flag
database_available = False

# Initialize database tables
try:
    init_db()
    database_available = True
    print("🍅 Pomodoro database initialized successfully")
except Exception as e:
    print(f"⚠️  Pomodoro database initialization error: {e}")
    print("   Plugin will work with limited functionality (no persistence)")


# Pydantic models for API requests/responses
class PomodoroStateRequest(BaseModel):
    timeLeft: int
    mode: str
    isRunning: bool
    completedPomodoros: int


class PomodoroStateResponse(BaseModel):
    id: str
    timeLeft: int
    mode: str
    isRunning: bool
    completedPomodoros: int
    lastUpdated: Optional[str] = None


@router.get("/state", response_model=PomodoroStateResponse)
async def get_state(db: Session = Depends(get_db)):
    """Get the current Pomodoro timer state"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        # Get or create default state
        state = db.query(PomodoroStateModel).filter_by(id="default").first()

        if not state:
            # Create default state
            state = PomodoroStateModel(
                id="default",
                time_left=1500,  # 25 minutes
                mode="idle",
                is_running=0,
                completed_pomodoros=0
            )
            db.add(state)
            db.commit()
            db.refresh(state)

        return state.to_dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error fetching state: {str(e)}")


@router.post("/state", response_model=PomodoroStateResponse)
async def save_state(state_data: PomodoroStateRequest, db: Session = Depends(get_db)):
    """Save the current Pomodoro timer state"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        # Get or create state
        state = db.query(PomodoroStateModel).filter_by(id="default").first()

        if not state:
            state = PomodoroStateModel(id="default")
            db.add(state)

        # Update state
        state.time_left = state_data.timeLeft
        state.mode = state_data.mode
        state.is_running = 1 if state_data.isRunning else 0
        state.completed_pomodoros = state_data.completedPomodoros

        db.commit()
        db.refresh(state)

        return state.to_dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving state: {str(e)}")


@router.post("/state/reset")
async def reset_state(db: Session = Depends(get_db)):
    """Reset the Pomodoro timer state"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        state = db.query(PomodoroStateModel).filter_by(id="default").first()

        if state:
            state.time_left = 1500  # 25 minutes
            state.mode = "idle"
            state.is_running = 0
            state.completed_pomodoros = 0
            db.commit()
            db.refresh(state)
            return state.to_dict()
        else:
            return {"message": "No state to reset"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error resetting state: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database_available": database_available
    }
