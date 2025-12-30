# ABOUTME: Tests for disabled MCP tools in mcp_server.py
# ABOUTME: Verifies health_check and session_info are not exposed as MCP tools.
"""
Tests for disabled MCP tools in mcp_server.py.

These tests use AST parsing to verify that health_check and session_info
functions do not have @mcp.tool() decorators, ensuring they are not exposed
as MCP tools while keeping the functions available for potential future use.
"""

import ast
from pathlib import Path


def get_mcp_server_file_path():
    """Get the path to mcp_server.py."""
    project_root = Path(__file__).resolve().parent.parent.parent
    return project_root / "src" / "mcp_server" / "mcp_server.py"


def parse_functions_with_decorators(source_file_path):
    """
    Parse Python file and extract function definitions with their decorators.

    Returns:
        dict: Mapping of function names to list of decorator names
    """
    with open(source_file_path, "r", encoding="utf-8") as f:
        source_code = f.read()

    tree = ast.parse(source_code)

    functions_with_decorators = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) or isinstance(node, ast.FunctionDef):
            decorator_names = []
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Name):
                    decorator_names.append(decorator.id)
                elif isinstance(decorator, ast.Call):
                    if isinstance(decorator.func, ast.Attribute):
                        if hasattr(decorator.func.value, "id"):
                            decorator_names.append(f"{decorator.func.value.id}.{decorator.func.attr}")
                    elif isinstance(decorator.func, ast.Name):
                        decorator_names.append(decorator.func.id)

            functions_with_decorators[node.name] = decorator_names

    return functions_with_decorators


def test_health_check_not_decorated_as_mcp_tool():
    """
    Test that health_check function does not have @mcp.tool() decorator.

    This ensures the health_check function exists but is not exposed
    as an MCP tool.
    """
    mcp_server_path = get_mcp_server_file_path()
    functions = parse_functions_with_decorators(mcp_server_path)

    assert "health_check" in functions, "health_check function should exist"

    decorators = functions["health_check"]

    has_mcp_tool_decorator = any(
        "tool" in decorator
        for decorator in decorators
    )

    assert not has_mcp_tool_decorator, (
        "health_check should not have @mcp.tool() decorator. "
        f"Found decorators: {decorators}"
    )


def test_session_info_not_decorated_as_mcp_tool():
    """
    Test that session_info function does not have @mcp.tool() decorator.

    This ensures the session_info function exists but is not exposed
    as an MCP tool.
    """
    mcp_server_path = get_mcp_server_file_path()
    functions = parse_functions_with_decorators(mcp_server_path)

    assert "session_info" in functions, "session_info function should exist"

    decorators = functions["session_info"]

    has_mcp_tool_decorator = any(
        "tool" in decorator
        for decorator in decorators
    )

    assert not has_mcp_tool_decorator, (
        "session_info should not have @mcp.tool() decorator. "
        f"Found decorators: {decorators}"
    )


def test_disabled_functions_still_exist():
    """
    Test that health_check and session_info functions still exist.

    This ensures the functions are preserved for potential future use
    with feature toggles.
    """
    mcp_server_path = get_mcp_server_file_path()
    functions = parse_functions_with_decorators(mcp_server_path)

    assert "health_check" in functions, (
        "health_check function should exist for potential future use"
    )
    assert "session_info" in functions, (
        "session_info function should exist for potential future use"
    )
