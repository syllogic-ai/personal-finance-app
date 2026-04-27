"""Tests for the broker trade import service."""
from datetime import date
from decimal import Decimal

import pytest

from app.services.broker_trade_service import _generate_external_id


def test_generate_external_id_is_deterministic():
    a = _generate_external_id(
        trade_date=date.fromisoformat("2024-01-10"),
        symbol="AAPL",
        side="buy",
        quantity=Decimal("10"),
        price=Decimal("150.00"),
        ordinal=0,
    )
    b = _generate_external_id(
        trade_date=date.fromisoformat("2024-01-10"),
        symbol="AAPL",
        side="buy",
        quantity=Decimal("10"),
        price=Decimal("150.00"),
        ordinal=0,
    )
    assert a == b
    assert a.endswith("#0")


def test_generate_external_id_differs_by_ordinal():
    base_kwargs = dict(
        trade_date=date.fromisoformat("2024-01-10"),
        symbol="AAPL",
        side="buy",
        quantity=Decimal("10"),
        price=Decimal("150.00"),
    )
    a = _generate_external_id(**base_kwargs, ordinal=0)
    b = _generate_external_id(**base_kwargs, ordinal=1)
    assert a != b
    assert a.endswith("#0")
    assert b.endswith("#1")


def test_generate_external_id_differs_by_inputs():
    base_kwargs = dict(
        trade_date=date.fromisoformat("2024-01-10"),
        side="buy",
        quantity=Decimal("10"),
        price=Decimal("150.00"),
        ordinal=0,
    )
    a = _generate_external_id(symbol="AAPL", **base_kwargs)
    b = _generate_external_id(symbol="MSFT", **base_kwargs)
    assert a != b
