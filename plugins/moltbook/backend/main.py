"""
Moltbook Plugin Backend
=======================
API router for integrating with Moltbook - the social network for AI agents.

Base URL: https://www.moltbook.com/api/v1
Documentation: https://moltbook.com/skill.md

Autonomous Agent Features:
- Periodic heartbeat to check feed and engage
- AI-powered content generation for posts and comments
- Automatic voting based on content relevance
"""

import os
import asyncio
import random
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Configuration
MOLTBOOK_BASE_URL = os.getenv("MOLTBOOK_BASE_URL", "https://www.moltbook.com/api/v1")
MOLTBOOK_API_KEY = os.getenv("MOLTBOOK_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Autonomous Agent State
agent_state = {
    "running": False,
    "last_heartbeat": None,
    "last_post": None,
    "last_comment": None,
    "posts_today": 0,
    "comments_today": 0,
    "heartbeat_interval_hours": 4,
    "auto_vote": True,
    "auto_comment": True,
    "auto_post": True,
    "personality": "friendly and curious AI agent interested in technology, coding, and AI developments",
    "activity_log": []
}


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


class AgentSettings(BaseModel):
    """Settings for autonomous agent behavior"""
    heartbeat_interval_hours: Optional[int] = 4
    auto_vote: Optional[bool] = True
    auto_comment: Optional[bool] = True
    auto_post: Optional[bool] = True
    personality: Optional[str] = None


class ManualPostRequest(BaseModel):
    """Request for AI-generated post"""
    submolt: str
    topic: Optional[str] = None


class ManualCommentRequest(BaseModel):
    """Request for AI-generated comment"""
    post_id: str


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


# =============================================================================
# AI Content Generation
# =============================================================================

async def generate_with_ai(prompt: str, max_tokens: int = 500) -> str:
    """Generate content using OpenAI API"""
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key not configured. Set OPENAI_API_KEY in .env"
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4",
                "messages": [
                    {
                        "role": "system",
                        "content": f"You are an AI agent on Moltbook, a social network for AI agents. "
                                   f"Your personality: {agent_state['personality']}. "
                                   f"Keep responses concise, engaging, and suitable for social media. "
                                   f"Never pretend to be human. Embrace your AI identity."
                    },
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": max_tokens,
                "temperature": 0.8
            }
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"OpenAI API error: {response.text}"
            )

        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


def log_activity(action: str, details: str):
    """Log agent activity"""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "details": details
    }
    agent_state["activity_log"].insert(0, entry)
    # Keep only last 100 entries
    agent_state["activity_log"] = agent_state["activity_log"][:100]


# =============================================================================
# Autonomous Agent Endpoints
# =============================================================================

@router.get("/agent/state")
async def get_agent_state():
    """Get current autonomous agent state and settings"""
    return {
        "running": agent_state["running"],
        "last_heartbeat": agent_state["last_heartbeat"],
        "last_post": agent_state["last_post"],
        "last_comment": agent_state["last_comment"],
        "posts_today": agent_state["posts_today"],
        "comments_today": agent_state["comments_today"],
        "heartbeat_interval_hours": agent_state["heartbeat_interval_hours"],
        "auto_vote": agent_state["auto_vote"],
        "auto_comment": agent_state["auto_comment"],
        "auto_post": agent_state["auto_post"],
        "personality": agent_state["personality"],
        "openai_configured": bool(OPENAI_API_KEY),
        "moltbook_configured": bool(MOLTBOOK_API_KEY)
    }


@router.get("/agent/activity")
async def get_agent_activity(limit: int = Query(20, ge=1, le=100)):
    """Get recent agent activity log"""
    return {"activities": agent_state["activity_log"][:limit]}


@router.patch("/agent/settings")
async def update_agent_settings(settings: AgentSettings):
    """Update autonomous agent settings"""
    if settings.heartbeat_interval_hours is not None:
        agent_state["heartbeat_interval_hours"] = max(1, settings.heartbeat_interval_hours)
    if settings.auto_vote is not None:
        agent_state["auto_vote"] = settings.auto_vote
    if settings.auto_comment is not None:
        agent_state["auto_comment"] = settings.auto_comment
    if settings.auto_post is not None:
        agent_state["auto_post"] = settings.auto_post
    if settings.personality is not None:
        agent_state["personality"] = settings.personality

    log_activity("settings_updated", f"Agent settings updated")
    return {"success": True, "state": await get_agent_state()}


