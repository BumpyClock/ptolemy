# ABOUTME: Schema tests for docs MCP tool type hints.
# ABOUTME: Ensures Literal and Annotated Field constraints are preserved.
"""
Tests for MCP tool type hints and constraints in docs tools.

Tests verify that tool parameter type hints use Literal/Annotated with Field
for enums and numeric ranges, enabling constraint enforcement and regression detection.
"""

from typing import Annotated, get_args, get_origin

import pytest
from pydantic.fields import FieldInfo

from src.mcp_server.features.docs.docs_tools import register_docs_tools


@pytest.fixture
def mock_mcp():
    """Create a mock MCP server for testing."""
    from unittest.mock import MagicMock

    mock = MagicMock()
    mock._tools = {}

    def tool_decorator():
        def decorator(func):
            mock._tools[func.__name__] = func
            return func

        return decorator

    mock.tool = tool_decorator
    return mock


@pytest.fixture
def docs_tools(mock_mcp):
    """Get registered docs tools for testing."""
    register_docs_tools(mock_mcp)
    return mock_mcp._tools


def test_docs_answer_return_mode_literal(docs_tools):
    """Test that docs_answer return_mode parameter uses Literal["pages", "chunks"]."""
    tool = docs_tools.get("docs_answer")
    assert tool is not None, "docs_answer tool not registered"

    hints = get_type_hints_with_extras(tool)
    return_mode_hint = hints.get("return_mode")

    assert return_mode_hint is not None, "return_mode parameter missing type hint"
    assert get_origin(return_mode_hint) is Annotated, "return_mode should use Annotated"

    args = get_args(return_mode_hint)
    base_type = args[0]

    from typing import Literal, get_args as get_literal_args

    assert get_origin(base_type) is Literal or (
        hasattr(base_type, "__origin__") and base_type.__origin__ is Literal
    ), "return_mode base type should be Literal"

    literal_args = get_literal_args(base_type)
    assert set(literal_args) == {"pages", "chunks"}, (
        f"Literal args should be {{'pages', 'chunks'}}, got {set(literal_args)}"
    )


def test_docs_answer_match_count_annotated(docs_tools):
    """Test that docs_answer match_count parameter uses Annotated with Field."""
    tool = docs_tools.get("docs_answer")
    assert tool is not None, "docs_answer tool not registered"

    hints = get_type_hints_with_extras(tool)
    match_count_hint = hints.get("match_count")

    assert match_count_hint is not None, "match_count parameter missing type hint"
    assert get_origin(match_count_hint) is Annotated, "match_count should use Annotated"

    args = get_args(match_count_hint)
    base_type = args[0]
    metadata = args[1]

    assert base_type is int, "match_count base type should be int"
    assert isinstance(metadata, FieldInfo), "match_count metadata should be pydantic FieldInfo"
    assert metadata.ge == 1, "match_count should enforce ge=1"
    assert metadata.le == 20, "match_count should enforce le=20"


def test_docs_fetch_kind_literal(docs_tools):
    """Test that docs_fetch kind parameter uses Literal with expected values."""
    tool = docs_tools.get("docs_fetch")
    assert tool is not None, "docs_fetch tool not registered"

    hints = get_type_hints_with_extras(tool)
    kind_hint = hints.get("kind")

    assert kind_hint is not None, "kind parameter missing type hint"
    assert get_origin(kind_hint) is Annotated, "kind should use Annotated"

    args = get_args(kind_hint)
    base_type = args[0]

    from typing import Literal, get_args as get_literal_args

    assert get_origin(base_type) is Literal or (
        hasattr(base_type, "__origin__") and base_type.__origin__ is Literal
    ), "kind base type should be Literal"

    literal_args = set(get_literal_args(base_type))
    expected = {"sources", "pages", "page", "code_examples", "chunks"}
    assert literal_args == expected, f"Literal args should be {expected}, got {literal_args}"


def get_type_hints_with_extras(func):
    """Helper to get type hints with extras (for Annotated types)."""
    import typing

    return typing.get_type_hints(func, include_extras=True)
