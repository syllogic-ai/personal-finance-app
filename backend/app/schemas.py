from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID


# Account Schemas
class AccountBase(BaseModel):
    name: str
    account_type: str
    institution: Optional[str] = None
    currency: str = "EUR"
    balance_current: Decimal = Decimal("0")


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    balance_current: Optional[Decimal] = None
    is_active: Optional[bool] = None


class AccountResponse(AccountBase):
    id: UUID
    is_active: bool
    provider: Optional[str] = None
    external_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Category Schemas
class CategoryBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    category_type: str = "expense"
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: UUID
    is_system: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Transaction Schemas
class TransactionBase(BaseModel):
    account_id: UUID
    transaction_type: str  # debit, credit
    amount: Decimal
    currency: str = "EUR"
    description: str
    merchant: Optional[str] = None
    booked_at: datetime


class TransactionCreate(TransactionBase):
    category_id: Optional[UUID] = None
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    merchant: Optional[str] = None
    category_id: Optional[UUID] = None
    notes: Optional[str] = None


class CategoryAssign(BaseModel):
    category_id: UUID


class TransactionResponse(TransactionBase):
    id: UUID
    external_id: Optional[str] = None
    category_id: Optional[UUID] = None
    pending: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TransactionWithDetails(TransactionResponse):
    category_name: Optional[str] = None
    account_name: str


# Analytics Schemas
class CategorySpending(BaseModel):
    category_id: Optional[UUID]
    category_name: Optional[str]
    total: Decimal
    count: int


class AccountSummary(BaseModel):
    id: UUID
    name: str
    account_type: str
    balance: Decimal
