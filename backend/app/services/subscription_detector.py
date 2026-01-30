"""
Subscription pattern detection service for discovering recurring payment patterns.

Core approach: Find transactions with very similar descriptions that occur at
consistent time intervals. Supports any frequency (not just predefined ones).

Usage:
    detector = SubscriptionDetector(db, user_id)
    suggestions = detector.detect_patterns(new_transaction_ids)
    # suggestions are auto-saved to database
"""
import os
import re
import json
import logging
from typing import Optional, List, Dict, Tuple, Set
from decimal import Decimal
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.models import Transaction, RecurringTransaction, SubscriptionSuggestion
from app.db_helpers import get_user_id
from app.services.text_similarity import TextSimilarity
from app.services.merchant_extractor import MerchantExtractor

logger = logging.getLogger(__name__)


# Configuration
ENABLE_SUBSCRIPTION_SUGGESTIONS = os.getenv(
    "ENABLE_SUBSCRIPTION_SUGGESTIONS", "true"
).lower() == "true"

MIN_CONFIDENCE = int(os.getenv("SUBSCRIPTION_SUGGESTION_MIN_CONFIDENCE", "30"))
MAX_SUGGESTIONS = int(os.getenv("SUBSCRIPTION_SUGGESTION_MAX_COUNT", "20"))
MIN_TRANSACTIONS = int(os.getenv("SUBSCRIPTION_SUGGESTION_MIN_TRANSACTIONS", "2"))

# Text similarity threshold for grouping (high = strict matching)
TEXT_SIMILARITY_THRESHOLD = 0.65  # 65% similarity to be considered same subscription

# Amount can vary by up to 30% and still be considered the same subscription
AMOUNT_TOLERANCE_PERCENT = 0.30

# Interval consistency threshold - how much variation in days between payments is allowed
# E.g., 0.25 means intervals can vary by 25% from the average
INTERVAL_CONSISTENCY_THRESHOLD = 0.35


@dataclass
class DetectedPattern:
    """A detected recurring payment pattern."""
    suggested_name: str
    suggested_merchant: Optional[str]
    suggested_amount: Decimal
    currency: str
    detected_frequency: str  # weekly, biweekly, monthly, quarterly, yearly, or "every X days"
    confidence: int  # 0-100
    matched_transaction_ids: List[str] = field(default_factory=list)
    match_count: int = 0
    avg_interval_days: float = 0.0


