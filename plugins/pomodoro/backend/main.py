from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import sys
import os
import httpx
import importlib.util

# Add the plugin directory to the path for imports
plugin_dir = os.path.dirname(__file__)
sys.path.insert(0, plugin_dir)

# Import database module explicitly
database_spec = importlib.util.spec_from_file_location(
    "pomodoro_database",
    os.path.join(plugin_dir, "database.py")
)
database_module = importlib.util.module_from_spec(database_spec)
database_spec.loader.exec_module(database_module)
get_db = database_module.get_db
init_db = database_module.init_db

# Import models module explicitly
models_spec = importlib.util.spec_from_file_location(
    "pomodoro_models",
    os.path.join(plugin_dir, "models.py")
)
models_module = importlib.util.module_from_spec(models_spec)
models_spec.loader.exec_module(models_module)
PomodoroStateModel = models_module.PomodoroState
PomodoroSessionModel = models_module.PomodoroSession

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


# Helper function to send notifications to Notification Center
async def send_notification_to_center(title: str, description: str, priority: str = "medium"):
    """Send a notification to the Notification Center plugin"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            notification_data = {
                "title": title,
                "description": description,
                "source": "system",
                "type": "custom",
                "priority": priority,
                "metadata": {
                    "plugin": "pomodoro",
                    "timestamp": "now"
                }
            }
            response = await client.post(
                "http://localhost:8000/plugins/notification-center/notifications",
                json=notification_data
            )
            if response.status_code == 200:
                print(f"🔔 Notification sent: {title}")
            else:
                print(f"⚠️  Failed to send notification: {response.status_code}")
    except Exception as e:
        print(f"⚠️  Error sending notification to center: {e}")



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


class SessionCreateRequest(BaseModel):
    sessionType: str  # 'work' or 'break'
    startTime: str
    endTime: str
    completed: bool = True
    notes: Optional[str] = None
    tags: Optional[str] = None


class SessionUpdateRequest(BaseModel):
    notes: Optional[str] = None
    tags: Optional[str] = None



@router.get("/state", response_model=PomodoroStateResponse)
async def get_state(db: Session = Depends(get_db)):
    """Get the current Pomodoro timer state"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from datetime import datetime, timezone
        
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

        # Calculate elapsed time if timer is running
        if state.is_running and state.last_updated:
            now = datetime.now(timezone.utc)
            last_updated = state.last_updated
            
            # Make last_updated timezone-aware if it isn't
            if last_updated.tzinfo is None:
                last_updated = last_updated.replace(tzinfo=timezone.utc)
            
            elapsed_seconds = int((now - last_updated).total_seconds())
            
            # Calculate new time_left
            new_time_left = max(0, state.time_left - elapsed_seconds)
            
            # If timer reached zero, handle mode transition
            if new_time_left == 0 and state.time_left > 0:
                if state.mode == "work":
                    # Transition to break
                    state.mode = "break"
                    state.time_left = 300  # 5 minutes
                    state.is_running = 0  # Auto-pause on transition
                    state.completed_pomodoros += 1
                elif state.mode == "break":
                    # Transition to idle
                    state.mode = "idle"
                    state.time_left = 1500  # 25 minutes
                    state.is_running = 0
                
                state.last_updated = now
                db.commit()
                db.refresh(state)
            else:
                # DON'T update database - just return calculated value
                # This allows continuous countdown without resetting last_updated
                response_dict = state.to_dict()
                response_dict['timeLeft'] = new_time_left
                return response_dict

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
        from datetime import datetime, timezone
        
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
        state.last_updated = datetime.now(timezone.utc)  # Update timestamp

        db.commit()
        db.refresh(state)

        return state.to_dict()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving state: {str(e)}")


@router.post("/state/reset")
async def reset_timer(db: Session = Depends(get_db)):
    """Reset the Pomodoro timer to initial state"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        from datetime import datetime, timezone
        
        state = db.query(PomodoroStateModel).filter_by(id="default").first()
        if not state:
            state = PomodoroStateModel(id="default")
            db.add(state)

        state.time_left = 1500  # 25 minutes
        state.mode = "work"
        state.is_running = 0  # Stop the timer when reset
        state.completed_pomodoros = 0
        state.last_updated = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(state)
        return state.to_dict()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error resetting timer: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database_available": database_available
    }


# Notification endpoint
class NotificationRequest(BaseModel):
    title: str
    description: str
    priority: str = "medium"


@router.post("/notify")
async def notify(notification: NotificationRequest):
    """Send a notification to the Notification Center"""
    await send_notification_to_center(
        title=notification.title,
        description=notification.description,
        priority=notification.priority
    )
    return {"success": True, "message": "Notification sent"}


# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "start-pomodoro",
                "label": "Pomodoro: Start Timer",
                "description": "Start or resume the Pomodoro timer",
                "category": "Pomodoro",
                "icon": "▶️",
                "endpoint": "/start",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "pause-pomodoro",
                "label": "Pomodoro: Pause Timer",
                "description": "Pause the current Pomodoro session",
                "category": "Pomodoro",
                "icon": "⏸",
                "endpoint": "/pause",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "reset-pomodoro",
                "label": "Pomodoro: Reset Timer",
                "description": "Reset the timer to initial state",
                "category": "Pomodoro",
                "icon": "↻",
                "endpoint": "/state/reset",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "skip-break",
                "label": "Pomodoro: Skip Break",
                "description": "Skip the current break and start work",
                "category": "Pomodoro",
                "icon": "⏭",
                "endpoint": "/skip-break",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "view-stats",
                "label": "Pomodoro: View Stats",
                "description": "Show Pomodoro statistics",
                "category": "Pomodoro",
                "icon": "📊",
                "endpoint": "/state",
                "method": "GET",
                "requiresInput": False
            }
        ]
    }


# Command endpoints
@router.post("/start")
async def start_timer(db: Session = Depends(get_db)):
    """Start the Pomodoro timer"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        state = db.query(PomodoroStateModel).filter_by(id="default").first()
        if not state:
            state = PomodoroStateModel(
                id="default",
                time_left=1500,
                mode="work",
                is_running=1,
                completed_pomodoros=0
            )
            db.add(state)
        else:
            if state.mode == "idle":
                state.mode = "work"
                state.time_left = 1500
            state.is_running = 1
        
        db.commit()
        db.refresh(state)
        return {"success": True, "message": "Pomodoro started", "state": state.to_dict()}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error starting timer: {str(e)}")


