"""
Documentation tools for Ptolemy MCP Server.

Provides:
- docs_answer: RAG-backed answers from docs and code examples
- docs_fetch: Deterministic retrieval and listing for sources and pages
"""

from .docs_tools import register_docs_tools

__all__ = ["register_docs_tools"]
