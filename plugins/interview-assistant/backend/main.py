import os
import uuid
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# In-memory storage for interview sessions
sessions = {}


class CVUploadRequest(BaseModel):
    cv_text: str
    candidate_name: Optional[str] = None
    job_role: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str


class QuestionItem(BaseModel):
    category: str
    question: str
    suggested_answer: str
    difficulty: str


class InterviewSession(BaseModel):
    id: str
    candidate_name: str
    job_role: str
    cv_text: str
    questions: List[QuestionItem]
    chat_history: list
    created_at: str


QUESTION_GENERATION_PROMPT = """You are an expert technical interviewer. Analyze the following CV/resume and generate interview questions with suggested answers.

Candidate Name: {candidate_name}
Target Role: {job_role}

CV/Resume:
{cv_text}

Generate 8-10 interview questions across these categories:
- Technical Skills (based on their listed skills and experience)
- Experience Deep-Dive (probing their past projects and roles)
- Behavioral (STAR method questions relevant to their background)
- Problem Solving (scenarios related to their domain)
- Culture Fit (based on their career trajectory)

For each question, provide:
1. The category
2. The question
3. A suggested ideal answer (what a strong candidate should cover)
4. Difficulty level (Easy, Medium, Hard)

Respond in this exact JSON format:
{{
  "questions": [
    {{
      "category": "Technical Skills",
      "question": "...",
      "suggested_answer": "...",
      "difficulty": "Medium"
    }}
  ]
}}
"""

CHAT_SYSTEM_PROMPT = """You are an AI interview assistant helping an interviewer conduct a candidate interview. You have access to the candidate's CV and the generated interview questions.

Candidate: {candidate_name}
Role: {job_role}

CV/Resume:
{cv_text}

Generated Questions:
{questions_summary}

Your responsibilities:
- Answer follow-up questions about the candidate's background
- Suggest additional probing questions based on conversation context
- Help evaluate candidate responses
- Flag potential red flags or strengths in the candidate's profile
- Provide insights about skills gaps or strong matches for the role
- Keep responses concise and actionable for the interviewer

Always frame your responses from the interviewer's perspective - you are helping THEM conduct a better interview."""


@router.get("/sessions")
async def list_sessions():
    """List all interview sessions."""
    result = []
    for sid, session in sessions.items():
        result.append({
            "id": session["id"],
            "candidate_name": session["candidate_name"],
            "job_role": session["job_role"],
            "question_count": len(session["questions"]),
            "chat_count": len(session["chat_history"]),
            "created_at": session["created_at"],
        })
    return sorted(result, key=lambda x: x["created_at"], reverse=True)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a specific interview session with all data."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete an interview session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    del sessions[session_id]
    return {"message": "Session deleted"}


@router.post("/upload-cv")
async def upload_cv(request: CVUploadRequest):
    """Upload a CV and generate interview questions."""
    if not client.api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    cv_text = request.cv_text.strip()
    if not cv_text:
        raise HTTPException(status_code=400, detail="CV text cannot be empty")

    candidate_name = request.candidate_name or "Candidate"
    job_role = request.job_role or "Software Engineer"

    prompt = QUESTION_GENERATION_PROMPT.format(
        candidate_name=candidate_name,
        job_role=job_role,
        cv_text=cv_text,
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        content = response.choices[0].message.content

        # Parse JSON from response (handle markdown code blocks)
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        data = json.loads(content.strip())
        questions = data.get("questions", [])
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Failed to parse AI response. Please try again.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

    session_id = str(uuid.uuid4())[:8]
    sessions[session_id] = {
        "id": session_id,
        "candidate_name": candidate_name,
        "job_role": job_role,
        "cv_text": cv_text,
        "questions": questions,
        "chat_history": [],
        "created_at": datetime.now().isoformat(),
    }

    return sessions[session_id]


@router.post("/chat")
async def chat(request: ChatRequest):
    """Chat with the AI about the candidate."""
    if not client.api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    session = sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    questions_summary = "\n".join(
        f"- [{q['category']}] {q['question']}" for q in session["questions"]
    )

    system_prompt = CHAT_SYSTEM_PROMPT.format(
        candidate_name=session["candidate_name"],
        job_role=session["job_role"],
        cv_text=session["cv_text"],
        questions_summary=questions_summary,
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in session["chat_history"]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": request.message})

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

    session["chat_history"].append({
        "role": "user",
        "content": request.message,
        "timestamp": datetime.now().isoformat(),
    })
    session["chat_history"].append({
        "role": "assistant",
        "content": reply,
        "timestamp": datetime.now().isoformat(),
    })

    return {"response": reply, "chat_history": session["chat_history"]}