@router.post("/pause")
async def pause_timer(db: Session = Depends(get_db)):
    """Pause the Pomodoro timer"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        state = db.query(PomodoroStateModel).filter_by(id="default").first()
        if state:
            state.is_running = 0
            db.commit()
            db.refresh(state)
            return {"success": True, "message": "Pomodoro paused", "state": state.to_dict()}
        return {"success": False, "message": "No active timer"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error pausing timer: {str(e)}")


@router.post("/skip-break")
async def skip_break(db: Session = Depends(get_db)):
    """Skip the current break"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        state = db.query(PomodoroStateModel).filter_by(id="default").first()
        if state and state.mode == "break":
            state.mode = "work"
            state.time_left = 1500
            state.is_running = 0
            db.commit()
            db.refresh(state)
            return {"success": True, "message": "Break skipped", "state": state.to_dict()}
        return {"success": False, "message": "Not in break mode"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error skipping break: {str(e)}")


# Session History Endpoints
@router.post("/sessions")
async def create_session(session: SessionCreateRequest, db: Session = Depends(get_db)):
    """Create a new Pomodoro session record"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        import uuid
        from datetime import datetime
        
        session_id = str(uuid.uuid4())
        db_session = PomodoroSessionModel(
            id=session_id,
            session_type=session.sessionType,
            start_time=datetime.fromisoformat(session.startTime.replace('Z', '+00:00')),
            end_time=datetime.fromisoformat(session.endTime.replace('Z', '+00:00')),
            completed=1 if session.completed else 0,
            notes=session.notes,
            tags=session.tags
        )
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        
        return {"success": True, "session": db_session.to_dict()}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating session: {str(e)}")


@router.get("/sessions")
async def get_sessions(
    session_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get Pomodoro session history"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        query = db.query(PomodoroSessionModel)
        
        if session_type:
            query = query.filter(PomodoroSessionModel.session_type == session_type)
        
        sessions = query.order_by(PomodoroSessionModel.created_at.desc()).limit(limit).all()
        return {"sessions": [s.to_dict() for s in sessions]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching sessions: {str(e)}")


@router.patch("/sessions/{session_id}")
async def update_session(
    session_id: str,
    update: SessionUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update session notes or tags"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        session = db.query(PomodoroSessionModel).filter(PomodoroSessionModel.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        if update.notes is not None:
            session.notes = update.notes
        if update.tags is not None:
            session.tags = update.tags
        
        db.commit()
        db.refresh(session)
        return {"success": True, "session": session.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating session: {str(e)}")


@router.get("/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """Get Pomodoro statistics"""
    if not database_available:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        from datetime import datetime, timedelta
        
        # Get all completed work sessions
        total_sessions = db.query(PomodoroSessionModel).filter(
            PomodoroSessionModel.session_type == "work",
            PomodoroSessionModel.completed == 1
        ).count()
        
        # Get sessions from today
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_sessions = db.query(PomodoroSessionModel).filter(
            PomodoroSessionModel.session_type == "work",
            PomodoroSessionModel.completed == 1,
            PomodoroSessionModel.created_at >= today_start
        ).count()
        
        # Get sessions from this week
        week_start = today_start - timedelta(days=today_start.weekday())
        week_sessions = db.query(PomodoroSessionModel).filter(
            PomodoroSessionModel.session_type == "work",
            PomodoroSessionModel.completed == 1,
            PomodoroSessionModel.created_at >= week_start
        ).count()
        
        # Calculate total work time (assuming 25 minutes per session)
        total_work_minutes = total_sessions * 25
        
        return {
            "totalSessions": total_sessions,
            "todaySessions": today_sessions,
            "weekSessions": week_sessions,
            "totalWorkMinutes": total_work_minutes,
            "totalWorkHours": round(total_work_minutes / 60, 1)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating statistics: {str(e)}")


@router.get("/badge")
async def get_badge(db: Session = Depends(get_db)):
    """Return badge information for the plugin tab"""
    if not database_available:
        return {"badge": None}
    
    try:
        from datetime import datetime, timedelta
        
        # Get today's start time
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Count today's completed work sessions
        today_sessions = db.query(PomodoroSessionModel).filter(
            PomodoroSessionModel.session_type == "work",
            PomodoroSessionModel.completed == 1,
            PomodoroSessionModel.created_at >= today_start
        ).count()
        
        if today_sessions == 0:
            return {"badge": None}
        
        return {
            "badge": {
                "type": "count",
                "value": str(today_sessions),
                "color": "primary",
                "tooltip": f"{today_sessions} Pomodoro{'s' if today_sessions > 1 else ''} completed today"
            }
        }
    except Exception as e:
        # Return empty badge on error
        return {"badge": None}
