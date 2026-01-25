"""
Calendar Plugin - FastAPI Router
REST API endpoints for calendar event management
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import uuid
import sys
import os

# Add plugin directories to sys.path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from shared.database import get_db, init_db, Base
from models import CalendarEvent

router = APIRouter()

# Initialize database tables
try:
    init_db()
    print("📅 Calendar database tables initialized")
except Exception as e:
    print(f"⚠️  Calendar database initialization error: {e}")


# ==================== Pydantic Models ====================

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    color: str = "#3B82F6"
    all_day: bool = False
    reminder_minutes: int = 15
    recurrence: str = "none"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    color: Optional[str] = None
    all_day: Optional[bool] = None
    reminder_minutes: Optional[int] = None
    recurrence: Optional[str] = None


# ==================== API Endpoints ====================

@router.get("/events")
async def get_events(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all events, optionally filtered by date range"""
    query = db.query(CalendarEvent)
    
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(CalendarEvent.end_time >= start_dt)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(CalendarEvent.start_time <= end_dt)
    
    events = query.order_by(CalendarEvent.start_time).all()
    return [event.to_dict() for event in events]


@router.post("/events")
async def create_event(event: EventCreate, db: Session = Depends(get_db)):
    """Create a new calendar event"""
    db_event = CalendarEvent(
        id=str(uuid.uuid4()),
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        location=event.location,
        color=event.color,
        all_day=event.all_day,
        reminder_minutes=event.reminder_minutes,
        recurrence=event.recurrence,
    )
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    return db_event.to_dict()


@router.get("/events/{event_id}")
async def get_event(event_id: str, db: Session = Depends(get_db)):
    """Get a specific event by ID"""
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return event.to_dict()


@router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    event_update: EventUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing event"""
    db_event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Update fields
    update_data = event_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_event, key, value)
    
    db_event.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_event)
    
    return db_event.to_dict()


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, db: Session = Depends(get_db)):
    """Delete an event"""
    db_event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    db.delete(db_event)
    db.commit()
    
    return {"message": "Event deleted successfully"}


@router.get("/today")
async def get_today_events(db: Session = Depends(get_db)):
    """Get today's events"""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    events = db.query(CalendarEvent).filter(
        CalendarEvent.start_time >= today_start,
        CalendarEvent.start_time < today_end
    ).order_by(CalendarEvent.start_time).all()
    
    return [event.to_dict() for event in events]


@router.get("/upcoming")
async def get_upcoming_events(days: int = 7, db: Session = Depends(get_db)):
    """Get upcoming events for the next N days"""
    now = datetime.utcnow()
    future = now + timedelta(days=days)
    
    events = db.query(CalendarEvent).filter(
        CalendarEvent.start_time >= now,
        CalendarEvent.start_time <= future
    ).order_by(CalendarEvent.start_time).limit(10).all()
    
    return [event.to_dict() for event in events]
