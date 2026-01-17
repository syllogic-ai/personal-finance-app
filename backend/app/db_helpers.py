"""
Database helper utilities for handling user context and migrations.
"""
from typing import Optional
from sqlalchemy.orm import Session
from app.models import User


# System user ID for backward compatibility when userId is not available
# This should be replaced with actual user authentication in the future
SYSTEM_USER_ID = "test-user"


def get_or_create_system_user(db: Session) -> User:
    """
    Get or create a system user for backward compatibility.
    This allows the backend to work without authentication initially.
    
    Args:
        db: Database session
        
    Returns:
        User object for the system user
    """
    user = db.query(User).filter(User.id == SYSTEM_USER_ID).first()
    if not user:
        user = User(
            id=SYSTEM_USER_ID,
            email="system@localhost",
            name="System User",
            email_verified=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_user_id(user_id: Optional[str] = None) -> str:
    """
    Get user ID, defaulting to system user if not provided.
    
    Args:
        user_id: Optional user ID
        
    Returns:
        User ID string (system user if not provided)
    """
    return user_id or SYSTEM_USER_ID
