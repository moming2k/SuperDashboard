"""
Moltbook Plugin Backend
=======================
API router for integrating with Moltbook - the social network for AI agents.

Base URL: https://www.moltbook.com/api/v1
Documentation: https://moltbook.com/skill.md
"""

import os
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Configuration
MOLTBOOK_BASE_URL = os.getenv("MOLTBOOK_BASE_URL", "https://www.moltbook.com/api/v1")
MOLTBOOK_API_KEY = os.getenv("MOLTBOOK_API_KEY")


# =============================================================================
# Pydantic Models
# =============================================================================

class RegisterRequest(BaseModel):
    """Request model for agent registration"""
    name: Optional[str] = None
    description: Optional[str] = None


class RegisterResponse(BaseModel):
    """Response model for agent registration"""
    success: bool
    api_key: Optional[str] = None
    claim_url: Optional[str] = None
    verification_code: Optional[str] = None
    error: Optional[str] = None


class PostCreate(BaseModel):
    """Request model for creating a post"""
    submolt: str
    title: str
    content: Optional[str] = None
    url: Optional[str] = None


class CommentCreate(BaseModel):
    """Request model for creating a comment"""
    content: str
    parent_id: Optional[str] = None


class ProfileUpdate(BaseModel):
    """Request model for updating agent profile"""
    description: Optional[str] = None
    metadata: Optional[dict] = None


class SubmoltCreate(BaseModel):
    """Request model for creating a submolt"""
    name: str
    display_name: str
    description: str


# =============================================================================
# Helper Functions
# =============================================================================

def get_headers() -> dict:
    """Get authorization headers for Moltbook API requests"""
    if not MOLTBOOK_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="Moltbook API key not configured. Set MOLTBOOK_API_KEY in .env"
        )
    return {
        "Authorization": f"Bearer {MOLTBOOK_API_KEY}",
        "Content-Type": "application/json"
    }


async def moltbook_request(
    method: str,
    endpoint: str,
    json_data: dict = None,
    params: dict = None,
    require_auth: bool = True
) -> dict:
    """Make a request to the Moltbook API"""
    url = f"{MOLTBOOK_BASE_URL}{endpoint}"
    headers = get_headers() if require_auth else {"Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=json_data)
            elif method == "PATCH":
                response = await client.patch(url, headers=headers, json=json_data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

            if response.status_code >= 400:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", error_detail)
                except:
                    pass
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Moltbook API Error: {error_detail}"
                )

            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Failed to connect to Moltbook: {str(e)}"
            )


# =============================================================================
# Configuration Endpoints
# =============================================================================

@router.get("/config")
async def get_config():
    """Get Moltbook plugin configuration status"""
    return {
        "configured": bool(MOLTBOOK_API_KEY),
        "base_url": MOLTBOOK_BASE_URL
    }


# =============================================================================
# Registration & Status Endpoints
# =============================================================================

@router.post("/register")
async def register_agent(request: RegisterRequest):
    """
    Register a new agent with Moltbook.
    Returns API key and claim URL for verification.
    """
    # Registration doesn't require existing API key
    url = f"{MOLTBOOK_BASE_URL}/agents/register"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json=request.model_dump(exclude_none=True)
        )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Registration failed: {response.text}"
            )

        return response.json()


@router.get("/status")
async def get_agent_status():
    """Get the current agent's claim status (pending_claim or claimed)"""
    return await moltbook_request("GET", "/agents/status")


# =============================================================================
# Feed & Posts Endpoints
# =============================================================================

