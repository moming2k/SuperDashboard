"""
AI Email Plugin - Backend
Read-only IMAP email fetching with AI-powered summarization,
action suggestions, reply drafting, and attachment-to-markdown conversion.
IMPORTANT: This plugin ONLY reads from IMAP. It never sends or replies to emails.
"""
import os
import sys
import uuid
import email
import imaplib
import base64
import re
from email import policy
from email.utils import parseaddr, parsedate_to_datetime
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# Add backend directory to path for imports
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../backend"))
sys.path.insert(0, backend_dir)

from database import (
    get_db, Email, EmailAttachment, EmailAISummary, EmailSuggestedReply
)
from sqlalchemy.orm import Session
from openai import OpenAI

router = APIRouter()

# IMAP Configuration
IMAP_HOST = os.getenv("EMAIL_IMAP_HOST", "")
IMAP_PORT = int(os.getenv("EMAIL_IMAP_PORT", "993"))
IMAP_USER = os.getenv("EMAIL_IMAP_USER", "")
IMAP_PASSWORD = os.getenv("EMAIL_IMAP_PASSWORD", "")
IMAP_USE_SSL = os.getenv("EMAIL_IMAP_USE_SSL", "true").lower() == "true"

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# ==================== Pydantic Models ====================

class EmailListItem(BaseModel):
    id: str
    message_id: str
    subject: Optional[str] = None
    sender: str
    recipients: list = []
    date: Optional[str] = None
    is_read: bool = False
    has_attachments: bool = False
    folder: str = "INBOX"
    summary: Optional[str] = None
    suggested_action: Optional[str] = None
    needs_reply: bool = False
    priority: Optional[str] = None

class EmailDetail(BaseModel):
    id: str
    message_id: str
    subject: Optional[str] = None
    sender: str
    recipients: list = []
    cc: list = []
    date: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    is_read: bool = False
    has_attachments: bool = False
    folder: str = "INBOX"
    summary: Optional[str] = None
    suggested_action: Optional[str] = None
    action_details: Optional[str] = None
    needs_reply: bool = False
    priority: Optional[str] = None
    attachments: list = []
    suggested_replies: list = []

class AttachmentResponse(BaseModel):
    id: str
    email_id: str
    filename: str
    content_type: Optional[str] = None
    size: Optional[int] = None
    markdown_content: Optional[str] = None

class SuggestedReplyResponse(BaseModel):
    id: str
    email_id: str
    draft_content: str
    tone: Optional[str] = None
    version: int = 1
    is_final: bool = False

class UpdateReplyRequest(BaseModel):
    draft_content: str
    is_final: Optional[bool] = None

class GenerateReplyRequest(BaseModel):
    tone: str = "professional"
    additional_context: Optional[str] = None

class RefineReplyRequest(BaseModel):
    instruction: str  # e.g. "make it shorter", "more formal", "add a greeting"
    current_content: str

class FetchRequest(BaseModel):
    folder: str = "INBOX"
    limit: int = 50

# ==================== Helper Functions ====================

def _connect_imap():
    """Create an IMAP connection (read-only)."""
    if not all([IMAP_HOST, IMAP_USER, IMAP_PASSWORD]):
        raise HTTPException(
            status_code=400,
            detail="IMAP credentials not configured. Set EMAIL_IMAP_HOST, EMAIL_IMAP_USER, EMAIL_IMAP_PASSWORD."
        )
    try:
        if IMAP_USE_SSL:
            conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        else:
            conn = imaplib.IMAP4(IMAP_HOST, IMAP_PORT)
        conn.login(IMAP_USER, IMAP_PASSWORD)
        return conn
    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=500, detail=f"IMAP connection failed: {str(e)}")


