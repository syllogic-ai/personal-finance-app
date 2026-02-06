"""
Test categorizer API endpoint.
"""
import sys
import os
import requests
import json
from decimal import Decimal

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000/api"


def test_categorizer_single():
    """Test single transaction categorization."""
    print("Testing Categorizer API (single transaction)...")
    
    url = f"{BASE_URL}/categories/categorize"
    
    payload = {
        "description": "TESCO SUPERMARKET",
        "merchant": "Tesco",
        "amount": -25.50,
        "transaction_type": "debit",
        "use_llm": False  # Use deterministic matching for faster tests
    }
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        result = response.json()
        # Should return a category (or None if no match)
        assert "category_id" in result or result.get("category_id") is None
        assert "method" in result
        print(f"✓ Single categorization test passed (method: {result.get('method')})")
        return True
    else:
        print(f"✗ Single categorization test failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False


def test_categorizer_batch():
    """Test batch transaction categorization."""
    print("Testing Categorizer API (batch)...")
    
    url = f"{BASE_URL}/categories/categorize/batch"
    
    payload = {
        "transactions": [
            {
                "description": "TESCO SUPERMARKET",
                "merchant": "Tesco",
                "amount": -25.50,
                "transaction_type": "debit"
            },
            {
                "description": "UBER RIDE",
                "merchant": "Uber",
                "amount": -15.00,
                "transaction_type": "debit"
            },
            {
                "description": "SALARY PAYMENT",
                "merchant": "Employer",
                "amount": 100.00,
                "transaction_type": "credit"
            }
        ],
        "use_llm": False  # Use deterministic matching for faster tests
    }
    
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        result = response.json()
        assert "results" in result
        assert len(result["results"]) == 3, "Should return 3 results"
        assert result.get("total_transactions") == 3
        print(f"✓ Batch categorization test passed ({result.get('categorized_count', 0)} categorized)")
        return True
    else:
        print(f"✗ Batch categorization test failed: {response.status_code}")
        print(f"  Response: {response.text}")
        return False


if __name__ == "__main__":
    try:
        success1 = test_categorizer_single()
        success2 = test_categorizer_batch()
        sys.exit(0 if (success1 and success2) else 1)
    except Exception as e:
        print(f"✗ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
