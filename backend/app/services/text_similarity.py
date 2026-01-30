"""
Unified text similarity service for subscription and transaction matching.

Provides a standardized algorithm for comparing text strings, used by:
- Subscription matching (auto-linking transactions to subscriptions)
- Manual subscription matching (Match Transactions button)

Scoring Algorithm:
- Exact match → 100%
- Substring match → 85%
- Token overlap (≥50%) → 70-90%
- Levenshtein fallback → 0-70%
"""
import re
from typing import Optional, List, Tuple
from difflib import SequenceMatcher
from dataclasses import dataclass


@dataclass
class SimilarityResult:
    """Result of a similarity calculation."""
    score: float  # 0-100
    method: str  # 'exact', 'substring', 'token_overlap', 'levenshtein'
    matched_tokens: Optional[List[str]] = None


class TextSimilarity:
    """
    Unified text similarity service.

    Usage:
        similarity = TextSimilarity()
        result = similarity.calculate("Netflix", "NETFLIX SUBSCRIPTION")
        print(result.score)  # 85.0 (substring match)
    """

    # Common noise words to filter out during token matching
    NOISE_WORDS = {
        # Transaction prefixes
        'payment', 'transfer', 'sepa', 'incasso', 'machtiging', 'factnr',
        'btw', 'termijn', 'klantnr', 'crn', 'naam', 'omschrijving', 'incassant',
        'reference', 'ref', 'nr', 'number',
        # Common stop words
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'bill', 'transaction',
        # Date/time fragments
        'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct',
        'nov', 'dec', 'january', 'february', 'march', 'april', 'june', 'july',
        'august', 'september', 'october', 'november', 'december',
    }

    def __init__(self):
        pass

    @staticmethod
    def normalize(text: Optional[str]) -> str:
        """
        Normalize text for comparison.
        - Converts to lowercase
        - Removes extra whitespace
        - Removes special characters except spaces and hyphens
        """
        if not text:
            return ""

        # Convert to lowercase
        text = text.lower().strip()

        # Remove special characters except spaces, hyphens, and alphanumerics
        text = re.sub(r'[^a-z0-9\s\-]', ' ', text)

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        return text

    @staticmethod
    def extract_tokens(text: str, min_length: int = 3) -> List[str]:
        """
        Extract meaningful tokens from text, filtering out noise words.

        Args:
            text: Normalized text string
            min_length: Minimum token length to include

        Returns:
            List of tokens
        """
        if not text:
            return []

        # Split by whitespace and hyphens
        words = re.findall(r'\b\w+\b', text.lower())

        # Filter by length and noise words
        tokens = [
            w for w in words
            if len(w) >= min_length and w not in TextSimilarity.NOISE_WORDS
        ]

        return tokens

    @staticmethod
    def levenshtein_ratio(s1: str, s2: str) -> float:
        """
        Calculate similarity ratio using Levenshtein distance.

        Returns:
            Ratio between 0.0 and 1.0 (1.0 = identical)
        """
        if not s1 or not s2:
            return 0.0
        return SequenceMatcher(None, s1.lower(), s2.lower()).ratio()

    def calculate(
        self,
        text1: Optional[str],
        text2: Optional[str],
        require_amount_match: bool = False
    ) -> SimilarityResult:
        """
        Calculate similarity between two text strings.

        Scoring Algorithm (in order of priority):
        1. Exact match (case-insensitive) → 100%
        2. Substring match (one contains the other) → 85%
        3. Token overlap ≥50% → 70-90% (scaled by overlap ratio)
        4. Levenshtein fallback → 0-70% (scaled)

        Args:
            text1: First text string (e.g., subscription name)
            text2: Second text string (e.g., transaction description)
            require_amount_match: If True, return 0 if texts are very different

        Returns:
            SimilarityResult with score (0-100), method, and matched tokens
        """
        # Handle empty inputs
        if not text1 or not text2:
            return SimilarityResult(score=0.0, method='none')

        # Normalize texts
        norm1 = self.normalize(text1)
        norm2 = self.normalize(text2)

        if not norm1 or not norm2:
            return SimilarityResult(score=0.0, method='none')

        # 1. Exact match
        if norm1 == norm2:
            return SimilarityResult(score=100.0, method='exact')

        # 2. Substring match
        # Check if one is contained in the other (minimum 3 chars)
        if len(norm1) >= 3 and len(norm2) >= 3:
            if norm1 in norm2 or norm2 in norm1:
                return SimilarityResult(score=85.0, method='substring')

        # 3. Token overlap
        tokens1 = self.extract_tokens(norm1)
        tokens2 = self.extract_tokens(norm2)

        if tokens1 and tokens2:
            # Find overlapping tokens
            set1 = set(tokens1)
            set2 = set(tokens2)
            overlap = set1 & set2

            if overlap:
                # Calculate overlap ratio (percentage of smaller set that matches)
                min_tokens = min(len(set1), len(set2))
                overlap_ratio = len(overlap) / min_tokens

                if overlap_ratio >= 0.5:  # At least 50% token overlap
                    # Scale score from 70-90 based on overlap ratio
                    score = 70.0 + (overlap_ratio * 20.0)
                    return SimilarityResult(
                        score=min(score, 90.0),
                        method='token_overlap',
                        matched_tokens=list(overlap)
                    )

        # 4. Levenshtein fallback
        ratio = self.levenshtein_ratio(norm1, norm2)

        # Scale Levenshtein ratio to 0-70%
        score = ratio * 70.0

        # If require_amount_match is True, apply stricter threshold
        if require_amount_match and score < 40.0:
            return SimilarityResult(score=0.0, method='levenshtein')

        return SimilarityResult(score=score, method='levenshtein')

    def calculate_match_score(
        self,
        subscription_name: Optional[str],
        subscription_merchant: Optional[str],
        transaction_description: Optional[str],
        transaction_merchant: Optional[str]
    ) -> Tuple[float, str]:
        """
        Calculate the best match score between subscription and transaction fields.

        Tests all combinations:
        - subscription_name vs transaction_merchant
        - subscription_name vs transaction_description
        - subscription_merchant vs transaction_merchant
        - subscription_merchant vs transaction_description

        Args:
            subscription_name: Subscription name
            subscription_merchant: Subscription merchant (optional)
            transaction_description: Transaction description
            transaction_merchant: Transaction merchant (optional)

        Returns:
            Tuple of (best_score, match_method)
        """
        best_score = 0.0
        best_method = 'none'

        combinations = [
            (subscription_name, transaction_merchant, 'name_to_merchant'),
            (subscription_name, transaction_description, 'name_to_description'),
            (subscription_merchant, transaction_merchant, 'merchant_to_merchant'),
            (subscription_merchant, transaction_description, 'merchant_to_description'),
        ]

        for text1, text2, combo_name in combinations:
            if text1 and text2:
                result = self.calculate(text1, text2)
                if result.score > best_score:
                    best_score = result.score
                    best_method = f"{combo_name}:{result.method}"

        return best_score, best_method


def calculate_text_similarity(text1: Optional[str], text2: Optional[str]) -> float:
    """
    Convenience function for simple similarity calculation.

    Args:
        text1: First text string
        text2: Second text string

    Returns:
        Similarity score (0-100)
    """
    similarity = TextSimilarity()
    result = similarity.calculate(text1, text2)
    return result.score
