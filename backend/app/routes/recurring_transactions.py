"""
API routes for recurring transactions management.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import re
from uuid import UUID
from decimal import Decimal
from difflib import SequenceMatcher
import logging

from app.database import get_db
from app.models import RecurringTransaction, Transaction
from app.db_helpers import get_user_id
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class MatchTransactionsResponse(BaseModel):
    """Response for matching transactions to a recurring transaction."""
    success: bool
    message: str
    matched_count: int
    transaction_ids: List[str]


def _normalize_text(text: Optional[str]) -> str:
    """Normalize text for comparison."""
    if not text:
        return ""
    return text.lower().strip()


def _calculate_similarity(text1: str, text2: str) -> float:
    """Calculate similarity ratio between two strings."""
    if not text1 or not text2:
        return 0.0
    return SequenceMatcher(None, text1.lower(), text2.lower()).ratio()


def _extract_keywords(text: str) -> List[str]:
    """Extract meaningful keywords from text, filtering out common words."""
    if not text:
        return []
    
    # Common words to ignore
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'bill', 'payment',
        'transaction', 'incasso', 'sepa', 'machtiging', 'factnr', 'btw',
        'termijn', 'klantnr', 'crn', 'naam', 'omschrijving', 'incassant'
    }
    
    # Split by common separators and filter
    import re
    words = re.findall(r'\b\w+\b', text.lower())
    keywords = [w for w in words if len(w) > 2 and w not in stop_words]
    
    return keywords


def _check_keyword_match(keywords: List[str], text: str) -> float:
    """
    Check if keywords appear in text and return a match score.
    
    Args:
        keywords: List of keywords to search for
        text: Text to search in
    
    Returns:
        Match score between 0.0 and 1.0
    """
    if not keywords or not text:
        return 0.0
    
    text_lower = text.lower()
    matches = sum(1 for keyword in keywords if keyword in text_lower)
    
    if matches == 0:
        return 0.0
    
    # Score based on percentage of keywords found
    keyword_match_ratio = matches / len(keywords)
    
    # Also check if the most important keyword (first/longest) is present
    if keywords:
        most_important = max(keywords, key=len)
        if most_important in text_lower:
            # Boost score if most important keyword is found
            keyword_match_ratio = min(1.0, keyword_match_ratio + 0.2)
    
    return keyword_match_ratio


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


@router.post("/{recurring_transaction_id}/match-transactions", response_model=MatchTransactionsResponse)
def match_transactions(
    recurring_transaction_id: UUID,
    user_id: Optional[str] = Query(None, description="User ID (optional, defaults to system user)"),
    description_similarity_threshold: float = Query(0.6, ge=0.0, le=1.0, description="Minimum similarity ratio for description matching"),
    amount_tolerance_percent: float = Query(0.05, ge=0.0, le=1.0, description="Maximum percentage difference for amount matching"),
    db: Session = Depends(get_db)
):
    """
    Match transactions to a recurring transaction based on description similarity and amount closeness.
    
    Args:
        recurring_transaction_id: ID of the recurring transaction to match against
        user_id: User ID (optional, defaults to system user)
        description_similarity_threshold: Minimum similarity ratio for description matching (0.0-1.0, default 0.6)
        amount_tolerance_percent: Maximum percentage difference for amount matching (default 5%)
        db: Database session
    
    Returns:
        MatchTransactionsResponse with matched transaction count and IDs
    """
    try:
        actual_user_id = get_user_id(user_id)
        
        # Get the recurring transaction
        recurring_txn = db.query(RecurringTransaction).filter(
            RecurringTransaction.id == recurring_transaction_id,
            RecurringTransaction.user_id == actual_user_id
        ).first()
        
        if not recurring_txn:
            raise HTTPException(
                status_code=404,
                detail="Recurring transaction not found"
            )
        
        logger.info(
            f"[MATCH] Matching transactions for recurring transaction '{recurring_txn.name}' "
            f"(ID: {recurring_transaction_id}, User: {actual_user_id})"
        )
        
        # Get all transactions for this user that don't already have a recurring_transaction_id
        # or have a different one
        candidate_transactions = db.query(Transaction).filter(
            Transaction.user_id == actual_user_id,
            or_(
                Transaction.recurring_transaction_id.is_(None),
                Transaction.recurring_transaction_id != recurring_transaction_id
            )
        ).all()
        
        logger.info(f"[MATCH] Found {len(candidate_transactions)} candidate transactions to check")
        
        # Normalize recurring transaction fields for matching
        recurring_name = _normalize_text(recurring_txn.name)
        recurring_merchant = _normalize_text(recurring_txn.merchant)
        recurring_amount = abs(recurring_txn.amount)  # Use absolute value for comparison
        
        matched_transactions = []
        matched_ids = []
        
        for txn in candidate_transactions:
            # Skip if transaction amount is zero
            if txn.amount == 0:
                continue
            
            # Normalize transaction fields
            txn_description = _normalize_text(txn.description)
            txn_merchant = _normalize_text(txn.merchant)
            txn_amount = abs(txn.amount)  # Use absolute value
            
            # Check amount similarity
            if not _amount_close(recurring_amount, txn_amount, amount_tolerance_percent):
                continue
            
            # Check description/merchant similarity using multiple methods
            best_similarity = 0.0
            
            # Method 1: Extract keywords from recurring transaction name/merchant
            recurring_keywords = _extract_keywords(recurring_name)
            if recurring_merchant:
                recurring_keywords.extend(_extract_keywords(recurring_merchant))
            recurring_keywords = list(set(recurring_keywords))  # Remove duplicates
            
            # Method 2: Full string similarity (for shorter, exact matches)
            # Match against transaction description
            if txn_description:
                similarity_name = _calculate_similarity(recurring_name, txn_description)
                similarity_merchant = 0.0
                if recurring_merchant:
                    similarity_merchant = _calculate_similarity(recurring_merchant, txn_description)
                best_similarity = max(best_similarity, similarity_name, similarity_merchant)
                
                # Keyword-based matching (more flexible for long descriptions)
                if recurring_keywords:
                    keyword_score = _check_keyword_match(recurring_keywords, txn_description)
                    # Use the better of full similarity or keyword match
                    best_similarity = max(best_similarity, keyword_score)
            
            # Match against transaction merchant
            if txn_merchant:
                similarity_name = _calculate_similarity(recurring_name, txn_merchant)
                similarity_merchant = 0.0
                if recurring_merchant:
                    similarity_merchant = _calculate_similarity(recurring_merchant, txn_merchant)
                best_similarity = max(best_similarity, similarity_name, similarity_merchant)
                
                # Keyword-based matching
                if recurring_keywords:
                    keyword_score = _check_keyword_match(recurring_keywords, txn_merchant)
                    best_similarity = max(best_similarity, keyword_score)
            
            # Method 3: Check if recurring name/merchant appears as substring (case-insensitive)
            # This handles cases like "Vattenfall" in "Vattenfall Klantenservice"
            if txn_description:
                if recurring_name.lower() in txn_description.lower():
                    best_similarity = max(best_similarity, 0.7)  # High score for substring match
                if recurring_merchant and recurring_merchant.lower() in txn_description.lower():
                    best_similarity = max(best_similarity, 0.7)
            
            if txn_merchant:
                if recurring_name.lower() in txn_merchant.lower():
                    best_similarity = max(best_similarity, 0.7)
                if recurring_merchant and recurring_merchant.lower() in txn_merchant.lower():
                    best_similarity = max(best_similarity, 0.7)
            
            # If similarity meets threshold, consider it a match
            if best_similarity >= description_similarity_threshold:
                matched_transactions.append(txn)
                matched_ids.append(str(txn.id))
                logger.debug(
                    f"[MATCH] Matched transaction {txn.id}: "
                    f"description='{txn.description}', merchant='{txn.merchant}', "
                    f"amount={txn.amount}, similarity={best_similarity:.2f}"
                )
        
        # Update matched transactions
        if matched_transactions:
            for txn in matched_transactions:
                txn.recurring_transaction_id = recurring_transaction_id
            
            db.commit()
            logger.info(f"[MATCH] Successfully matched {len(matched_transactions)} transactions")
        else:
            logger.info("[MATCH] No matching transactions found")
        
        return MatchTransactionsResponse(
            success=True,
            message=f"Matched {len(matched_transactions)} transaction(s) to recurring transaction '{recurring_txn.name}'",
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
