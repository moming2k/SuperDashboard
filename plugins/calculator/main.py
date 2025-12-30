from fastapi import APIRouter

router = APIRouter()

@router.get("/add")
async def add(a: int, b: int):
    return {"result": a + b}

@router.get("/multiply")
async def multiply(a: int, b: int):
    return {"result": a * b}
