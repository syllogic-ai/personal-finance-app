"""Tests for cursor pagination, sort_by, and account_id filter on MCP search/list tools."""
from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.mcp.tools import transactions as tx_tools
from app.models import Transaction, Account, Category, User


@pytest.fixture
def seeded_user(db_session):
    """Create a user with 2 accounts and 10 transactions spanning 10 days."""
    user = User(id="test-user-1", email="test@test.com")
    db_session.add(user)
    acc1 = Account(user_id=user.id, name="ABN", account_type="checking")
    acc2 = Account(user_id=user.id, name="Revolut", account_type="checking")
    db_session.add_all([acc1, acc2])
    db_session.flush()
    cat = Category(user_id=user.id, name="Food", category_type="expense")
    db_session.add(cat)
    db_session.flush()
    base = datetime(2026, 4, 1)
    for i in range(10):
        db_session.add(Transaction(
            user_id=user.id,
            account_id=acc1.id if i % 2 == 0 else acc2.id,
            amount=Decimal(f"-{(i + 1) * 10}"),
            currency="EUR",
            description=f"Purchase {i}",
            merchant=f"Merchant {i}",
            category_id=cat.id if i < 5 else None,
            booked_at=base + timedelta(days=i),
            transaction_type="debit",
        ))
    db_session.commit()
    try:
        yield user, acc1, acc2, cat
    finally:
        # Clean up committed data so tests are idempotent.
        db_session.query(Transaction).filter(Transaction.user_id == user.id).delete()
        db_session.query(Category).filter(Category.user_id == user.id).delete()
        db_session.query(Account).filter(Account.user_id == user.id).delete()
        db_session.query(User).filter(User.id == user.id).delete()
        db_session.commit()


def test_list_transactions_sort_by_amount_desc(seeded_user):
    user, _, _, _ = seeded_user
    result = tx_tools.list_transactions(
        user_id=user.id, sort_by="amount_desc", limit=3
    )
    # amount_desc over negative expenses: -10 is largest, -100 smallest
    amounts = [r["amount"] for r in result["transactions"]]
    assert amounts == sorted(amounts, reverse=True)
    assert len(result["transactions"]) == 3
