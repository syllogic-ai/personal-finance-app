"""Tests for SYL-32 / SYL-29 prompt enrichment."""
from unittest.mock import MagicMock

import pytest

from app.services.category_matcher import CategoryMatcher


class FakeCategory:
    def __init__(self, name, description=None, category_type="expense"):
        self.name = name
        self.description = description
        self.category_type = category_type


class FakeAccount:
    def __init__(self, name, external_id=None, alias_patterns=None):
        self.name = name
        self.external_id = external_id
        self.alias_patterns = alias_patterns or []


def test_render_category_list_with_descriptions():
    m = CategoryMatcher.__new__(CategoryMatcher)  # avoid __init__ for this unit test
    cats = [
        FakeCategory("Side Projects", "Tools used for side projects (Cloudflare, Framer)"),
        FakeCategory("Food & Dining", None),
    ]
    rendered = m._render_category_list(cats)
    assert "- Side Projects — Tools used for side projects (Cloudflare, Framer)" in rendered
    assert "- Food & Dining" in rendered
    assert "None" not in rendered


def test_render_category_list_truncates_long_description():
    m = CategoryMatcher.__new__(CategoryMatcher)
    long = "A" * 500
    rendered = m._render_category_list([FakeCategory("X", long)])
    assert len(rendered) < 300  # bound: name + " — " + 200 chars max
