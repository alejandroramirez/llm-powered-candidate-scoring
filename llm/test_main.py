import pytest
from httpx import AsyncClient
from httpx._transports.asgi import ASGITransport
from main import app

transport = ASGITransport(app=app)


@pytest.mark.asyncio
async def test_healthz():
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_score_candidates_valid():
    payload = {
        "job_description": "Looking for a React developer with 3 years of experience.",
        "candidates": [
            {
                "id": "1",
                "name": "Jane Doe",
                "resume": "Experienced React developer with 4 years working on UI/UX."
            },
            {
                "id": "2",
                "name": "John Smith",
                "resume": "Backend-focused developer with some frontend experience."
            }
        ]
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/score", json=payload)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_missing_body_returns_422():
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/score")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_invalid_job_description_length():
    long_description = "A" * 201
    payload = {
        "job_description": long_description,
        "candidates": []
    }

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/score", json=payload)
    assert response.status_code == 422 or response.status_code == 400
