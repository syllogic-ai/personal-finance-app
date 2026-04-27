"""
Broker trade import orchestration.

Validates ownership, generates stable external_ids for dedup, bulk-inserts
into `broker_trades`, and recomputes `Holding.quantity` and `Holding.avg_cost`
for every affected (account_id, symbol) pair using FIFO.
"""
from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models import Account, BrokerTrade, Holding
from app.services.pnl_service import Trade, compute_fifo


VALID_SIDES = ("buy", "sell")


def _normalize_quantity(q: Decimal) -> str:
    # Stable representation for hashing: strip trailing zeros, no scientific notation.
    s = format(q.normalize(), "f")
    return s if s != "-0" else "0"


def _generate_external_id(
    trade_date: date,
    symbol: str,
    side: str,
    quantity: Decimal,
    price: Decimal,
    ordinal: int,
) -> str:
    """Stable hash of the trade fields plus an ordinal disambiguator.

    Format: `<16-hex>#<N>`. Same statement re-uploaded → same id (no-op).
    Two genuinely identical trades on the same day → distinct ids via ordinal.
    """
    key = "|".join([
        trade_date.isoformat(),
        symbol.upper(),
        side.lower(),
        _normalize_quantity(quantity),
        _normalize_quantity(price),
    ])
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
    return f"{digest}#{ordinal}"
