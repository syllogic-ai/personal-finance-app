from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, asc, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from enum import Enum

from app.database import get_db
from app.models import Transaction, Account, Category
from app.schemas import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    TransactionWithDetails,
    CategoryAssign,
    CategorySpending,
)

router = APIRouter()


class SortBy(str, Enum):
    description = "description"
    account = "account"
    category = "category"
    date = "date"
    amount = "amount"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class TransactionTypeFilter(str, Enum):
    income = "income"
    expense = "expense"


@router.get("/", response_model=List[TransactionWithDetails])
def list_transactions(
    account_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    uncategorized: Optional[bool] = None,
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    sort_by: Optional[SortBy] = Query(None, alias="sort_by"),
    sort_order: Optional[SortOrder] = Query(SortOrder.desc, alias="sort_order"),
    type: Optional[TransactionTypeFilter] = Query(None, alias="type"),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Transaction)
        .options(joinedload(Transaction.account), joinedload(Transaction.category))
    )

    if account_id:
        query = query.filter(Transaction.account_id == account_id)

    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    if uncategorized:
        query = query.filter(Transaction.category_id.is_(None))

    if from_date:
        query = query.filter(Transaction.booked_at >= from_date)

    if to_date:
        query = query.filter(Transaction.booked_at <= to_date)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.description.ilike(search_term),
                Transaction.merchant.ilike(search_term),
            )
        )

    # Filter by income/expense type
    if type == TransactionTypeFilter.income:
        query = query.filter(Transaction.amount > 0)
    elif type == TransactionTypeFilter.expense:
        query = query.filter(Transaction.amount < 0)

    # Apply sorting
    if sort_by:
        order_func = asc if sort_order == SortOrder.asc else desc
        if sort_by == SortBy.description:
            query = query.order_by(order_func(Transaction.description))
        elif sort_by == SortBy.account:
            query = query.join(Account).order_by(order_func(Account.name))
        elif sort_by == SortBy.category:
            query = query.outerjoin(Category).order_by(order_func(Category.name))
        elif sort_by == SortBy.date:
            query = query.order_by(order_func(Transaction.booked_at))
        elif sort_by == SortBy.amount:
            query = query.order_by(order_func(Transaction.amount))
    else:
        # Default sorting by date descending
        query = query.order_by(Transaction.booked_at.desc())

    offset = (page - 1) * limit
    transactions = query.offset(offset).limit(limit).all()

    result = []
    for txn in transactions:
        txn_dict = {
            "id": txn.id,
            "account_id": txn.account_id,
            "external_id": txn.external_id,
            "transaction_type": txn.transaction_type,
            "amount": txn.amount,
            "currency": txn.currency,
            "description": txn.description,
            "merchant": txn.merchant,
            "category_id": txn.category_id,
            "booked_at": txn.booked_at,
            "pending": txn.pending,
            "notes": txn.notes,
            "created_at": txn.created_at,
            "updated_at": txn.updated_at,
            "category_name": txn.category.name if txn.category else None,
            "account_name": txn.account.name,
        }
        result.append(TransactionWithDetails(**txn_dict))

    return result


@router.get("/stats/by-category", response_model=List[CategorySpending])
def get_spending_by_category(
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    query = db.query(
        Transaction.category_id,
        Category.name.label("category_name"),
        func.sum(Transaction.amount).label("total"),
        func.count(Transaction.id).label("count"),
    ).outerjoin(Category, Transaction.category_id == Category.id)

    # Only expenses (negative amounts)
    query = query.filter(Transaction.amount < 0)

    if from_date:
        query = query.filter(Transaction.booked_at >= from_date)
    if to_date:
        query = query.filter(Transaction.booked_at <= to_date)

    results = query.group_by(Transaction.category_id, Category.name).all()

    return [
        CategorySpending(
            category_id=r.category_id,
            category_name=r.category_name or "Uncategorized",
            total=abs(r.total) if r.total else 0,
            count=r.count,
        )
        for r in results
    ]


@router.get("/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: UUID, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction


@router.post("/", response_model=TransactionResponse, status_code=201)
def create_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    # Verify account exists
    account = db.query(Account).filter(Account.id == transaction.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Verify category exists if provided
    if transaction.category_id:
        category = (
            db.query(Category).filter(Category.id == transaction.category_id).first()
        )
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

    db_transaction = Transaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: UUID, updates: TransactionUpdate, db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(transaction, field, value)

    db.commit()
    db.refresh(transaction)
    return transaction


@router.patch("/{transaction_id}/category", response_model=TransactionResponse)
def assign_category(
    transaction_id: UUID, category_data: CategoryAssign, db: Session = Depends(get_db)
):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    category = (
        db.query(Category).filter(Category.id == category_data.category_id).first()
    )
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    transaction.category_id = category_data.category_id
    db.commit()
    db.refresh(transaction)
    return transaction


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: UUID, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    db.delete(transaction)
    db.commit()
    return None


@router.delete("/by-account/{account_id}", status_code=200)
def delete_transactions_by_account(account_id: UUID, db: Session = Depends(get_db)):
    """
    Delete all transactions for a specific account.
    Use with caution - this permanently deletes all transactions.
    """
    from app.models import Account
    
    # Verify account exists
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Count transactions before deletion
    transaction_count = db.query(Transaction).filter(Transaction.account_id == account_id).count()
    
    # Delete all transactions for this account
    db.query(Transaction).filter(Transaction.account_id == account_id).delete()
    db.commit()
    
    return {
        "message": f"Deleted {transaction_count} transaction(s) for account '{account.name}'",
        "deleted_count": transaction_count,
        "account_name": account.name
    }