@router.get("/feed")
async def get_feed(
    sort: str = Query("hot", description="Sort order: hot, new, top, rising"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get personalized feed for the authenticated agent"""
    params = {"sort": sort, "limit": limit, "offset": offset}
    return await moltbook_request("GET", "/feed", params=params)


@router.get("/posts")
async def get_posts(
    submolt: Optional[str] = Query(None, description="Filter by submolt name"),
    sort: str = Query("hot", description="Sort order: hot, new, top, rising"),
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get global posts, optionally filtered by submolt"""
    params = {"sort": sort, "limit": limit, "offset": offset}
    if submolt:
        params["submolt"] = submolt
    return await moltbook_request("GET", "/posts", params=params)


@router.get("/posts/{post_id}")
async def get_post(post_id: str):
    """Get a specific post by ID"""
    return await moltbook_request("GET", f"/posts/{post_id}")


@router.post("/posts")
async def create_post(post: PostCreate):
    """
    Create a new post in a submolt.
    Rate limit: 1 post per 30 minutes.
    """
    return await moltbook_request("POST", "/posts", json_data=post.model_dump(exclude_none=True))


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str):
    """Delete a post (must be the author)"""
    return await moltbook_request("DELETE", f"/posts/{post_id}")


# =============================================================================
# Comments Endpoints
# =============================================================================

@router.get("/posts/{post_id}/comments")
async def get_comments(
    post_id: str,
    sort: str = Query("top", description="Sort order: top, new, controversial")
):
    """Get comments for a post"""
    params = {"sort": sort}
    return await moltbook_request("GET", f"/posts/{post_id}/comments", params=params)


@router.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, comment: CommentCreate):
    """
    Add a comment to a post.
    Rate limit: 1 per 20 seconds, 50 per day.
    """
    return await moltbook_request(
        "POST",
        f"/posts/{post_id}/comments",
        json_data=comment.model_dump(exclude_none=True)
    )


# =============================================================================
# Voting Endpoints
# =============================================================================

@router.post("/posts/{post_id}/upvote")
async def upvote_post(post_id: str):
    """Upvote a post"""
    return await moltbook_request("POST", f"/posts/{post_id}/upvote")


@router.post("/posts/{post_id}/downvote")
async def downvote_post(post_id: str):
    """Downvote a post"""
    return await moltbook_request("POST", f"/posts/{post_id}/downvote")


@router.post("/comments/{comment_id}/upvote")
async def upvote_comment(comment_id: str):
    """Upvote a comment"""
    return await moltbook_request("POST", f"/comments/{comment_id}/upvote")


# =============================================================================
# Submolts (Communities) Endpoints
# =============================================================================

@router.get("/submolts")
async def list_submolts():
    """List all available submolts"""
    return await moltbook_request("GET", "/submolts")


@router.get("/submolts/{name}")
async def get_submolt(name: str):
    """Get information about a specific submolt"""
    return await moltbook_request("GET", f"/submolts/{name}")


@router.post("/submolts")
async def create_submolt(submolt: SubmoltCreate):
    """Create a new submolt (community)"""
    return await moltbook_request("POST", "/submolts", json_data=submolt.model_dump())


@router.post("/submolts/{name}/subscribe")
async def subscribe_submolt(name: str):
    """Subscribe to a submolt"""
    return await moltbook_request("POST", f"/submolts/{name}/subscribe")


@router.delete("/submolts/{name}/subscribe")
async def unsubscribe_submolt(name: str):
    """Unsubscribe from a submolt"""
    return await moltbook_request("DELETE", f"/submolts/{name}/subscribe")


# =============================================================================
# Profile Endpoints
# =============================================================================

@router.get("/me")
async def get_my_profile():
    """Get the authenticated agent's profile"""
    return await moltbook_request("GET", "/agents/me")


@router.patch("/me")
async def update_my_profile(profile: ProfileUpdate):
    """Update the authenticated agent's profile"""
    return await moltbook_request(
        "PATCH",
        "/agents/me",
        json_data=profile.model_dump(exclude_none=True)
    )


@router.get("/agents/{name}")
async def get_agent_profile(name: str):
    """Get another agent's profile"""
    return await moltbook_request("GET", "/agents/profile", params={"name": name})


# =============================================================================
# Following Endpoints
# =============================================================================

@router.post("/agents/{name}/follow")
async def follow_agent(name: str):
    """Follow another agent"""
    return await moltbook_request("POST", f"/agents/{name}/follow")


@router.delete("/agents/{name}/follow")
async def unfollow_agent(name: str):
    """Unfollow an agent"""
    return await moltbook_request("DELETE", f"/agents/{name}/follow")


# =============================================================================
# Search Endpoint
# =============================================================================

@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    type: str = Query("all", description="Type: posts, comments, or all"),
    limit: int = Query(20, ge=1, le=50)
):
    """
    Semantic search across Moltbook.
    Returns results with similarity scores (0-1).
    """
    params = {"q": q, "type": type, "limit": limit}
    return await moltbook_request("GET", "/search", params=params)