def _parse_email_message(raw_bytes):
    """Parse raw email bytes into structured data."""
    msg = email.message_from_bytes(raw_bytes, policy=policy.default)

    # Extract sender
    sender_name, sender_addr = parseaddr(msg.get("From", ""))
    sender = f"{sender_name} <{sender_addr}>" if sender_name else sender_addr

    # Extract recipients
    to_header = msg.get("To", "")
    recipients = [addr.strip() for addr in to_header.split(",") if addr.strip()]

    # Extract CC
    cc_header = msg.get("Cc", "")
    cc = [addr.strip() for addr in cc_header.split(",") if addr.strip()] if cc_header else []

    # Extract date
    date_str = msg.get("Date", "")
    date = None
    if date_str:
        try:
            date = parsedate_to_datetime(date_str)
        except Exception:
            pass

    # Extract body
    body_text = ""
    body_html = ""
    attachments = []

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition:
                att_data = part.get_payload(decode=True)
                att_filename = part.get_filename() or "unnamed"
                attachments.append({
                    "filename": att_filename,
                    "content_type": content_type,
                    "data": att_data,
                    "size": len(att_data) if att_data else 0
                })
            elif content_type == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    body_text = payload.decode("utf-8", errors="replace")
            elif content_type == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    body_html = payload.decode("utf-8", errors="replace")
    else:
        content_type = msg.get_content_type()
        payload = msg.get_payload(decode=True)
        if payload:
            if content_type == "text/html":
                body_html = payload.decode("utf-8", errors="replace")
            else:
                body_text = payload.decode("utf-8", errors="replace")

    return {
        "message_id": msg.get("Message-ID", str(uuid.uuid4())),
        "subject": msg.get("Subject", "(No Subject)"),
        "sender": sender,
        "recipients": recipients,
        "cc": cc,
        "date": date,
        "body_text": body_text,
        "body_html": body_html,
        "has_attachments": len(attachments) > 0,
        "attachments": attachments,
        "raw_headers": {
            "from": msg.get("From", ""),
            "to": msg.get("To", ""),
            "cc": msg.get("Cc", ""),
            "reply_to": msg.get("Reply-To", ""),
            "in_reply_to": msg.get("In-Reply-To", ""),
        }
    }


def _convert_attachment_to_markdown(filename, content_type, data):
    """Convert attachment content to markdown format."""
    if not data:
        return f"*Empty attachment: {filename}*"

    markdown = f"# Attachment: {filename}\n\n"
    markdown += f"**Type:** {content_type}  \n"
    markdown += f"**Size:** {len(data)} bytes\n\n---\n\n"

    # Text-based files
    text_types = [
        "text/plain", "text/csv", "text/html", "text/xml",
        "application/json", "application/xml", "text/markdown",
        "application/javascript", "text/css"
    ]

    if content_type in text_types or filename.endswith(('.txt', '.csv', '.json', '.xml', '.md', '.js', '.css', '.py', '.yaml', '.yml', '.ini', '.cfg', '.log')):
        try:
            text = data.decode("utf-8", errors="replace")
            if content_type == "text/csv" or filename.endswith(".csv"):
                lines = text.strip().split("\n")
                if lines:
                    headers = lines[0].split(",")
                    markdown += "| " + " | ".join(h.strip() for h in headers) + " |\n"
                    markdown += "| " + " | ".join("---" for _ in headers) + " |\n"
                    for line in lines[1:]:
                        cols = line.split(",")
                        markdown += "| " + " | ".join(c.strip() for c in cols) + " |\n"
            elif content_type == "text/html" or filename.endswith(".html"):
                # Strip HTML tags for markdown
                clean = re.sub(r'<[^>]+>', '', text)
                clean = re.sub(r'\s+', ' ', clean).strip()
                markdown += clean
            elif content_type == "application/json" or filename.endswith(".json"):
                markdown += f"```json\n{text}\n```"
            else:
                markdown += f"```\n{text}\n```"
        except Exception:
            markdown += f"*Could not decode text content for {filename}*"

    elif content_type and content_type.startswith("image/"):
        b64 = base64.b64encode(data).decode("ascii")
        markdown += f"![{filename}](data:{content_type};base64,{b64})\n\n"
        markdown += f"*Image file: {filename}*"

    elif content_type == "application/pdf" or filename.endswith(".pdf"):
        # For PDFs, try to extract text if possible, otherwise note it
        try:
            # Simple PDF text extraction (basic approach)
            text = data.decode("latin-1", errors="replace")
            # Extract text between stream markers (very basic)
            streams = re.findall(r'stream\s*(.*?)\s*endstream', text, re.DOTALL)
            extracted = ""
            for s in streams:
                printable = re.sub(r'[^\x20-\x7e\n\r\t]', '', s)
                if len(printable) > 20:
                    extracted += printable + "\n"
            if extracted.strip():
                markdown += f"**Extracted text (partial):**\n\n```\n{extracted[:5000]}\n```"
            else:
                markdown += f"*PDF file: {filename} - binary content, text extraction not available*"
        except Exception:
            markdown += f"*PDF file: {filename} - could not extract text*"

    else:
        b64 = base64.b64encode(data).decode("ascii")
        markdown += f"*Binary file: {filename}*  \n"
        markdown += f"*Content type: {content_type}*  \n"
        markdown += f"*Size: {len(data)} bytes*"

    return markdown