class SubscriptionDetector:
    """
    Detects recurring payment patterns from transactions.

    Core Algorithm:
    1. Get all unlinked expense transactions
    2. Group by SEPA Creditor ID (CSID) if available - this uniquely identifies merchants
    3. For each group, check if transactions occur at consistent intervals
    4. If intervals are consistent, it's likely a subscription

    This approach:
    - Uses CSID as the primary grouping key for SEPA direct debits
    - Falls back to description similarity for non-SEPA transactions
    - Supports ANY frequency (not just weekly/monthly/yearly)
    - Is robust to amount variations
    """

    # Known SEPA Creditor IDs mapped to merchant names
    # These are Dutch direct debit creditor identifiers
    # Note: CSIDs can have varying lengths, we match by prefix
    KNOWN_CREDITOR_PREFIXES = {
        'NL10ZZZ302086370': 'Zilveren Kruis',
        'NL41ZZZ671825500': 'ODIDO',
        'NL08ZZZ502057730': 'Mollie',  # Payment processor (VOLT45 etc)
        'NL03ZZZ301243580': 'NS Reizigers',
        'NL36ZZZ332952490': 'Vattenfall',
        'NL32ZZZ332660000': 'Ziggo',
        'NL96ZZZ301970550': 'KPN',
        'NL65ZZZ331646640': 'T-Mobile',
        'NL22ZZZ301853520': 'Eneco',
        'NL09ZZZ301625750': 'Essent',
        # Add more as discovered
    }

    # Named frequency ranges (for labeling detected patterns)
    FREQUENCY_LABELS = {
        'weekly': (5, 9),
        'biweekly': (12, 18),
        'monthly': (26, 35),
        'bimonthly': (55, 70),
        'quarterly': (85, 100),
        'semi-annual': (170, 200),
        'yearly': (350, 380),
    }

    def __init__(self, db: Session, user_id: Optional[str] = None):
        """Initialize the SubscriptionDetector."""
        self.db = db
        self.user_id = get_user_id(user_id)
        self.text_similarity = TextSimilarity()
        self.merchant_extractor = MerchantExtractor()
        self._existing_subscriptions: Optional[List[RecurringTransaction]] = None

    def _load_existing_subscriptions(self) -> List[RecurringTransaction]:
        """Load and cache active subscriptions for the user."""
        if self._existing_subscriptions is None:
            self._existing_subscriptions = self.db.query(RecurringTransaction).filter(
                RecurringTransaction.user_id == self.user_id,
                RecurringTransaction.is_active == True
            ).all()
        return self._existing_subscriptions

    def _extract_sepa_creditor_id(self, text: Optional[str]) -> Optional[str]:
        """
        Extract SEPA Creditor ID (CSID) or IBAN from transaction description.

        CSID format: NLxxZZZxxxxxxxxxx (e.g., NL10ZZZ302086370000)
        IBAN format: NLxxAAAAxxxxxxxxxx (e.g., NL23ABNA0126656150)

        These uniquely identify the merchant in SEPA direct debits.
        """
        if not text:
            return None

        # Look for CSID pattern (NLxxZZZxxxxxxxxx) - SEPA Direct Debit creditor
        # CSIDs can be 15-18 digits after the ZZZ
        csid_match = re.search(r'\b(NL\d{2}ZZZ\d{9,18})\b', text, re.IGNORECASE)
        if csid_match:
            return csid_match.group(1).upper()

        # Look for IBAN in context of transfers (for recurring transfers)
        # Pattern: IBAN/NLxxAAAAxxxxxxxxxx or IBAN: NLxxAAAAxxxxxxxxxx
        iban_match = re.search(r'IBAN[/: ]*([A-Z]{2}\d{2}[A-Z]{4}\d{10})\b', text, re.IGNORECASE)
        if iban_match:
            return iban_match.group(1).upper()

        return None

    def _get_merchant_from_creditor_id(self, csid: str) -> Optional[str]:
        """Look up merchant name from CSID using prefix matching."""
        if not csid:
            return None

        # Try prefix matching (CSIDs can have trailing digits)
        for prefix, merchant in self.KNOWN_CREDITOR_PREFIXES.items():
            if csid.startswith(prefix):
                return merchant

        return None

    def _normalize_description(self, text: Optional[str]) -> str:
        """
        Normalize a transaction description for comparison.

        Removes noise like reference numbers, dates, and common banking terms
        while preserving the merchant/service identifier.
        """
        if not text:
            return ""

        normalized = text.lower().strip()

        # Remove common noise patterns (but NOT CSID/IBAN - those are handled separately)
        noise_patterns = [
            r'\b\d{8,}\b',  # Very long numbers only (8+ digits)
            r'\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}',  # Dates (DD/MM/YYYY)
            r'\d{4}[-/.]\d{1,2}[-/.]\d{1,2}',  # ISO dates (YYYY-MM-DD)
            r'\b\d{2}[-/]\d{4}\b',  # Month-year (01-2025)
            r'\b(ref|nr|no|number|kenmerk|factnr|factuur|invoice)[.:# ]*\w*',  # Reference labels
            r'\b(btw|vat|tax)[.:# ]*\d*%?\b',  # Tax references
            r'\b(periode|period|termijn)[.:# ]*\w*\b',  # Period references
            r'\b(bv|nv|ltd|inc|gmbh|llc|co|corp)\b\.?',  # Company suffixes
            r'\bb\.v\.?\b|\bn\.v\.?\b',  # Dutch company suffixes with dots
            r'[%€$£]',  # Currency/percentage symbols
            r'/trtp/',  # Transaction type prefix
            r'/csid/',  # CSID prefix (we extract the ID separately)
            r'/iban/',  # IBAN prefix
            r'/bic/',  # BIC prefix
            r'/naam/',  # Name prefix
            r'pas\d{3}',  # Card number suffix (PAS000)
        ]

        for pattern in noise_patterns:
            normalized = re.sub(pattern, ' ', normalized, flags=re.IGNORECASE)

        # Remove extra whitespace and trim
        normalized = re.sub(r'\s+', ' ', normalized).strip()

        return normalized

    def _get_description_fingerprint(self, txn: Transaction) -> str:
        """
        Get a fingerprint for a transaction that can be used for initial grouping.

        Priority:
        1. SEPA Creditor ID (CSID) - uniquely identifies merchant in direct debits
        2. IBAN - for recurring transfers
        3. Known merchant from merchant extractor
        4. Merchant field
        5. Significant words from description
        """
        # Priority 1: SEPA Creditor ID or IBAN (most reliable for recurring payments)
        creditor_id = self._extract_sepa_creditor_id(txn.description)
        if creditor_id:
            return f"CREDITOR:{creditor_id}"

        # Priority 2: Try merchant extractor
        result = self.merchant_extractor.extract(txn.description, txn.merchant)
        if result.merchant and result.confidence >= 70:
            return result.merchant.lower()

        # Priority 3: Use merchant field if available
        if txn.merchant:
            return txn.merchant.lower().strip()

        # Priority 4: Use normalized description keywords
        normalized = self._normalize_description(txn.description)

        skip_words = {
            'sepa', 'incasso', 'machtiging', 'payment', 'transfer', 'betaling',
            'overboeking', 'periodieke', 'overb', 'algemeen', 'doorlopend',
            'naar', 'van', 'voor', 'met', 'aan', 'bij', 'the', 'for', 'from', 'to',
            'bv', 'nv', 'ltd', 'inc', 'gmbh', 'llc', 'incassant'
        }

        words = normalized.split()
        significant = [w for w in words if len(w) >= 3 and w not in skip_words]

        if significant:
            return ' '.join(significant[:4])

        return normalized[:40] if normalized else ""

    def _calculate_description_similarity(self, txn1: Transaction, txn2: Transaction) -> float:
        """
        Calculate how similar two transaction descriptions are.

        Returns a score from 0.0 to 1.0.
        """
        # First check: SEPA Creditor ID match (strongest signal)
        csid1 = self._extract_sepa_creditor_id(txn1.description)
        csid2 = self._extract_sepa_creditor_id(txn2.description)

        if csid1 and csid2:
            if csid1 == csid2:
                return 1.0  # Same creditor = same subscription
            else:
                return 0.0  # Different creditors = different subscriptions

        # If only one has CSID, they're probably different
        if csid1 or csid2:
            return 0.3  # Low but not zero (might be same merchant, different payment method)

        # Normalize descriptions
        desc1 = self._normalize_description(txn1.description)
        desc2 = self._normalize_description(txn2.description)

        # Also consider merchant fields
        merchant1 = (txn1.merchant or "").lower().strip()
        merchant2 = (txn2.merchant or "").lower().strip()

        # If both have merchants and they match exactly
        if merchant1 and merchant2 and merchant1 == merchant2:
            return 1.0

        # Use text similarity service
        if desc1 and desc2:
            result = self.text_similarity.calculate(desc1, desc2)
            base_score = result.score / 100.0

            # Boost if merchants are similar too
            if merchant1 and merchant2:
                merchant_result = self.text_similarity.calculate(merchant1, merchant2)
                merchant_score = merchant_result.score / 100.0
                return 0.7 * base_score + 0.3 * merchant_score

            return base_score

        # Fallback to merchant comparison only
        if merchant1 and merchant2:
            result = self.text_similarity.calculate(merchant1, merchant2)
            return result.score / 100.0

        return 0.0

    def _check_interval_consistency(self, dates: List[datetime]) -> Tuple[bool, float, float]:
        """
        Check if a list of dates shows consistent intervals.

        Returns:
            (is_consistent, avg_interval_days, consistency_score)
        """
        if len(dates) < 2:
            return False, 0.0, 0.0

        # Sort dates
        sorted_dates = sorted(dates)

        # Calculate intervals between consecutive dates
        intervals = []
        for i in range(1, len(sorted_dates)):
            days = (sorted_dates[i] - sorted_dates[i-1]).days
            if days > 0:  # Ignore same-day transactions
                intervals.append(days)

        if not intervals:
            return False, 0.0, 0.0

        # Calculate statistics
        avg_interval = sum(intervals) / len(intervals)

        if avg_interval < 5:  # Less than 5 days average = probably not a subscription
            return False, avg_interval, 0.0

        # Calculate how consistent the intervals are
        if len(intervals) == 1:
            # Only one interval - check if it's in a reasonable range
            if 5 <= intervals[0] <= 400:  # Between weekly and yearly
                return True, intervals[0], 0.7  # Give it a decent score
            return False, intervals[0], 0.0

        # Calculate coefficient of variation (std_dev / mean)
        variance = sum((x - avg_interval) ** 2 for x in intervals) / len(intervals)
        std_dev = variance ** 0.5
        cv = std_dev / avg_interval if avg_interval > 0 else 1.0

        # Consistency score: lower CV = more consistent
        # CV of 0 = perfect consistency (score 1.0)
        # CV of INTERVAL_CONSISTENCY_THRESHOLD = minimum acceptable (score ~0.5)
        consistency_score = max(0, 1 - (cv / (INTERVAL_CONSISTENCY_THRESHOLD * 2)))

        is_consistent = cv <= INTERVAL_CONSISTENCY_THRESHOLD

        return is_consistent, avg_interval, consistency_score

    def _get_frequency_label(self, avg_days: float) -> str:
        """Convert average interval in days to a human-readable frequency."""
        for label, (min_days, max_days) in self.FREQUENCY_LABELS.items():
            if min_days <= avg_days <= max_days:
                return label

        # Custom frequency
        if avg_days < 7:
            return f"every {round(avg_days)} days"
        elif avg_days < 14:
            weeks = round(avg_days / 7, 1)
            return f"every {weeks} weeks" if weeks != 1 else "weekly"
        elif avg_days < 60:
            weeks = round(avg_days / 7)
            return f"every {weeks} weeks"
        elif avg_days < 365:
            months = round(avg_days / 30)
            return f"every {months} months"
        else:
            years = round(avg_days / 365, 1)
            return f"every {years} years"

    def _find_similar_transactions(
        self,
        target_txn: Transaction,
        all_transactions: List[Transaction],
        processed_ids: Set[str]
    ) -> List[Transaction]:
        """
        Find all transactions similar to the target transaction.
        """
        similar = [target_txn]

        for txn in all_transactions:
            if str(txn.id) in processed_ids:
                continue
            if txn.id == target_txn.id:
                continue

            similarity = self._calculate_description_similarity(target_txn, txn)

            if similarity >= TEXT_SIMILARITY_THRESHOLD:
                similar.append(txn)

        return similar

    def _extract_subscription_pattern(
        self,
        transactions: List[Transaction]
    ) -> Tuple[List[Transaction], float, float]:
        """
        Extract the main subscription pattern from a group of transactions.

        When a provider has both recurring subscription charges and sporadic
        one-off charges (e.g., insurance premium vs. co-pays), this method
        identifies the subscription by finding the amount cluster with the
        most consistent timing.

        Returns:
            (filtered_transactions, avg_amount, amount_cv)
        """
        if len(transactions) < 2:
            amounts = [abs(float(t.amount)) for t in transactions]
            avg = sum(amounts) / len(amounts) if amounts else 0
            return transactions, avg, 0.0

        # Step 1: Cluster transactions by amount (20% tolerance)
        amount_clusters: List[List[Transaction]] = []

        for txn in transactions:
            amt = abs(float(txn.amount))
            placed = False

            for cluster in amount_clusters:
                cluster_avg = sum(abs(float(t.amount)) for t in cluster) / len(cluster)
                if abs(amt - cluster_avg) / max(amt, cluster_avg) <= 0.20:
                    cluster.append(txn)
                    placed = True
                    break

            if not placed:
                amount_clusters.append([txn])

        # Step 2: For each cluster with 2+ transactions, check interval consistency
        best_cluster = None
        best_score = -1

        for cluster in amount_clusters:
            if len(cluster) < MIN_TRANSACTIONS:
                continue

            dates = [t.booked_at for t in cluster if t.booked_at]
            if len(dates) < MIN_TRANSACTIONS:
                continue

            is_consistent, avg_interval, consistency_score = self._check_interval_consistency(dates)

            # Score = consistency * transaction count (prefer larger, more consistent clusters)
            score = consistency_score * len(cluster)

            # Bonus for being in typical subscription frequency
            if is_consistent:
                if 25 <= avg_interval <= 35:  # Monthly
                    score *= 1.5
                elif 350 <= avg_interval <= 380:  # Yearly/Annual
                    score *= 1.5
                elif 85 <= avg_interval <= 100:  # Quarterly
                    score *= 1.4
                elif 170 <= avg_interval <= 200:  # Semi-annual
                    score *= 1.3
                elif 5 <= avg_interval <= 10:  # Weekly
                    score *= 1.3
                elif 12 <= avg_interval <= 18:  # Biweekly
                    score *= 1.2

            if score > best_score:
                best_score = score
                best_cluster = cluster

        # Step 3: Return the best cluster, or the largest cluster if none are consistent
        if best_cluster is None:
            # Fall back to largest cluster
            best_cluster = max(amount_clusters, key=len)

        # Calculate stats for the selected cluster
        amounts = [abs(float(t.amount)) for t in best_cluster]
        avg_amount = sum(amounts) / len(amounts)

        if len(amounts) > 1:
            variance = sum((a - avg_amount) ** 2 for a in amounts) / len(amounts)
            std_dev = variance ** 0.5
            amount_cv = std_dev / avg_amount if avg_amount > 0 else 0
        else:
            amount_cv = 0.0

        return best_cluster, avg_amount, amount_cv

    def _analyze_transaction_group(
        self,
        transactions: List[Transaction]
    ) -> Optional[DetectedPattern]:
        """
        Analyze a group of similar transactions to see if they form a pattern.
        """
        if len(transactions) < MIN_TRANSACTIONS:
            return None

        # Check if this is a CSID-based group (same creditor = strong signal)
        first_txn = transactions[0]
        csid = self._extract_sepa_creditor_id(first_txn.description)
        is_csid_group = csid is not None
        known_merchant = self._get_merchant_from_creditor_id(csid) if csid else None

        # For CSID groups, identify the main subscription pattern by finding
        # transactions with consistent amounts (the actual subscription vs sporadic charges)
        if is_csid_group and len(transactions) >= 3:
            transactions, avg_amount, amount_cv = self._extract_subscription_pattern(transactions)
            if len(transactions) < MIN_TRANSACTIONS:
                return None
        else:
            # Non-CSID groups: use all transactions
            amounts = [abs(float(txn.amount)) for txn in transactions]
            avg_amount = sum(amounts) / len(amounts)
            amount_variance = sum((a - avg_amount) ** 2 for a in amounts) / len(amounts)
            amount_std = amount_variance ** 0.5
            amount_cv = amount_std / avg_amount if avg_amount > 0 else 0

        # Get dates from the (possibly filtered) transactions
        dates = [txn.booked_at for txn in transactions if txn.booked_at]

        if len(dates) < MIN_TRANSACTIONS:
            return None

        # Check interval consistency
        is_consistent, avg_interval, consistency_score = self._check_interval_consistency(dates)

        # For CSID groups, be more lenient on interval consistency
        if not is_consistent:
            if is_csid_group and len(transactions) >= 3:
                is_consistent = True
                consistency_score = max(0.3, consistency_score)
            else:
                return None

        # Calculate confidence score
        confidence = 0

        # Base confidence from interval consistency (0-40 points)
        confidence += int(consistency_score * 40)

        # Big bonus for CSID-based groups (0-25 points)
        # CSID = definitive proof it's the same merchant
        if is_csid_group:
            if known_merchant:
                confidence += 25  # Known merchant from CSID
            else:
                confidence += 15  # Unknown CSID, but still same creditor

        # Bonus for transaction count (0-25 points)
        count_bonus = min(25, (len(transactions) - 1) * 5)
        confidence += count_bonus

        # Bonus for amount consistency (0-15 points)
        if amount_cv < 0.05:  # Very consistent
            confidence += 15
        elif amount_cv < 0.10:
            confidence += 10
        elif amount_cv < 0.20:
            confidence += 5

        # Bonus for known merchant from extractor (0-10 points) - only if not already from CSID
        if not known_merchant:
            merchant_result = self.merchant_extractor.extract(
                first_txn.description, first_txn.merchant
            )
            if merchant_result.merchant and merchant_result.confidence >= 90:
                confidence += 10
            elif merchant_result.merchant and merchant_result.confidence >= 60:
                confidence += 5

        # Bonus for being in a typical subscription frequency (0-10 points)
        frequency_label = self._get_frequency_label(avg_interval)
        if frequency_label in ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']:
            confidence += 10
        elif frequency_label in ['bimonthly', 'semi-annual']:
            confidence += 5

        confidence = min(100, confidence)

        if confidence < MIN_CONFIDENCE:
            return None

        # Get the best name for this pattern
        suggested_name, suggested_merchant = self._extract_best_name(transactions)

        # Sort transactions by date for ID list
        sorted_txns = sorted(transactions, key=lambda t: t.booked_at)

        return DetectedPattern(
            suggested_name=suggested_name[:255],
            suggested_merchant=suggested_merchant[:255] if suggested_merchant else None,
            suggested_amount=Decimal(str(round(avg_amount, 2))),
            currency=first_txn.currency or "EUR",
            detected_frequency=frequency_label,
            confidence=confidence,
            matched_transaction_ids=[str(txn.id) for txn in sorted_txns],
            match_count=len(transactions),
            avg_interval_days=avg_interval
        )

    def _extract_best_name(self, transactions: List[Transaction]) -> Tuple[str, Optional[str]]:
        """Extract the best name and merchant for a pattern."""
        if not transactions:
            return "Unknown Subscription", None

        first_txn = transactions[0]

        # Priority 1: Check CSID against known creditors
        csid = self._extract_sepa_creditor_id(first_txn.description)
        known_merchant = self._get_merchant_from_creditor_id(csid) if csid else None

        if known_merchant:
            # Special case: Mollie is a payment processor, try to extract actual merchant
            if known_merchant == 'Mollie':
                # Look for merchant name after "Mollie" in description
                for txn in transactions:
                    result = self.merchant_extractor.extract(txn.description, txn.merchant)
                    if result.merchant and result.merchant.lower() != 'mollie':
                        return result.merchant, result.merchant

            return known_merchant, known_merchant

        # Priority 2: Try merchant extractor on each transaction
        for txn in transactions:
            result = self.merchant_extractor.extract(txn.description, txn.merchant)
            if result.merchant and result.confidence >= 70:
                return result.merchant, result.merchant

        # Priority 3: Use most common merchant field
        merchants = [txn.merchant for txn in transactions if txn.merchant]
        if merchants:
            most_common = max(set(merchants), key=merchants.count)
            return most_common, most_common

        # Priority 4: Extract name from SEPA transfer description (Naam: or /NAME/)
        for txn in transactions:
            desc = txn.description or ""
            # Look for "Naam: XXX" pattern
            naam_match = re.search(r'Naam:\s*([^\s/][^/\n]{2,})', desc, re.IGNORECASE)
            if naam_match:
                name = naam_match.group(1).strip()
                if name:
                    return name, name
            # Look for "/NAME/XXX/" pattern
            name_match = re.search(r'/NAME/([^/]+)', desc, re.IGNORECASE)
            if name_match:
                name = name_match.group(1).strip()
                if name:
                    return name, name

        # Priority 5: If we have a CSID but it's unknown, use a cleaned version
        if csid:
            # Try to find any identifying text in the description
            for txn in transactions:
                normalized = self._normalize_description(txn.description)
                # Remove common SEPA prefixes
                cleaned = re.sub(
                    r'^(sepa\s+)?(incasso\s+)?(algemeen\s+)?(doorlopend\s+)?',
                    '', normalized, flags=re.IGNORECASE
                ).strip()
                if cleaned and len(cleaned) >= 3:
                    return cleaned[:50].title(), None

            return f"SEPA Direct Debit ({csid[-6:]})", None

        # Priority 5: Use the cleanest description
        descriptions = [txn.description for txn in transactions if txn.description]
        if descriptions:
            valid_descs = [d for d in descriptions if len(d) >= 5]
            if valid_descs:
                cleanest = min(valid_descs, key=len)
                normalized = self._normalize_description(cleanest)
                if normalized:
                    return normalized[:50].title(), None

        return "Unknown Subscription", None

    def _matches_existing_subscription(self, pattern: DetectedPattern) -> bool:
        """Check if a pattern matches an existing active subscription."""
        existing = self._load_existing_subscriptions()

        for sub in existing:
            # Check amount match (within tolerance)
            sub_amount = abs(float(sub.amount))
            pattern_amount = abs(float(pattern.suggested_amount))

            if sub_amount > 0 and pattern_amount > 0:
                diff = abs(sub_amount - pattern_amount)
                avg = (sub_amount + pattern_amount) / 2
                if diff / avg > 0.20:  # More than 20% difference
                    continue

            # Check text similarity
            score, _ = self.text_similarity.calculate_match_score(
                subscription_name=sub.name,
                subscription_merchant=sub.merchant,
                transaction_description=pattern.suggested_name,
                transaction_merchant=pattern.suggested_merchant
            )

            if score >= 50:
                return True

        return False

    def _check_similar_pending_suggestion(
        self,
        pattern: DetectedPattern
    ) -> Optional[SubscriptionSuggestion]:
        """Check if a similar suggestion already exists (pending)."""
        pending = self.db.query(SubscriptionSuggestion).filter(
            SubscriptionSuggestion.user_id == self.user_id,
            SubscriptionSuggestion.status == "pending"
        ).all()

        for suggestion in pending:
            # Check amount similarity
            sug_amount = abs(float(suggestion.suggested_amount))
            pat_amount = abs(float(pattern.suggested_amount))

            if sug_amount > 0 and pat_amount > 0:
                diff = abs(sug_amount - pat_amount)
                avg = (sug_amount + pat_amount) / 2
                if diff / avg > 0.20:
                    continue

            # Check name similarity
            score = self.text_similarity.calculate(
                suggestion.suggested_name,
                pattern.suggested_name
            ).score

            if score >= 60:
                return suggestion

        return None

    def detect_patterns(
        self,
        transaction_ids: Optional[List[str]] = None,
        lookback_days: int = 365
    ) -> List[DetectedPattern]:
        """
        Analyze transactions to find recurring patterns.

        Core algorithm:
        1. Group transactions by description fingerprint (rough grouping)
        2. Within each group, check if transactions have similar descriptions
        3. For similar transactions, check if they occur at consistent intervals
        4. If intervals are consistent, create a pattern suggestion
        """
        if not ENABLE_SUBSCRIPTION_SUGGESTIONS:
            return []

        logger.info(
            f"[SUBSCRIPTION_DETECTOR] Starting pattern detection for user {self.user_id}"
        )

        # Build query for unlinked expense transactions
        lookback_date = datetime.utcnow() - timedelta(days=lookback_days)

        query = self.db.query(Transaction).filter(
            Transaction.user_id == self.user_id,
            Transaction.recurring_transaction_id.is_(None),
            Transaction.amount < 0,  # Only expenses
            Transaction.booked_at >= lookback_date
        )

        # If specific transaction IDs provided, also include related transactions
        if transaction_ids:
            source_txns = self.db.query(Transaction).filter(
                Transaction.id.in_(transaction_ids),
                Transaction.user_id == self.user_id
            ).all()

            if not source_txns:
                return []

            # Get fingerprints for source transactions
            source_fingerprints = {
                self._get_description_fingerprint(txn) for txn in source_txns
            }

            # Get all transactions
            all_transactions = query.order_by(Transaction.booked_at.asc()).all()

            # Filter to those with matching fingerprints OR high similarity to source
            transactions = []
            for txn in all_transactions:
                fp = self._get_description_fingerprint(txn)
                if fp in source_fingerprints:
                    transactions.append(txn)
                else:
                    # Check similarity to any source transaction
                    for src in source_txns:
                        if self._calculate_description_similarity(src, txn) >= TEXT_SIMILARITY_THRESHOLD:
                            transactions.append(txn)
                            break
        else:
            transactions = query.order_by(Transaction.booked_at.asc()).all()

        if not transactions:
            logger.info("[SUBSCRIPTION_DETECTOR] No unlinked expense transactions found")
            return []

        logger.info(
            f"[SUBSCRIPTION_DETECTOR] Analyzing {len(transactions)} transactions"
        )

        # Group transactions by fingerprint for efficiency
        fingerprint_groups: Dict[str, List[Transaction]] = defaultdict(list)
        for txn in transactions:
            fp = self._get_description_fingerprint(txn)
            if fp:
                fingerprint_groups[fp].append(txn)

        logger.info(
            f"[SUBSCRIPTION_DETECTOR] Created {len(fingerprint_groups)} fingerprint groups"
        )

        # Analyze each group
        patterns: List[DetectedPattern] = []
        processed_ids: Set[str] = set()

        for fingerprint, group_txns in fingerprint_groups.items():
            if len(group_txns) < MIN_TRANSACTIONS:
                continue

            # Skip if all transactions already processed
            unprocessed = [t for t in group_txns if str(t.id) not in processed_ids]
            if len(unprocessed) < MIN_TRANSACTIONS:
                continue

            # For each unprocessed transaction, find its similar transactions
            for txn in unprocessed:
                if str(txn.id) in processed_ids:
                    continue

                # Find similar transactions (within this group and across groups)
                similar = self._find_similar_transactions(txn, transactions, processed_ids)

                if len(similar) < MIN_TRANSACTIONS:
                    continue

                # Analyze the similar transactions
                pattern = self._analyze_transaction_group(similar)

                if pattern:
                    patterns.append(pattern)
                    # Mark these transactions as processed
                    for t in similar:
                        processed_ids.add(str(t.id))

        logger.info(
            f"[SUBSCRIPTION_DETECTOR] Found {len(patterns)} potential patterns"
        )

        # Filter out patterns matching existing subscriptions
        patterns = [p for p in patterns if not self._matches_existing_subscription(p)]

        # Sort by confidence (descending), then by transaction count
        patterns.sort(key=lambda p: (p.confidence, p.match_count), reverse=True)

        # Limit to MAX_SUGGESTIONS
        patterns = patterns[:MAX_SUGGESTIONS]

        logger.info(
            f"[SUBSCRIPTION_DETECTOR] Final result: {len(patterns)} subscription patterns"
        )

        for p in patterns:
            logger.info(
                f"  - {p.suggested_name}: {p.detected_frequency}, "
                f"€{p.suggested_amount}, {p.match_count} txns, {p.confidence}% confidence"
            )

        return patterns

    def save_suggestions(
        self,
        patterns: List[DetectedPattern]
    ) -> List[SubscriptionSuggestion]:
        """Save detected patterns as suggestions in the database."""
        if not patterns:
            return []

        created = []

        for pattern in patterns:
            # Check for existing similar suggestion
            existing = self._check_similar_pending_suggestion(pattern)
            if existing:
                logger.debug(
                    f"[SUBSCRIPTION_DETECTOR] Skipping '{pattern.suggested_name}' "
                    f"- similar pending suggestion exists"
                )
                continue

            # Create new suggestion
            suggestion = SubscriptionSuggestion(
                user_id=self.user_id,
                suggested_name=pattern.suggested_name,
                suggested_merchant=pattern.suggested_merchant,
                suggested_amount=pattern.suggested_amount,
                currency=pattern.currency,
                detected_frequency=pattern.detected_frequency,
                confidence=pattern.confidence,
                matched_transaction_ids=json.dumps(pattern.matched_transaction_ids),
                status="pending"
            )

            self.db.add(suggestion)
            created.append(suggestion)

            logger.info(
                f"[SUBSCRIPTION_DETECTOR] Created suggestion: '{pattern.suggested_name}' "
                f"({pattern.detected_frequency}, {pattern.confidence}% confidence)"
            )

        if created:
            self.db.commit()
            for suggestion in created:
                self.db.refresh(suggestion)

        return created

    def detect_and_save(
        self,
        transaction_ids: Optional[List[str]] = None
    ) -> int:
        """Detect patterns and save suggestions in one call."""
        patterns = self.detect_patterns(transaction_ids)
        suggestions = self.save_suggestions(patterns)
        return len(suggestions)