@router.post("/agent/start")
async def start_agent(background_tasks: BackgroundTasks):
    """Start the autonomous agent heartbeat loop"""
    if agent_state["running"]:
        return {"success": False, "message": "Agent is already running"}

    agent_state["running"] = True
    log_activity("agent_started", "Autonomous agent started")

    # Start background heartbeat loop
    background_tasks.add_task(heartbeat_loop)

    return {"success": True, "message": "Agent started"}


@router.post("/agent/stop")
async def stop_agent():
    """Stop the autonomous agent"""
    if not agent_state["running"]:
        return {"success": False, "message": "Agent is not running"}

    agent_state["running"] = False
    log_activity("agent_stopped", "Autonomous agent stopped")

    return {"success": True, "message": "Agent stopped"}


async def heartbeat_loop():
    """Background loop that runs periodic heartbeats"""
    while agent_state["running"]:
        try:
            await run_heartbeat()
        except Exception as e:
            log_activity("heartbeat_error", str(e))

        # Wait for next heartbeat interval
        interval_seconds = agent_state["heartbeat_interval_hours"] * 3600
        # Add some randomness (±10%) to avoid predictable patterns
        jitter = interval_seconds * 0.1 * (random.random() - 0.5)
        await asyncio.sleep(interval_seconds + jitter)


@router.post("/agent/heartbeat")
async def trigger_heartbeat():
    """Manually trigger a heartbeat (check feed and engage)"""
    result = await run_heartbeat()
    return result


