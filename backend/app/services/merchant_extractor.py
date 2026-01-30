"""
Service for extracting merchant names from transaction descriptions.

Used to populate the merchant field when it's empty but the description
contains identifiable merchant information.
"""
import re
from typing import Optional, List, Tuple
from dataclasses import dataclass


@dataclass
class MerchantExtractionResult:
    """Result of merchant extraction."""
    merchant: Optional[str]
    confidence: float  # 0-100
    method: str  # 'known_pattern', 'capitalized_sequence', 'none'


class MerchantExtractor:
    """
    Extract merchant names from transaction descriptions.

    Usage:
        extractor = MerchantExtractor()
        result = extractor.extract("SEPA INCASSO Netflix BV Amsterdam")
        print(result.merchant)  # "Netflix"
    """

    # Known merchant patterns (brand name -> canonical name)
    # These are common services that appear in various formats
    KNOWN_MERCHANTS = {
        # Streaming Services
        'netflix': 'Netflix',
        'spotify': 'Spotify',
        'disney': 'Disney+',
        'disneyplus': 'Disney+',
        'disney+': 'Disney+',
        'apple music': 'Apple Music',
        'apple tv': 'Apple TV+',
        'applemusic': 'Apple Music',
        'appletv': 'Apple TV+',
        'youtube': 'YouTube',
        'youtube premium': 'YouTube Premium',
        'hulu': 'Hulu',
        'prime video': 'Prime Video',
        'primevideo': 'Prime Video',
        'hbo': 'HBO',
        'hbo max': 'HBO Max',
        'paramount': 'Paramount+',

        # Cloud & Software
        'aws': 'AWS',
        'amazon web services': 'AWS',
        'google cloud': 'Google Cloud',
        'azure': 'Azure',
        'microsoft': 'Microsoft',
        'microsoft 365': 'Microsoft 365',
        'office 365': 'Microsoft 365',
        'github': 'GitHub',
        'gitlab': 'GitLab',
        'dropbox': 'Dropbox',
        'icloud': 'iCloud',
        'adobe': 'Adobe',
        'figma': 'Figma',
        'slack': 'Slack',
        'zoom': 'Zoom',
        'notion': 'Notion',
        'openai': 'OpenAI',
        'chatgpt': 'OpenAI',
        'anthropic': 'Anthropic',
        'vercel': 'Vercel',
        'heroku': 'Heroku',
        'digitalocean': 'DigitalOcean',

        # E-commerce
        'amazon': 'Amazon',
        'ebay': 'eBay',
        'etsy': 'Etsy',
        'aliexpress': 'AliExpress',
        'zalando': 'Zalando',
        'bol.com': 'Bol.com',
        'coolblue': 'Coolblue',
        'asos': 'ASOS',

        # Transport
        'uber': 'Uber',
        'lyft': 'Lyft',
        'bolt': 'Bolt',
        'lime': 'Lime',
        'bird': 'Bird',
        'swapfiets': 'Swapfiets',
        'ns.nl': 'NS',
        'ns ': 'NS',

        # Food & Delivery
        'deliveroo': 'Deliveroo',
        'uber eats': 'Uber Eats',
        'ubereats': 'Uber Eats',
        'just eat': 'Just Eat',
        'justeat': 'Just Eat',
        'thuisbezorgd': 'Thuisbezorgd',
        'doordash': 'DoorDash',
        'grubhub': 'Grubhub',
        'starbucks': 'Starbucks',
        'mcdonalds': "McDonald's",
        "mcdonald's": "McDonald's",

        # Utilities
        'vattenfall': 'Vattenfall',
        'essent': 'Essent',
        'eneco': 'Eneco',
        'greenchoice': 'Greenchoice',
        'ziggo': 'Ziggo',
        'kpn': 'KPN',
        't-mobile': 'T-Mobile',
        'vodafone': 'Vodafone',
        'lebara': 'Lebara',

        # Finance & Insurance
        'paypal': 'PayPal',
        'stripe': 'Stripe',
        'mollie': 'Mollie',
        'revolut': 'Revolut',
        'wise': 'Wise',
        'transferwise': 'Wise',
        'bunq': 'Bunq',
        'n26': 'N26',

        # Fitness & Health
        'basic-fit': 'Basic-Fit',
        'basicfit': 'Basic-Fit',
        'fitfor free': 'Fit For Free',
        'anytime fitness': 'Anytime Fitness',
        'sportcity': 'SportCity',

        # Business Services
        'moneybird': 'Moneybird',
        'exact': 'Exact',
        'xero': 'Xero',
        'quickbooks': 'QuickBooks',
        'freshbooks': 'FreshBooks',
        'mailchimp': 'Mailchimp',
        'intercom': 'Intercom',
        'sendgrid': 'SendGrid',
        'twilio': 'Twilio',
        'stripe': 'Stripe',
    }

    # Noise words to strip from descriptions
    NOISE_PATTERNS = [
        r'\bsepa\b',
        r'\bincasso\b',
        r'\bmachtiging\b',
        r'\bfactnr\b',
        r'\bbtw\b',
        r'\btermijn\b',
        r'\bklantnr\b',
        r'\bcrn\b',
        r'\bnaam\b',
        r'\bomschrijving\b',
        r'\bincassant\b',
        r'\breference\b',
        r'\bref\b',
        r'\bnr\b',
        r'\bnumber\b',
        r'\bpayment\b',
        r'\btransfer\b',
        r'\bid\b',
        r'\bbv\b',  # Dutch company suffix
        r'\bnv\b',  # Dutch company suffix
        r'\bltd\b',
        r'\binc\b',
        r'\bgmbh\b',
        r'\bllc\b',
        r'\bco\b',
        r'\bcorp\b',
    ]

    # Date patterns to strip
    DATE_PATTERNS = [
        r'\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b',  # DD/MM/YYYY or similar
        r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b',    # YYYY/MM/DD
        r'\b\d{6,8}\b',                          # Reference numbers
        r'\b[A-Z]{2,3}\d{10,}\b',                # IBAN-like patterns
    ]

    def __init__(self):
        # Compile regex patterns for performance
        self._noise_pattern = re.compile(
            '|'.join(self.NOISE_PATTERNS),
            re.IGNORECASE
        )
        self._date_pattern = re.compile(
            '|'.join(self.DATE_PATTERNS)
        )

    def _clean_description(self, description: str) -> str:
        """
        Remove noise from description to isolate merchant name.

        Args:
            description: Raw transaction description

        Returns:
            Cleaned description string
        """
        if not description:
            return ""

        # Remove date patterns
        cleaned = self._date_pattern.sub(' ', description)

        # Remove noise patterns
        cleaned = self._noise_pattern.sub(' ', cleaned)

        # Remove extra whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        return cleaned

    def _find_known_merchant(self, text: str) -> Optional[str]:
        """
        Check if text contains a known merchant name.

        Args:
            text: Text to search

        Returns:
            Canonical merchant name if found, None otherwise
        """
        text_lower = text.lower()

        for pattern, canonical_name in self.KNOWN_MERCHANTS.items():
            # Check for word boundary matches to avoid false positives
            # e.g., "amazon" should not match in "damazon"
            if re.search(rf'\b{re.escape(pattern)}\b', text_lower):
                return canonical_name

        return None

    def _extract_capitalized_sequence(self, text: str) -> Optional[str]:
        """
        Extract the first capitalized word sequence as potential merchant.

        Args:
            text: Cleaned description text

        Returns:
            Capitalized sequence if found, None otherwise
        """
        if not text:
            return None

        # Find sequences of capitalized words (2+ chars each)
        # This handles "NETFLIX BV" -> "Netflix"
        matches = re.findall(r'\b[A-Z][A-Za-z]{2,}\b', text)

        if matches:
            # Return the first meaningful match
            for match in matches:
                # Skip common noise that slipped through
                if match.lower() not in {
                    'sepa', 'incasso', 'payment', 'transfer', 'reference',
                    'naar', 'van', 'voor', 'met', 'the', 'for', 'from', 'to'
                }:
                    return match

        # Try finding ALL CAPS sequences
        caps_matches = re.findall(r'\b[A-Z]{3,}\b', text)
        for match in caps_matches:
            if match.lower() not in {
                'sepa', 'iban', 'bic', 'btw', 'kvk', 'crn', 'ref'
            }:
                return match.capitalize()

        return None

    def extract(
        self,
        description: Optional[str],
        existing_merchant: Optional[str] = None
    ) -> MerchantExtractionResult:
        """
        Extract merchant name from transaction description.

        Priority:
        1. If existing_merchant is provided and non-empty, return it
        2. Look for known merchant patterns
        3. Extract first capitalized word sequence

        Args:
            description: Transaction description
            existing_merchant: Existing merchant field (will be returned if non-empty)

        Returns:
            MerchantExtractionResult with extracted merchant, confidence, and method
        """
        # If merchant already exists, return it
        if existing_merchant and existing_merchant.strip():
            return MerchantExtractionResult(
                merchant=existing_merchant.strip(),
                confidence=100.0,
                method='existing'
            )

        if not description:
            return MerchantExtractionResult(
                merchant=None,
                confidence=0.0,
                method='none'
            )

        # 1. Check for known merchant patterns
        known_merchant = self._find_known_merchant(description)
        if known_merchant:
            return MerchantExtractionResult(
                merchant=known_merchant,
                confidence=95.0,
                method='known_pattern'
            )

        # 2. Clean description and extract capitalized sequence
        cleaned = self._clean_description(description)
        capitalized = self._extract_capitalized_sequence(cleaned)

        if capitalized:
            # Lower confidence for extracted names (not verified)
            return MerchantExtractionResult(
                merchant=capitalized,
                confidence=60.0,
                method='capitalized_sequence'
            )

        # 3. Fallback: use first word if it's meaningful
        words = cleaned.split()
        if words and len(words[0]) >= 3:
            first_word = words[0].capitalize()
            if first_word.lower() not in {
                'the', 'a', 'an', 'to', 'from', 'for', 'at', 'in', 'on', 'by'
            }:
                return MerchantExtractionResult(
                    merchant=first_word,
                    confidence=30.0,
                    method='first_word'
                )

        return MerchantExtractionResult(
            merchant=None,
            confidence=0.0,
            method='none'
        )


def extract_merchant(
    description: Optional[str],
    existing_merchant: Optional[str] = None
) -> Optional[str]:
    """
    Convenience function to extract merchant from description.

    Args:
        description: Transaction description
        existing_merchant: Existing merchant field

    Returns:
        Extracted merchant name or None
    """
    extractor = MerchantExtractor()
    result = extractor.extract(description, existing_merchant)
    return result.merchant
