"""
Service for automatically categorizing transactions based on description/merchant.
Uses deterministic keyword matching first, then falls back to LLM if needed.
"""
import os
import re
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models import Category, Transaction


class CategoryMatcher:
    """Matches transactions to categories using deterministic rules and LLM fallback."""
    
    def __init__(self, db: Session):
        self.db = db
        self._category_cache: Optional[Dict[str, Category]] = None
        self._keyword_rules: Optional[Dict[str, List[str]]] = None
    
    def _load_categories(self) -> Dict[str, Category]:
        """Load all categories into a cache."""
        if self._category_cache is None:
            categories = self.db.query(Category).all()
            if not categories:
                # Return empty dict if no categories exist
                self._category_cache = {}
            else:
                self._category_cache = {cat.name.lower(): cat for cat in categories}
        return self._category_cache
    
    def _get_keyword_rules(self) -> Dict[str, List[str]]:
        """Get keyword matching rules for each category."""
        if self._keyword_rules is None:
            self._keyword_rules = {
                # Expenses
                "groceries": [
                    "supermarket", "grocery", "tesco", "sainsbury", "asda", "waitrose",
                    "aldi", "lidl", "co-op", "coop", "morrisons", "food", "market",
                    "spar", "iceland", "m&s food", "marks & spencer food"
                ],
                "transport": [
                    "uber", "lyft", "taxi", "bus", "train", "tube", "metro", "subway",
                    "transport for london", "tfl", "london underground", "national rail",
                    "railway", "station", "parking", "petrol", "gas station", "fuel",
                    "shell", "bp", "esso", "exxon", "chevron", "car rental", "hertz",
                    "avis", "europcar", "zipcar", "lime", "bird", "bolt"
                ],
                "utilities": [
                    "electric", "gas", "water", "utility", "energy", "power", "heating",
                    "internet", "broadband", "wifi", "phone", "mobile", "telecom",
                    "bt", "sky", "virgin", "ee", "vodafone", "o2", "three", "giffgaff"
                ],
                "entertainment": [
                    "netflix", "spotify", "disney", "hulu", "prime video", "cinema",
                    "movie", "theater", "theatre", "concert", "ticket", "event",
                    "cinobo", "youtube premium", "twitch", "gaming", "playstation",
                    "xbox", "nintendo", "steam"
                ],
                "dining out": [
                    "restaurant", "cafe", "coffee", "starbucks", "costa", "nero",
                    "pret", "mcdonald", "kfc", "burger king", "pizza", "pub", "bar",
                    "wetherspoon", "simmons", "pregio", "deliveroo", "ubereats",
                    "just eat", "doordash", "grubhub", "takeaway", "take away"
                ],
                "shopping": [
                    "amazon", "ebay", "etsy", "asos", "zara", "h&m", "primark",
                    "next", "m&s", "john lewis", "debenhams", "argos", "currys",
                    "pc world", "apple store", "nike", "adidas", "retail", "store"
                ],
                "healthcare": [
                    "pharmacy", "pharmacist", "chemist", "boots", "superdrug",
                    "doctor", "dentist", "hospital", "clinic", "medical", "health",
                    "gym", "fitness", "puregym", "virgin active", "nuffield"
                ],
                "subscriptions": [
                    "subscription", "membership", "recurring", "monthly", "annual",
                    "aws", "amazon web services", "openai", "anthropic", "github",
                    "adobe", "microsoft", "office 365", "dropbox", "icloud",
                    "hiwell", "software", "saas"
                ],
                "education": [
                    "university", "college", "school", "tuition", "course", "training",
                    "education", "book", "textbook", "library"
                ],
                "housing": [
                    "rent", "mortgage", "landlord", "property", "real estate",
                    "housing", "accommodation", "hotel", "airbnb", "booking.com"
                ],
                # Income
                "salary": [
                    "salary", "payroll", "wages", "income", "employment"
                ],
                "freelance": [
                    "freelance", "contractor", "consulting", "invoice", "payment received"
                ],
                "investment income": [
                    "dividend", "interest", "investment", "return", "capital gain"
                ],
                # Transfer
                "transfer": [
                    "transfer", "payment from", "payment to", "sent to", "received from"
                ],
            }
        return self._keyword_rules
    
    def match_category_deterministic(
        self,
        description: Optional[str],
        merchant: Optional[str],
        amount: Decimal,
        transaction_type: Optional[str] = None
    ) -> Optional[Category]:
        """
        Try to match category using deterministic keyword rules.
        
        Args:
            description: Transaction description
            merchant: Merchant name
            amount: Transaction amount (positive for income, negative for expense)
            transaction_type: Transaction type (debit/credit)
            
        Returns:
            Matched Category or None if no match found
        """
        if not description and not merchant:
            return None
        
        # Combine description and merchant for matching
        search_text = " ".join(filter(None, [description or "", merchant or ""])).lower()
        
        # Determine transaction type from amount if not provided
        is_income = amount > 0
        is_transfer = "transfer" in search_text
        
        # Load categories and rules
        categories = self._load_categories()
        rules = self._get_keyword_rules()
        
        # Check for transfer first (highest priority)
        if is_transfer:
            transfer_cat = categories.get("transfer")
            if transfer_cat:
                return transfer_cat
        
        # Match against keyword rules
        best_match = None
        best_score = 0
        
        for category_name, keywords in rules.items():
            category = categories.get(category_name)
            if not category:
                continue
            
            # Skip if category type doesn't match transaction type
            if is_income and category.category_type != "income":
                continue
            if not is_income and not is_transfer and category.category_type == "income":
                continue
            
            # Calculate match score (number of keyword matches)
            score = sum(1 for keyword in keywords if keyword in search_text)
            
            if score > best_score:
                best_score = score
                best_match = category
        
        # Only return if we have a confident match (at least 1 keyword)
        if best_score > 0:
            return best_match
        
        return None
    
    def match_category_llm(
        self,
        description: Optional[str],
        merchant: Optional[str],
        amount: Decimal,
        available_categories: List[Category]
    ) -> Optional[Category]:
        """
        Use LLM to suggest a category when deterministic matching fails.
        
        Args:
            description: Transaction description
            merchant: Merchant name
            amount: Transaction amount
            available_categories: List of available categories to choose from
            
        Returns:
            Suggested Category or None if LLM call fails
        """
        try:
            from openai import OpenAI
            
            # Check if API key is configured
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                print("DEBUG: OPENAI_API_KEY not set, skipping LLM categorization")
                return None
            
            client = OpenAI(api_key=api_key)
            
            # Determine transaction type
            is_income = amount > 0
            transaction_type_str = "income" if is_income else "expense"
            
            # Filter categories by type
            relevant_categories = [
                cat for cat in available_categories
                if cat.category_type == transaction_type_str or cat.category_type == "transfer"
            ]
            
            if not relevant_categories:
                return None
            
            # Build category list for prompt
            category_list = "\n".join([f"- {cat.name}" for cat in relevant_categories])
            
            # Build prompt
            prompt = f"""You are a financial transaction categorizer. Given a transaction, select the most appropriate category from the list below.

Transaction details:
- Description: {description or 'N/A'}
- Merchant: {merchant or 'N/A'}
- Amount: {amount}
- Type: {transaction_type_str}

Available categories:
{category_list}

Respond with ONLY the exact category name from the list above, nothing else. If none of the categories fit well, respond with "UNKNOWN"."""
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",  # Using cheaper model for cost efficiency
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that categorizes financial transactions. Always respond with only the category name."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,  # Low temperature for deterministic results
                max_tokens=50
            )
            
            suggested_name = response.choices[0].message.content.strip()
            
            # Find matching category
            for cat in relevant_categories:
                if cat.name.lower() == suggested_name.lower():
                    return cat
            
            print(f"DEBUG: LLM suggested '{suggested_name}' but it doesn't match any category")
            return None
            
        except ImportError:
            print("DEBUG: OpenAI library not installed, skipping LLM categorization")
            return None
        except Exception as e:
            print(f"DEBUG: LLM categorization failed: {str(e)}")
            return None
    
    def match_category(
        self,
        description: Optional[str],
        merchant: Optional[str],
        amount: Decimal,
        transaction_type: Optional[str] = None,
        use_llm: bool = True
    ) -> Optional[Category]:
        """
        Match a transaction to a category.
        Tries deterministic matching first, then LLM if enabled.
        
        Args:
            description: Transaction description
            merchant: Merchant name
            amount: Transaction amount
            transaction_type: Transaction type (debit/credit)
            use_llm: Whether to use LLM fallback if deterministic matching fails
            
        Returns:
            Matched Category or None
        """
        # Try deterministic matching first
        category = self.match_category_deterministic(
            description=description,
            merchant=merchant,
            amount=amount,
            transaction_type=transaction_type
        )
        
        if category:
            return category
        
        # Fall back to LLM if enabled
        if use_llm:
            categories = list(self._load_categories().values())
            category = self.match_category_llm(
                description=description,
                merchant=merchant,
                amount=amount,
                available_categories=categories
            )
            if category:
                return category
        
        return None