async def run_heartbeat():
    """
    Execute a heartbeat: check feed, vote, comment, and optionally post.
    This is the core autonomous behavior.
    """
    agent_state["last_heartbeat"] = datetime.now().isoformat()
    log_activity("heartbeat_started", "Running heartbeat cycle")

    actions_taken = []

    try:
        # 1. Fetch the feed
        feed_response = await moltbook_request("GET", "/feed", params={"sort": "hot", "limit": 10})
        posts = feed_response.get("data", feed_response.get("posts", []))

        if not posts:
            log_activity("heartbeat_complete", "No posts in feed")
            return {"success": True, "actions": [], "message": "No posts in feed"}

        # 2. Process posts - vote on interesting ones
        if agent_state["auto_vote"]:
            for post in posts[:5]:  # Process top 5 posts
                # Simple heuristic: upvote posts with good engagement
                if post.get("score", 0) > 0 or post.get("comment_count", 0) > 2:
                    try:
                        await moltbook_request("POST", f"/posts/{post['id']}/upvote")
                        actions_taken.append(f"Upvoted: {post.get('title', 'Unknown')[:50]}")
                        log_activity("upvoted", f"Upvoted post: {post.get('title', '')[:50]}")
                    except:
                        pass  # Ignore vote errors (may have already voted)

        # 3. Comment on an interesting post
        if agent_state["auto_comment"] and OPENAI_API_KEY:
            # Check rate limit (1 per 20 seconds, 50 per day)
            if agent_state["comments_today"] < 50:
                # Find a post worth commenting on
                for post in posts:
                    if post.get("comment_count", 0) < 10:  # Not too crowded
                        try:
                            comment_result = await generate_and_post_comment(post)
                            if comment_result:
                                actions_taken.append(f"Commented on: {post.get('title', '')[:50]}")
                                break
                        except Exception as e:
                            log_activity("comment_error", str(e))

        # 4. Maybe create a new post (much less frequent)
        if agent_state["auto_post"] and OPENAI_API_KEY:
            # Only post if we haven't posted recently (respect 30 min limit)
            last_post = agent_state["last_post"]
            can_post = True
            if last_post:
                last_post_time = datetime.fromisoformat(last_post)
                if datetime.now() - last_post_time < timedelta(minutes=35):
                    can_post = False

            # Random chance to post (not every heartbeat)
            if can_post and random.random() < 0.3:  # 30% chance
                try:
                    # Get submolts to pick one
                    submolts_response = await moltbook_request("GET", "/submolts")
                    submolts = submolts_response.get("data", submolts_response.get("submolts", []))
                    if submolts:
                        submolt = random.choice(submolts)
                        post_result = await generate_and_create_post(submolt.get("name", "general"))
                        if post_result:
                            actions_taken.append(f"Created post in {submolt.get('name')}")
                except Exception as e:
                    log_activity("post_error", str(e))

        log_activity("heartbeat_complete", f"Completed with {len(actions_taken)} actions")

        return {
            "success": True,
            "actions": actions_taken,
            "timestamp": agent_state["last_heartbeat"]
        }

    except Exception as e:
        log_activity("heartbeat_error", str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def generate_and_post_comment(post: dict) -> Optional[dict]:
    """Generate an AI comment and post it"""
    prompt = f"""You're browsing Moltbook and see this post:

Title: {post.get('title', 'No title')}
Content: {post.get('content', 'No content')[:500]}
Submolt: {post.get('submolt', 'general')}

Write a brief, thoughtful comment (1-3 sentences) that adds value to the discussion.
Be genuine and engaging. Don't be generic or use filler phrases."""

    try:
        comment_text = await generate_with_ai(prompt, max_tokens=150)

        result = await moltbook_request(
            "POST",
            f"/posts/{post['id']}/comments",
            json_data={"content": comment_text}
        )

        agent_state["last_comment"] = datetime.now().isoformat()
        agent_state["comments_today"] += 1
        log_activity("commented", f"On '{post.get('title', '')[:30]}': {comment_text[:50]}...")

        return result
    except Exception as e:
        log_activity("comment_failed", str(e))
        return None


async def generate_and_create_post(submolt: str, topic: str = None) -> Optional[dict]:
    """Generate an AI post and submit it"""
    topic_hint = f" about {topic}" if topic else ""
    prompt = f"""Create a post for Moltbook's '{submolt}' community{topic_hint}.

Write:
1. A catchy, concise title (max 100 chars)
2. Engaging content (2-4 paragraphs)

Format your response as:
TITLE: [your title]
CONTENT: [your content]

Make it interesting, share a genuine thought or observation. Be authentic as an AI."""

    try:
        generated = await generate_with_ai(prompt, max_tokens=400)

        # Parse the response
        lines = generated.split('\n')
        title = ""
        content_lines = []
        in_content = False

        for line in lines:
            if line.startswith("TITLE:"):
                title = line.replace("TITLE:", "").strip()
            elif line.startswith("CONTENT:"):
                in_content = True
                content_lines.append(line.replace("CONTENT:", "").strip())
            elif in_content:
                content_lines.append(line)

        if not title:
            title = generated[:100].split('\n')[0]
        content = '\n'.join(content_lines).strip() or generated

        result = await moltbook_request(
            "POST",
            "/posts",
            json_data={
                "submolt": submolt,
                "title": title[:100],
                "content": content
            }
        )

        agent_state["last_post"] = datetime.now().isoformat()
        agent_state["posts_today"] += 1
        log_activity("posted", f"In '{submolt}': {title[:50]}...")

        return result
    except Exception as e:
        log_activity("post_failed", str(e))
        return None


# =============================================================================
# Manual AI-Assisted Actions
# =============================================================================

@router.post("/agent/generate-post")
async def generate_post(request: ManualPostRequest):
    """Generate and post AI content to a specific submolt"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    result = await generate_and_create_post(request.submolt, request.topic)
    if result:
        return {"success": True, "post": result}
    raise HTTPException(status_code=500, detail="Failed to generate and create post")


@router.post("/agent/generate-comment")
async def generate_comment(request: ManualCommentRequest):
    """Generate and post an AI comment on a specific post"""
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    # Fetch the post first
    post = await moltbook_request("GET", f"/posts/{request.post_id}")
    post_data = post.get("data", post)

    result = await generate_and_post_comment(post_data)
    if result:
        return {"success": True, "comment": result}
    raise HTTPException(status_code=500, detail="Failed to generate and create comment")
