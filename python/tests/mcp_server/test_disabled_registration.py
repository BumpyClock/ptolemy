# ABOUTME: Tests for disabled MCP tool registration in mcp_server.py
# ABOUTME: Verifies register_project_tools, register_task_tools, and register_document_tools are not called.
"""
Tests for disabled MCP tool registration in mcp_server.py.

These tests use AST parsing to verify that project, task, and document
tool registration functions are not called in register_modules(), ensuring
these tools are hard-disabled while keeping the modules intact for potential
future use with feature toggles.
"""

import ast
from pathlib import Path


def get_mcp_server_file_path():
    """Get the path to mcp_server.py."""
    project_root = Path(__file__).resolve().parent.parent.parent
    return project_root / "src" / "mcp_server" / "mcp_server.py"


def find_function_calls(source_file_path, function_name):
    """
    Parse Python file and find calls to a specific function.

    Args:
        source_file_path: Path to Python source file
        function_name: Name of function to find calls to

    Returns:
        list: List of line numbers where the function is called
    """
    with open(source_file_path, "r", encoding="utf-8") as f:
        source_code = f.read()

    tree = ast.parse(source_code)

    call_lines = []

    class FunctionCallFinder(ast.NodeVisitor):
        def visit_Call(self, node):
            if isinstance(node.func, ast.Name):
                if node.func.id == function_name:
                    call_lines.append(node.lineno)
            self.generic_visit(node)

    finder = FunctionCallFinder()
    finder.visit(tree)

    return call_lines


def test_register_project_tools_not_called():
    """
    Test that register_project_tools is not called in register_modules().

    This ensures project tools are hard-disabled at registration time.
    """
    mcp_server_path = get_mcp_server_file_path()
    call_lines = find_function_calls(mcp_server_path, "register_project_tools")

    assert len(call_lines) == 0, (
        f"register_project_tools should not be called. "
        f"Found {len(call_lines)} call(s) at line(s): {call_lines}"
    )


def test_register_task_tools_not_called():
    """
    Test that register_task_tools is not called in register_modules().

    This ensures task tools are hard-disabled at registration time.
    """
    mcp_server_path = get_mcp_server_file_path()
    call_lines = find_function_calls(mcp_server_path, "register_task_tools")

    assert len(call_lines) == 0, (
        f"register_task_tools should not be called. "
        f"Found {len(call_lines)} call(s) at line(s): {call_lines}"
    )


def test_register_document_tools_not_called():
    """
    Test that register_document_tools is not called in register_modules().

    This ensures document tools are hard-disabled at registration time.
    """
    mcp_server_path = get_mcp_server_file_path()
    call_lines = find_function_calls(mcp_server_path, "register_document_tools")

    assert len(call_lines) == 0, (
        f"register_document_tools should not be called. "
        f"Found {len(call_lines)} call(s) at line(s): {call_lines}"
    )


def test_register_version_tools_still_called():
    """
    Test that register_version_tools is still called in register_modules().

    This ensures version tools remain enabled after removing other registrations.
    """
    mcp_server_path = get_mcp_server_file_path()
    call_lines = find_function_calls(mcp_server_path, "register_version_tools")

    assert len(call_lines) == 1, (
        f"register_version_tools should be called exactly once. "
        f"Found {len(call_lines)} call(s) at line(s): {call_lines}"
    )


def test_register_feature_tools_still_called():
    """
    Test that register_feature_tools is still called in register_modules().

    This ensures feature tools remain enabled after removing other registrations.
    """
    mcp_server_path = get_mcp_server_file_path()
    call_lines = find_function_calls(mcp_server_path, "register_feature_tools")

    assert len(call_lines) == 1, (
        f"register_feature_tools should be called exactly once. "
        f"Found {len(call_lines)} call(s) at line(s): {call_lines}"
    )


def test_register_docs_tools_still_called():
    """
    Test that register_docs_tools is still called in register_modules().

    This ensures docs tools remain enabled after removing other registrations.
    """
    mcp_server_path = get_mcp_server_file_path()
    call_lines = find_function_calls(mcp_server_path, "register_docs_tools")

    assert len(call_lines) == 1, (
        f"register_docs_tools should be called exactly once. "
        f"Found {len(call_lines)} call(s) at line(s): {call_lines}"
    )
