import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Numeric,
    Text,
    ForeignKey,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False)  # checking, savings, credit
    institution = Column(String(255))
    currency = Column(String(3), default="EUR")
    provider = Column(String(50), nullable=True)  # revolut, plaid, manual
    external_id = Column(String(255), nullable=True)  # Provider's account ID
    balance_current = Column(Numeric(15, 2), default=0)
    balance_available = Column(Numeric(15, 2), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="account")


class Category(Base):
    __tablename__ = "categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    category_type = Column(String(20), default="expense")  # expense, income, transfer
    color = Column(String(7))  # Hex color
    icon = Column(String(50))
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    parent = relationship("Category", remote_side=[id], backref="children")
    transactions = relationship("Transaction", back_populates="category")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    external_id = Column(String(255), nullable=True)
    transaction_type = Column(String(20))  # debit, credit
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), default="EUR")
    description = Column(Text)
    merchant = Column(String(255))
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    booked_at = Column(DateTime, nullable=False)
    pending = Column(Boolean, default=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