def _get_ai_client():
    """Get OpenAI client or raise error."""
    if not openai_client:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")
    return openai_client


# ==================== Email Fetching Endpoints ====================

@router.post("/fetch")
async def fetch_emails(request: FetchRequest, db: Session = Depends(get_db)):
    """Fetch emails from IMAP server and store in database. READ ONLY - never sends."""
    conn = _connect_imap()
    try:
        conn.select(request.folder, readonly=True)  # ALWAYS readonly
        _, message_numbers = conn.search(None, "ALL")

        if not message_numbers[0]:
            return {"fetched": 0, "message": "No emails found"}

        nums = message_numbers[0].split()
        # Fetch the most recent emails
        nums = nums[-request.limit:]
        fetched_count = 0

        for num in nums:
            _, msg_data = conn.fetch(num, "(RFC822)")
            if not msg_data or not msg_data[0]:
                continue

            raw_email = msg_data[0][1]
            parsed = _parse_email_message(raw_email)

            # Check if already stored
            existing = db.query(Email).filter(
                Email.message_id == parsed["message_id"]
            ).first()
            if existing:
                continue

            # Store email
            email_id = str(uuid.uuid4())
            db_email = Email(
                id=email_id,
                message_id=parsed["message_id"],
                subject=parsed["subject"],
                sender=parsed["sender"],
                recipients=parsed["recipients"],
                cc=parsed["cc"],
                date=parsed["date"],
                body_text=parsed["body_text"],
                body_html=parsed["body_html"],
                folder=request.folder,
                has_attachments=parsed["has_attachments"],
                raw_headers=parsed["raw_headers"],
                fetched_at=datetime.utcnow()
            )
            db.add(db_email)

            # Store attachments
            for att in parsed["attachments"]:
                att_id = str(uuid.uuid4())
                markdown = _convert_attachment_to_markdown(
                    att["filename"], att["content_type"], att["data"]
                )
                raw_b64 = base64.b64encode(att["data"]).decode("ascii") if att["data"] else None
                db_att = EmailAttachment(
                    id=att_id,
                    email_id=email_id,
                    filename=att["filename"],
                    content_type=att["content_type"],
                    size=att["size"],
                    markdown_content=markdown,
                    raw_content_b64=raw_b64
                )
                db.add(db_att)

            fetched_count += 1

        db.commit()
        return {"fetched": fetched_count, "message": f"Fetched {fetched_count} new emails"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")
    finally:
        try:
            conn.logout()
        except Exception:
            pass


@router.get("/emails")
async def list_emails(
    folder: str = Query("INBOX", description="Filter by folder"),
    limit: int = Query(50, description="Max results"),
    offset: int = Query(0, description="Offset for pagination"),
    db: Session = Depends(get_db)
):
    """List stored emails with optional AI summaries."""
    query = db.query(Email).filter(Email.folder == folder)
    total = query.count()
    emails = query.order_by(Email.date.desc()).offset(offset).limit(limit).all()

    result = []
    for e in emails:
        # Get AI summary if available
        ai = db.query(EmailAISummary).filter(EmailAISummary.email_id == e.id).first()
        result.append(EmailListItem(
            id=e.id,
            message_id=e.message_id,
            subject=e.subject,
            sender=e.sender,
            recipients=e.recipients or [],
            date=e.date.isoformat() if e.date else None,
            is_read=e.is_read,
            has_attachments=e.has_attachments,
            folder=e.folder,
            summary=ai.summary if ai else None,
            suggested_action=ai.suggested_action if ai else None,
            needs_reply=ai.needs_reply if ai else False,
            priority=ai.priority if ai else None
        ))

    return {"emails": result, "total": total, "limit": limit, "offset": offset}


@router.get("/emails/{email_id}")
async def get_email_detail(email_id: str, db: Session = Depends(get_db)):
    """Get full email detail including body, attachments, AI data."""
    e = db.query(Email).filter(Email.id == email_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Email not found")

    # Mark as read
    if not e.is_read:
        e.is_read = True
        db.commit()

    # Get AI summary
    ai = db.query(EmailAISummary).filter(EmailAISummary.email_id == email_id).first()

    # Get attachments
    attachments = db.query(EmailAttachment).filter(
        EmailAttachment.email_id == email_id
    ).all()

    # Get suggested replies
    replies = db.query(EmailSuggestedReply).filter(
        EmailSuggestedReply.email_id == email_id
    ).order_by(EmailSuggestedReply.version.desc()).all()

    return EmailDetail(
        id=e.id,
        message_id=e.message_id,
        subject=e.subject,
        sender=e.sender,
        recipients=e.recipients or [],
        cc=e.cc or [],
        date=e.date.isoformat() if e.date else None,
        body_text=e.body_text,
        body_html=e.body_html,
        is_read=e.is_read,
        has_attachments=e.has_attachments,
        folder=e.folder,
        summary=ai.summary if ai else None,
        suggested_action=ai.suggested_action if ai else None,
        action_details=ai.action_details if ai else None,
        needs_reply=ai.needs_reply if ai else False,
        priority=ai.priority if ai else None,
        attachments=[AttachmentResponse(
            id=a.id,
            email_id=a.email_id,
            filename=a.filename,
            content_type=a.content_type,
            size=a.size,
            markdown_content=a.markdown_content
        ) for a in attachments],
        suggested_replies=[SuggestedReplyResponse(
            id=r.id,
            email_id=r.email_id,
            draft_content=r.draft_content,
            tone=r.tone,
            version=r.version,
            is_final=r.is_final
        ) for r in replies]
    )


# ==================== AI Endpoints ====================

@router.post("/emails/{email_id}/analyze")
async def analyze_email(email_id: str, db: Session = Depends(get_db)):
    """AI-analyze an email: generate summary, suggest action, determine if reply needed."""
    client = _get_ai_client()

    e = db.query(Email).filter(Email.id == email_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Email not found")

    # Build context for AI
    body = e.body_text or ""
    if not body and e.body_html:
        # Strip HTML for analysis
        body = re.sub(r'<[^>]+>', '', e.body_html)
        body = re.sub(r'\s+', ' ', body).strip()

    # Include attachment info
    attachments = db.query(EmailAttachment).filter(
        EmailAttachment.email_id == email_id
    ).all()
    att_info = ""
    if attachments:
        att_names = ", ".join(a.filename for a in attachments)
        att_info = f"\n\nAttachments: {att_names}"

    prompt = f"""Analyze the following email and provide:
1. A concise summary (2-3 sentences)
2. A suggested action (one of: "reply", "archive", "follow_up", "delegate", "no_action")
3. Detailed explanation of why this action is recommended
4. Whether a reply is needed (true/false)
5. Priority level ("high", "medium", "low")

Email:
From: {e.sender}
To: {', '.join(e.recipients or [])}
Subject: {e.subject}
Date: {e.date.isoformat() if e.date else 'Unknown'}
{att_info}

Body:
{body[:4000]}

Respond in this exact JSON format:
{{
  "summary": "...",
  "suggested_action": "reply|archive|follow_up|delegate|no_action",
  "action_details": "...",
  "needs_reply": true|false,
  "priority": "high|medium|low"
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an email assistant. Analyze emails and provide structured recommendations. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )

        result_text = response.choices[0].message.content.strip()
        # Extract JSON from response
        json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON found in AI response")

        import json
        result = json.loads(json_match.group())

        # Store or update AI summary
        existing = db.query(EmailAISummary).filter(
            EmailAISummary.email_id == email_id
        ).first()

        if existing:
            existing.summary = result.get("summary", "")
            existing.suggested_action = result.get("suggested_action", "no_action")
            existing.action_details = result.get("action_details", "")
            existing.needs_reply = result.get("needs_reply", False)
            existing.priority = result.get("priority", "medium")
            existing.updated_at = datetime.utcnow()
        else:
            ai_summary = EmailAISummary(
                id=str(uuid.uuid4()),
                email_id=email_id,
                summary=result.get("summary", ""),
                suggested_action=result.get("suggested_action", "no_action"),
                action_details=result.get("action_details", ""),
                needs_reply=result.get("needs_reply", False),
                priority=result.get("priority", "medium")
            )
            db.add(ai_summary)

        db.commit()
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.post("/emails/analyze-all")
async def analyze_all_emails(
    limit: int = Query(20, description="Max emails to analyze"),
    db: Session = Depends(get_db)
):
    """Analyze all un-analyzed emails."""
    # Find emails without AI summaries
    unanalyzed = (
        db.query(Email)
        .outerjoin(EmailAISummary, Email.id == EmailAISummary.email_id)
        .filter(EmailAISummary.id.is_(None))
        .order_by(Email.date.desc())
        .limit(limit)
        .all()
    )

    results = []
    for e in unanalyzed:
        try:
            result = await analyze_email(e.id, db)
            results.append({"email_id": e.id, "status": "success", "result": result})
        except Exception as err:
            results.append({"email_id": e.id, "status": "error", "error": str(err)})

    return {"analyzed": len(results), "results": results}


# ==================== Reply Suggestion Endpoints ====================

@router.post("/emails/{email_id}/suggest-reply")
async def suggest_reply(
    email_id: str,
    request: GenerateReplyRequest,
    db: Session = Depends(get_db)
):
    """AI-generate a suggested reply for an email. This is a DRAFT only - never sent."""
    client = _get_ai_client()

    e = db.query(Email).filter(Email.id == email_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Email not found")

    body = e.body_text or ""
    if not body and e.body_html:
        body = re.sub(r'<[^>]+>', '', e.body_html)
        body = re.sub(r'\s+', ' ', body).strip()

    # Get AI summary for context
    ai = db.query(EmailAISummary).filter(EmailAISummary.email_id == email_id).first()
    context = ""
    if ai:
        context = f"\nAI Summary: {ai.summary}\nSuggested Action: {ai.suggested_action}"

    additional = ""
    if request.additional_context:
        additional = f"\n\nAdditional context from user: {request.additional_context}"

    prompt = f"""Draft a reply email with a {request.tone} tone for the following email.
The reply should be well-structured, appropriate, and ready to send.
Do NOT include email headers (To, From, Subject) - just the body of the reply.
{context}{additional}

Original Email:
From: {e.sender}
Subject: {e.subject}

Body:
{body[:3000]}

Write the reply:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"You are an email assistant drafting replies with a {request.tone} tone. Write clear, concise replies."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5
        )

        draft = response.choices[0].message.content.strip()

        # Get next version number
        latest = db.query(EmailSuggestedReply).filter(
            EmailSuggestedReply.email_id == email_id
        ).order_by(EmailSuggestedReply.version.desc()).first()
        next_version = (latest.version + 1) if latest else 1

        reply = EmailSuggestedReply(
            id=str(uuid.uuid4()),
            email_id=email_id,
            draft_content=draft,
            tone=request.tone,
            version=next_version,
            is_final=False
        )
        db.add(reply)
        db.commit()

        return SuggestedReplyResponse(
            id=reply.id,
            email_id=reply.email_id,
            draft_content=reply.draft_content,
            tone=reply.tone,
            version=reply.version,
            is_final=reply.is_final
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reply generation failed: {str(e)}")


@router.put("/emails/{email_id}/replies/{reply_id}")
async def update_reply(
    email_id: str,
    reply_id: str,
    request: UpdateReplyRequest,
    db: Session = Depends(get_db)
):
    """Update a suggested reply draft (interactive editing)."""
    reply = db.query(EmailSuggestedReply).filter(
        EmailSuggestedReply.id == reply_id,
        EmailSuggestedReply.email_id == email_id
    ).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    reply.draft_content = request.draft_content
    if request.is_final is not None:
        reply.is_final = request.is_final
    reply.updated_at = datetime.utcnow()
    db.commit()

    return SuggestedReplyResponse(
        id=reply.id,
        email_id=reply.email_id,
        draft_content=reply.draft_content,
        tone=reply.tone,
        version=reply.version,
        is_final=reply.is_final
    )


@router.post("/emails/{email_id}/replies/{reply_id}/refine")
async def refine_reply(
    email_id: str,
    reply_id: str,
    request: RefineReplyRequest,
    db: Session = Depends(get_db)
):
    """Use AI to refine/modify a reply draft based on a natural language instruction."""
    client = _get_ai_client()

    reply = db.query(EmailSuggestedReply).filter(
        EmailSuggestedReply.id == reply_id,
        EmailSuggestedReply.email_id == email_id
    ).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    # Get original email for context
    e = db.query(Email).filter(Email.id == email_id).first()
    email_context = ""
    if e:
        email_context = f"\nOriginal email from: {e.sender}\nSubject: {e.subject}"

    prompt = f"""You are refining an email reply draft. Apply the user's instruction to modify the draft.
{email_context}

Current draft:
---
{request.current_content}
---

Instruction: {request.instruction}

Return ONLY the refined email text, no explanations or commentary."""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an email editing assistant. Apply the user's instruction to refine the email draft. Return only the modified email text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4
        )

        refined = response.choices[0].message.content.strip()

        # Update the reply in-place
        reply.draft_content = refined
        reply.updated_at = datetime.utcnow()
        db.commit()

        return SuggestedReplyResponse(
            id=reply.id,
            email_id=reply.email_id,
            draft_content=reply.draft_content,
            tone=reply.tone,
            version=reply.version,
            is_final=reply.is_final
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")


@router.get("/emails/{email_id}/replies")
async def list_replies(email_id: str, db: Session = Depends(get_db)):
    """List all suggested reply drafts for an email."""
    replies = db.query(EmailSuggestedReply).filter(
        EmailSuggestedReply.email_id == email_id
    ).order_by(EmailSuggestedReply.version.desc()).all()

    return [SuggestedReplyResponse(
        id=r.id,
        email_id=r.email_id,
        draft_content=r.draft_content,
        tone=r.tone,
        version=r.version,
        is_final=r.is_final
    ) for r in replies]


# ==================== Attachment Endpoints ====================

@router.get("/emails/{email_id}/attachments")
async def list_attachments(email_id: str, db: Session = Depends(get_db)):
    """List attachments for an email."""
    attachments = db.query(EmailAttachment).filter(
        EmailAttachment.email_id == email_id
    ).all()

    return [AttachmentResponse(
        id=a.id,
        email_id=a.email_id,
        filename=a.filename,
        content_type=a.content_type,
        size=a.size,
        markdown_content=a.markdown_content
    ) for a in attachments]


@router.get("/emails/{email_id}/attachments/{attachment_id}")
async def get_attachment(email_id: str, attachment_id: str, db: Session = Depends(get_db)):
    """Get a specific attachment with its markdown content."""
    att = db.query(EmailAttachment).filter(
        EmailAttachment.id == attachment_id,
        EmailAttachment.email_id == email_id
    ).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    return AttachmentResponse(
        id=att.id,
        email_id=att.email_id,
        filename=att.filename,
        content_type=att.content_type,
        size=att.size,
        markdown_content=att.markdown_content
    )


# ==================== Status Endpoint ====================

@router.get("/status")
async def get_status(db: Session = Depends(get_db)):
    """Get plugin status and email counts."""
    total_emails = db.query(Email).count()
    analyzed_emails = db.query(EmailAISummary).count()
    unread_emails = db.query(Email).filter(Email.is_read == False).count()
    needs_reply = db.query(EmailAISummary).filter(EmailAISummary.needs_reply == True).count()

    imap_configured = bool(IMAP_HOST and IMAP_USER and IMAP_PASSWORD)
    ai_configured = bool(openai_client)

    return {
        "imap_configured": imap_configured,
        "ai_configured": ai_configured,
        "total_emails": total_emails,
        "analyzed_emails": analyzed_emails,
        "unread_emails": unread_emails,
        "needs_reply": needs_reply,
    }
