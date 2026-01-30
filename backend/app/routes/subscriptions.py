"""
API routes for subscriptions management.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import re
from uuid import UUID
from decimal import Decimal
import logging

from app.database import get_db
from app.models import RecurringTransaction, Transaction
from app.db_helpers import get_user_id
from app.services.text_similarity import TextSimilarity, calculate_text_similarity
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared text similarity service
_text_similarity = TextSimilarity()


class MatchTransactionsResponse(BaseModel):
    """Response for matching transactions to a subscription."""
    success: bool
    message: str
    matched_count: int
    transaction_ids: List[str]


def _amount_close(amount1: Decimal, amount2: Decimal, tolerance_percent: float = 0.05) -> bool:
    """
    Check if two amounts are close within a tolerance percentage.

    Args:
        amount1: First amount
        amount2: Second amount
        tolerance_percent: Tolerance as a percentage (default 5%)

    Returns:
        True if amounts are within tolerance
    """
    if amount1 == 0 or amount2 == 0:
        return False

    # Use absolute values for comparison
    abs_amount1 = abs(float(amount1))
    abs_amount2 = abs(float(amount2))

    # Calculate percentage difference
    diff = abs(abs_amount1 - abs_amount2)
    avg = (abs_amount1 + abs_amount2) / 2

    if avg == 0:
        return False

    percentage_diff = diff / avg
    return percentage_diff <= tolerance_percent


@router.post("/{subscription_id}/match-transactions", response_model=MatchTransactionsResponse)
def match_transactions(
    subscription_id: UUID,
    user_id: Optional[str] = Query(None, description="User ID (optional, defaults to system user)"),
    description_similarity_threshold: float = Query(0.6, ge=0.0, le=1.0, description="Minimum similarity ratio for description matching"),
    amount_tolerance_percent: float = Query(0.05, ge=0.0, le=1.0, description="Maximum percentage difference for amount matching"),
    db: Session = Depends(get_db)
):
    """
    Match transactions to a subscription based on description similarity and amount closeness.

    Args:
        subscription_id: ID of the subscription to match against
        user_id: User ID (optional, defaults to system user)
        description_similarity_threshold: Minimum similarity ratio for description matching (0.0-1.0, default 0.6)
        amount_tolerance_percent: Maximum percentage difference for amount matching (default 5%)
        db: Database session

    Returns:
        MatchTransactionsResponse with matched transaction count and IDs
    """
    try:
        actual_user_id = get_user_id(user_id)

        # Get the subscription
        subscription = db.query(RecurringTransaction).filter(
            RecurringTransaction.id == subscription_id,
            RecurringTransaction.user_id == actual_user_id
        ).first()

        if not subscription:
            raise HTTPException(
                status_code=404,
                detail="Subscription not found"
            )

        logger.info(
            f"[MATCH] Matching transactions for subscription '{subscription.name}' "
            f"(ID: {subscription_id}, User: {actual_user_id})"
        )

        # Get all transactions for this user that don't already have a recurring_transaction_id
        # or have a different one
        candidate_transactions = db.query(Transaction).filter(
            Transaction.user_id == actual_user_id,
            or_(
                Transaction.recurring_transaction_id.is_(None),
                Transaction.recurring_transaction_id != subscription_id
            )
        ).all()

        logger.info(f"[MATCH] Found {len(candidate_transactions)} candidate transactions to check")

        # Get subscription fields for matching
        subscription_amount = abs(subscription.amount)  # Use absolute value for comparison

        matched_transactions = []
        matched_ids = []

        for txn in candidate_transactions:
            # Skip if transaction amount is zero
            if txn.amount == 0:
                continue

            txn_amount = abs(txn.amount)  # Use absolute value

            # Check amount similarity first (fast filter)
            if not _amount_close(subscription_amount, txn_amount, amount_tolerance_percent):
                continue

            # Use unified text similarity service
            best_score, match_method = _text_similarity.calculate_match_score(
                subscription_name=subscription.name,
                subscription_merchant=subscription.merchant,
                transaction_description=txn.description,
                transaction_merchant=txn.merchant
            )

            # Convert score to 0-1 range for comparison with threshold
            normalized_score = best_score / 100.0

            # If similarity meets threshold, consider it a match
            if normalized_score >= description_similarity_threshold:
                matched_transactions.append(txn)
                matched_ids.append(str(txn.id))
                logger.debug(
                    f"[MATCH] Matched transaction {txn.id}: "
                    f"description='{txn.description}', merchant='{txn.merchant}', "
                    f"amount={txn.amount}, score={best_score:.1f}%, method={match_method}"
                )

        # Update matched transactions
        if matched_transactions:
            for txn in matched_transactions:
                txn.recurring_transaction_id = subscription_id

            db.commit()
            logger.info(f"[MATCH] Successfully matched {len(matched_transactions)} transactions")
        else:
            logger.info("[MATCH] No matching transactions found")

        return MatchTransactionsResponse(
            success=True,
            message=f"Matched {len(matched_transactions)} transaction(s) to subscription '{subscription.name}'",
            matched_count=len(matched_transactions),
            transaction_ids=matched_ids
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[MATCH] Error matching transactions: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Failed to match transactions: {str(e)}"
        )
