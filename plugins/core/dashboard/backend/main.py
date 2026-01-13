"""
Dashboard Plugin Backend
Provides endpoints for dashboard-specific functionality
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    # This can be extended with real statistics
    return {
        "totalWidgets": 0,
        "activePlugins": 0,
        "systemStatus": "healthy"
    }
