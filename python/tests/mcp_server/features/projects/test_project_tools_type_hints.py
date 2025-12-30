# ABOUTME: Schema tests for project MCP tool type hints.
# ABOUTME: Ensures Literal and Annotated Field constraints are preserved.
"""
Tests for MCP tool type hints and constraints in project tools.

Tests verify that tool parameter type hints use Literal/Annotated with Field
for enums and numeric ranges, enabling constraint enforcement and regression detection.
"""

from typing import Annotated, Literal, get_args, get_origin

import pytest
from pydantic.fields import FieldInfo

from src.mcp_server.features.projects.project_tools import register_project_tools


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
def project_tools(mock_mcp):
    """Get registered project tools for testing."""
    register_project_tools(mock_mcp)
    return mock_mcp._tools


def test_find_projects_per_page_annotated(project_tools):
    """Test that find_projects per_page parameter uses Annotated with Field ge=1."""
    tool = project_tools.get("find_projects")
    assert tool is not None, "find_projects tool not registered"

    hints = get_type_hints_with_extras(tool)
    per_page_hint = hints.get("per_page")

    assert per_page_hint is not None, "per_page parameter missing type hint"
    assert get_origin(per_page_hint) is Annotated, "per_page should use Annotated"

    args = get_args(per_page_hint)
    base_type = args[0]
    metadata = extract_field_info(per_page_hint)

    assert base_type is int, "per_page base type should be int"
    assert metadata.ge == 1, "per_page should enforce ge=1"



def test_find_projects_page_annotated(project_tools):
    """Test that find_projects page parameter uses Annotated with Field ge=1."""
    tool = project_tools.get("find_projects")
    assert tool is not None, "find_projects tool not registered"

    hints = get_type_hints_with_extras(tool)
    page_hint = hints.get("page")

    assert page_hint is not None, "page parameter missing type hint"
    assert get_origin(page_hint) is Annotated, "page should use Annotated"

    args = get_args(page_hint)
    base_type = args[0]
    metadata = extract_field_info(page_hint)

    assert base_type is int, "page base type should be int"
    assert metadata.ge == 1, "page should enforce ge=1"



def test_manage_project_action_literal(project_tools):
    """Test that manage_project action parameter uses Literal["create", "update", "delete"]."""
    tool = project_tools.get("manage_project")
    assert tool is not None, "manage_project tool not registered"

    hints = get_type_hints_with_extras(tool)
    action_hint = hints.get("action")

    assert action_hint is not None, "action parameter missing type hint"

    literal_values = extract_literal_values(action_hint)
    assert literal_values == {"create", "update", "delete"}


def get_type_hints_with_extras(func):
    """Helper to get type hints with extras (for Annotated types)."""
    import typing
    return typing.get_type_hints(func, include_extras=True)


def extract_field_info(hint):
    """Helper to extract FieldInfo from an Annotated hint."""
    args = get_args(hint)
    metadata = args[1]
    assert isinstance(metadata, FieldInfo), "Annotated metadata should be FieldInfo"
    return metadata


def extract_literal_values(hint):
    """Helper to extract Literal values from Annotated or Union types."""
    base = hint
    if get_origin(base) is Annotated:
        base = get_args(base)[0]
    if get_origin(base) is Literal:
        return set(get_args(base))
    for arg in get_args(base):
        if get_origin(arg) is Literal:
            return set(get_args(arg))
    return set()
