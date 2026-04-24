"""
Backfill the `transactions.embedding` column for existing rows.

This script ONLY populates embeddings. It does NOT touch category_system_id,
category_id, categorization_confidence, or categorization_method — existing
categorizations are preserved exactly as-is.

Run:
    cd backend && python -m scripts.backfill_transaction_embeddings <user_id>

Flags:
    --dry-run        Count what would be embedded and exit without API calls.
    --batch-size N   Transactions per OpenAI embeddings call (default: 100).
    --limit N        Cap total rows processed (default: no limit).

Cost: ~$0.00001 per row with text-embedding-3-small, so ~$0.10 per 10k rows.
"""
from __future__ import annotations

import argparse
import logging
import sys
from typing import List

from app.database import SessionLocal
from app.models import Transaction
from app.services.category_embedding import (
    CategoryEmbeddingService,
    build_transaction_text,
)

logger = logging.getLogger(__name__)


def backfill(user_id: str, dry_run: bool, batch_size: int, limit: int | None) -> None:
    db = SessionLocal()
    try:
        q = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.embedding.is_(None),
            )
            .order_by(Transaction.booked_at.desc())
        )
        if limit is not None:
            q = q.limit(limit)

        pending = q.all()
        total = len(pending)
        print(f"Found {total} transaction(s) without embeddings for user {user_id}")

        if total == 0 or dry_run:
            if dry_run:
                print("[dry-run] exiting without writing.")
            return

        embedder = CategoryEmbeddingService(db)
        if embedder._get_client() is None:
            print("OpenAI client unavailable (no OPENAI_API_KEY). Aborting.", file=sys.stderr)
            sys.exit(1)

        done = 0
        for start in range(0, total, batch_size):
            chunk: List[Transaction] = pending[start : start + batch_size]
            texts = [
                build_transaction_text(t.description, t.merchant, t.transaction_type)
                for t in chunk
            ]
            vectors = embedder.embed(texts)
            if not vectors or len(vectors) != len(chunk):
                logger.warning(
                    "Embedding batch returned %d vectors for %d rows; skipping chunk",
                    len(vectors),
                    len(chunk),
                )
                continue

            for txn, vec in zip(chunk, vectors):
                txn.embedding = vec

            db.commit()
            done += len(chunk)
            print(f"  embedded {done}/{total}")

        print(f"Done. Embedded {done}/{total} transactions. Categorization untouched.")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("user_id", help="User ID to backfill")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    backfill(
        user_id=args.user_id,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
