from fastapi.testclient import TestClient
from app.main import app
from app.db.database import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.all_models import Base

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["api_status"] == "healthy"

def test_register_and_login():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Register user 1
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "username": "testuser",
        "full_name": "Test User",
        "password": "password123"
    })
    assert response.status_code == 201

    # Login
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "password123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]

    # Register user 2
    response = client.post("/api/auth/register", json={
        "email": "test2@example.com",
        "username": "testuser2",
        "full_name": "Test User 2",
        "password": "password123"
    })
    assert response.status_code == 201

    # Login user 2
    response2 = client.post("/api/auth/login", json={
        "email": "test2@example.com",
        "password": "password123"
    })
    token2 = response2.json()["access_token"]

    # Test profile updates for user 1
    update_resp = client.put("/api/auth/me", headers={"Authorization": f"Bearer {token}"}, json={
        "location": "NY",
        "tags": ["testing"]
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["location"] == "NY"
    assert update_resp.json()["tags"] == ["testing"]

    # Get user 2 details to get UUID
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token2}"})
    user2_id = me_resp.json()["user_id"]

    # Follow user 2
    follow_resp = client.post(f"/api/social/follow/{user2_id}", headers={"Authorization": f"Bearer {token}"})
    assert follow_resp.status_code == 200

    # Check is following
    is_following_resp = client.get(f"/api/social/is-following/{user2_id}", headers={"Authorization": f"Bearer {token}"})
    assert is_following_resp.status_code == 200
    assert is_following_resp.json()["is_following"] is True

    # Test Public Profile
    pub_profile_resp = client.get("/api/auth/users/testuser2")
    assert pub_profile_resp.status_code == 200
    assert pub_profile_resp.json()["followers_count"] == 1
