# ABOUTME: Schema tests for RAG MCP tool type hints.
# ABOUTME: Ensures Literal and Annotated Field constraints are preserved.
"""
Tests for MCP tool type hints and constraints in RAG tools.

Tests verify that tool parameter type hints use Literal/Annotated with Field
for enums and numeric ranges, enabling constraint enforcement and regression detection.
"""

from typing import Annotated, get_args, get_origin

import pytest
from pydantic.fields import FieldInfo

from src.mcp_server.features.rag.rag_tools import register_rag_tools


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
def rag_tools(mock_mcp):
    """Get registered RAG tools for testing."""
    register_rag_tools(mock_mcp)
    return mock_mcp._tools


def test_rag_search_knowledge_base_return_mode_literal(rag_tools):
    """Test that rag_search_knowledge_base return_mode parameter uses Literal["pages", "chunks"]."""
    tool = rag_tools.get("rag_search_knowledge_base")
    assert tool is not None, "rag_search_knowledge_base tool not registered"

    hints = get_type_hints_with_extras(tool)
    return_mode_hint = hints.get("return_mode")

    assert return_mode_hint is not None, "return_mode parameter missing type hint"
    assert get_origin(return_mode_hint) is Annotated, "return_mode should use Annotated"

    args = get_args(return_mode_hint)
    base_type = args[0]
    metadata = args[1]

    from typing import Literal, get_args as get_literal_args

    assert get_origin(base_type) is Literal or (
        hasattr(base_type, "__origin__") and base_type.__origin__ is Literal
    ), "return_mode base type should be Literal"

    literal_args = get_literal_args(base_type)
    assert set(literal_args) == {"pages", "chunks"}, f"Literal args should be {{'pages', 'chunks'}}, got {set(literal_args)}"


def test_rag_search_knowledge_base_match_count_annotated(rag_tools):
    """Test that rag_search_knowledge_base match_count parameter uses Annotated with Field."""
    tool = rag_tools.get("rag_search_knowledge_base")
    assert tool is not None, "rag_search_knowledge_base tool not registered"

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


def test_rag_search_code_examples_match_count_annotated(rag_tools):
    """Test that rag_search_code_examples match_count parameter uses Annotated with Field."""
    tool = rag_tools.get("rag_search_code_examples")
    assert tool is not None, "rag_search_code_examples tool not registered"

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


def test_rag_read_full_page_params_optional(rag_tools):
    """Test that rag_read_full_page page_id and url are both optional (can be None)."""
    tool = rag_tools.get("rag_read_full_page")
    assert tool is not None, "rag_read_full_page tool not registered"

    hints = get_type_hints_with_extras(tool)

    page_id_hint = hints.get("page_id")
    url_hint = hints.get("url")

    assert page_id_hint is not None, "page_id parameter missing type hint"
    assert url_hint is not None, "url parameter missing type hint"

    assert (
        get_origin(page_id_hint) is Annotated or page_id_hint in (str | None, None | str)
    ), "page_id should be optional"
    assert (
        get_origin(url_hint) is Annotated or url_hint in (str | None, None | str)
    ), "url should be optional"


def get_type_hints_with_extras(func):
    """Helper to get type hints with extras (for Annotated types)."""
    import typing
    return typing.get_type_hints(func, include_extras=True)
