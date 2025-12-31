"""
Documentation tools for Ptolemy MCP Server.

Tools:
- docs_answer: RAG-backed answers from docs and code examples
- docs_fetch: Deterministic retrieval and listing for sources and pages
"""

import hashlib
import json
import logging
from typing import Annotated, Any, Literal
from urllib.parse import urljoin

import httpx
from mcp.server.fastmcp import Context, FastMCP
from pydantic import Field

from src.mcp_server.utils.timeout_config import get_default_timeout
from src.server.config.service_discovery import get_api_url

logger = logging.getLogger(__name__)

_DEFAULT_KINDS = ["doc", "code_example"]
_KIND_PRIORITY = {"doc": 0, "code_example": 1}
_SOURCE_KIND = "sources"
_PAGES_KIND = "pages"
_PAGE_KIND = "page"
_CODE_EXAMPLES_KIND = "code_examples"
_CHUNKS_KIND = "chunks"


def _compact_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, separators=(",", ":"))


def _hash_text(text: str | None) -> str:
    if not text:
        return ""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _drop_none(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def _first_float(*values: Any) -> float:
    for value in values:
        if value is None:
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return 0.0


def _normalize_kinds(kinds: Any) -> list[str]:
    if kinds is None:
        return list(_DEFAULT_KINDS)
    if isinstance(kinds, str):
        return [kinds]
    return list(kinds)


def _build_doc_item(result: dict[str, Any]) -> dict[str, Any]:
    metadata = result.get("metadata") or {}
    url = result.get("url") or metadata.get("url")
    page_id = result.get("page_id") or metadata.get("page_id")
    title = result.get("title") or metadata.get("title") or result.get("section_title") or metadata.get("section_title")
    section = (
        result.get("section")
        or metadata.get("headers")
        or metadata.get("section_title")
        or result.get("section_title")
    )
    content = result.get("content")
    score = _first_float(
        result.get("similarity_score"),
        result.get("aggregate_similarity"),
        result.get("average_similarity"),
        result.get("similarity"),
    )
    payload = {
        "id": page_id or result.get("id"),
        "url": url,
        "title": title,
        "section": section,
        "content": content,
        "score": score,
        "metadata": metadata,
        "kind": "doc",
    }
    return _drop_none(payload)


def _build_code_item(result: dict[str, Any]) -> dict[str, Any]:
    metadata = result.get("metadata") or {}
    summary = result.get("summary")
    if summary:
        metadata = {**metadata, "summary": summary}
    url = result.get("url") or metadata.get("url")
    title = metadata.get("title") or metadata.get("example_name") or result.get("title")
    section = metadata.get("section")
    content = result.get("code") or result.get("content")
    score = _first_float(result.get("rerank_score"), result.get("similarity"), result.get("score"))
    payload = {
        "id": metadata.get("id"),
        "url": url,
        "title": title,
        "section": section,
        "content": content,
        "score": score,
        "metadata": metadata,
        "kind": "code_example",
    }
    return _drop_none(payload)


def _build_citation(
    item: dict[str, Any],
    result: dict[str, Any],
    kind: str,
    return_mode: str,
    content_hash: str,
) -> dict[str, Any]:
    metadata = result.get("metadata") or {}
    source_id = result.get("source_id") or metadata.get("source_id") or metadata.get("source")
    page_id = result.get("page_id") or metadata.get("page_id")
    chunk_id = None
    if kind == "doc" and return_mode == "chunks":
        chunk_id = result.get("id") or metadata.get("chunk_id")
    payload = {
        "source_id": source_id,
        "page_id": page_id,
        "chunk_id": chunk_id,
        "url": item.get("url"),
        "hash": content_hash,
        "score": item.get("score"),
        "kind": kind,
    }
    return _drop_none(payload)


def _build_meta(
    return_mode: str,
    sources: list[str],
    reranked: bool,
    debug_data: dict[str, Any] | None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "reranked": reranked,
        "return_mode": return_mode,
        "index_version": None,
        "sources": sources,
    }
    if debug_data is not None:
        payload["debug"] = debug_data
    return payload


def register_docs_tools(mcp: FastMCP):
    """Register documentation tools with the MCP server."""

    @mcp.tool()
    async def docs_answer(
        ctx: Context,
        query: str,
        kind: Annotated[list[Literal["doc", "code_example"]], Field(description="Kinds of results")] = _DEFAULT_KINDS,
        source_id: str | None = None,
        match_count: Annotated[int, Field(ge=1, le=20, description="Max results")] = 5,
        return_mode: Annotated[Literal["chunks", "pages"], Field(description="Return mode")] = "chunks",
        citations: bool = True,
        debug: bool = False,
    ) -> str:
        """
        Answer questions using RAG-backed docs and code examples.
        """
        try:
            normalized_kinds = _normalize_kinds(kind)
            if not normalized_kinds:
                normalized_kinds = list(_DEFAULT_KINDS)
            invalid_kinds = [value for value in normalized_kinds if value not in _KIND_PRIORITY]
            if invalid_kinds:
                invalid_display = ", ".join([str(value) for value in invalid_kinds])
                return _compact_json(
                    {
                        "success": False,
                        "results": [],
                        "citations": [],
                        "meta": _build_meta(return_mode, [], False, None),
                        "error": f"Invalid kind values: {invalid_display}",
                    }
                )

            api_url = get_api_url()
            timeout = get_default_timeout()
            source_filter = source_id.strip() if source_id and source_id.strip() else None

            doc_results = []
            code_results = []
            doc_return_mode = return_mode
            reranked = False
            debug_data = {} if debug else None

            async with httpx.AsyncClient(timeout=timeout) as client:
                if "doc" in normalized_kinds:
                    payload = {"query": query, "match_count": match_count, "return_mode": return_mode}
                    if source_filter:
                        payload["source"] = source_filter
                    response = await client.post(urljoin(api_url, "/api/rag/query"), json=payload)
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "results": [],
                                "citations": [],
                                "meta": _build_meta(return_mode, [], False, None),
                                "error": f"Docs query failed with HTTP {response.status_code}",
                            }
                        )
                    doc_payload = response.json()
                    doc_results = doc_payload.get("results", [])
                    doc_return_mode = doc_payload.get("return_mode", return_mode)
                    reranked = bool(doc_payload.get("reranking_applied", doc_payload.get("reranked", False)))
                    if debug_data is not None:
                        debug_data["doc_results"] = len(doc_results)

                if "code_example" in normalized_kinds:
                    payload = {"query": query, "match_count": match_count}
                    if source_filter:
                        payload["source"] = source_filter
                    response = await client.post(urljoin(api_url, "/api/rag/code-examples"), json=payload)
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "results": [],
                                "citations": [],
                                "meta": _build_meta(return_mode, [], False, None),
                                "error": f"Code examples query failed with HTTP {response.status_code}",
                            }
                        )
                    code_payload = response.json()
                    code_results = code_payload.get("results", [])
                    reranked = reranked or bool(code_payload.get("reranked", False))
                    if debug_data is not None:
                        debug_data["code_results"] = len(code_results)

            merged: list[dict[str, Any]] = []

            for result in doc_results:
                item = _build_doc_item(result)
                content_hash = _hash_text(item.get("content"))
                citation = _build_citation(item, result, "doc", doc_return_mode, content_hash)
                merged.append(
                    {
                        "item": item,
                        "citation": citation,
                        "score": item.get("score", 0.0),
                        "hash": content_hash,
                        "url": item.get("url") or "",
                        "kind": "doc",
                    }
                )

            for result in code_results:
                item = _build_code_item(result)
                content_hash = _hash_text(item.get("content"))
                citation = _build_citation(item, result, "code_example", doc_return_mode, content_hash)
                merged.append(
                    {
                        "item": item,
                        "citation": citation,
                        "score": item.get("score", 0.0),
                        "hash": content_hash,
                        "url": item.get("url") or "",
                        "kind": "code_example",
                    }
                )

            merged.sort(
                key=lambda entry: (
                    -entry.get("score", 0.0),
                    _KIND_PRIORITY.get(entry.get("kind"), 99),
                    entry.get("url", ""),
                )
            )

            deduped = []
            seen = set()
            for entry in merged:
                key = (entry.get("url", ""), entry.get("hash", ""))
                if key in seen:
                    continue
                seen.add(key)
                deduped.append(entry)

            limited = deduped[:match_count]
            results = [entry["item"] for entry in limited]
            citation_items = [entry["citation"] for entry in limited] if citations else []

            sources = []
            if source_filter:
                sources = [source_filter]
            else:
                source_values = []
                for entry in limited:
                    metadata = entry["item"].get("metadata") or {}
                    source_value = metadata.get("source_id") or metadata.get("source")
                    if not source_value:
                        source_value = entry["citation"].get("source_id") if entry.get("citation") else None
                    if source_value:
                        source_values.append(source_value)
                sources = sorted(set(source_values))

            return _compact_json(
                {
                    "success": True,
                    "results": results,
                    "citations": citation_items,
                    "meta": _build_meta(doc_return_mode, sources, reranked, debug_data),
                    "error": None,
                }
            )

        except httpx.RequestError as e:
            logger.error(f"Docs answer request failed: {e}", exc_info=True)
            return _compact_json(
                {
                    "success": False,
                    "results": [],
                    "citations": [],
                    "meta": _build_meta(return_mode, [], False, None),
                    "error": f"Docs answer request failed: {str(e)}",
                }
            )
        except Exception as e:
            logger.error(f"Docs answer failed: {e}", exc_info=True)
            return _compact_json(
                {
                    "success": False,
                    "results": [],
                    "citations": [],
                    "meta": _build_meta(return_mode, [], False, None),
                    "error": f"Docs answer failed: {str(e)}",
                }
            )

    @mcp.tool()
    async def docs_fetch(
        ctx: Context,
        kind: Annotated[
            Literal["sources", "pages", "page", "code_examples", "chunks"],
            Field(description="Fetch mode"),
        ],
        source_id: str | None = None,
        section: str | None = None,
        page: Annotated[int, Field(ge=1, description="Page number")] = 1,
        per_page: Annotated[int | None, Field(ge=1, description="Items per page")] = None,
        query: str | None = None,
        tag: str | None = None,
        page_id: str | None = None,
        url: str | None = None,
        domain_filter: str | None = None,
    ) -> str:
        """
        Fetch deterministic documentation data without search.
        """
        try:
            api_url = get_api_url()
            timeout = get_default_timeout()
            page_value = max(page, 1)

            default_per_page = {
                _SOURCE_KIND: 25,
                _PAGES_KIND: 50,
                _CODE_EXAMPLES_KIND: 20,
                _CHUNKS_KIND: 20,
            }.get(kind, 25)

            per_page_value = per_page or default_per_page
            if kind == _PAGES_KIND:
                per_page_value = min(per_page_value, 200)
            else:
                per_page_value = min(per_page_value, 100)
            per_page_value = max(per_page_value, 1)

            offset = (page_value - 1) * per_page_value

            async with httpx.AsyncClient(timeout=timeout) as client:
                if kind == _SOURCE_KIND:
                    response = await client.get(urljoin(api_url, "/api/rag/sources"))
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": f"Sources fetch failed with HTTP {response.status_code}",
                            }
                        )
                    payload = response.json()
                    if payload.get("success") is False:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": f"Sources fetch failed: {payload.get('error', 'Unknown error')}",
                            }
                        )
                    sources = payload.get("sources", [])
                    if query:
                        query_lower = query.lower()
                        sources = [
                            source
                            for source in sources
                            if query_lower in (source.get("title") or "").lower()
                            or query_lower in (source.get("summary") or "").lower()
                            or query_lower in (source.get("source_id") or "").lower()
                        ]
                    if tag:
                        sources = [
                            source
                            for source in sources
                            if tag in (source.get("metadata", {}).get("tags") or [])
                        ]
                    total = len(sources)
                    start = (page_value - 1) * per_page_value
                    end = start + per_page_value
                    data = sources[start:end]
                    return _compact_json(
                        {
                            "success": True,
                            "data": data,
                            "meta": {
                                "total": total,
                                "page": page_value,
                                "per_page": per_page_value,
                                "has_more": end < total,
                            },
                            "error": None,
                        }
                    )

                if kind == _PAGES_KIND:
                    if not source_id:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": "Missing source_id for pages fetch",
                            }
                        )
                    params = {"source_id": source_id}
                    if section:
                        params["section"] = section
                    response = await client.get(urljoin(api_url, "/api/pages"), params=params)
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": f"Pages fetch failed with HTTP {response.status_code}",
                            }
                        )
                    payload = response.json()
                    pages = payload.get("pages", [])
                    total = payload.get("total", len(pages))
                    start = (page_value - 1) * per_page_value
                    end = start + per_page_value
                    data = pages[start:end]
                    return _compact_json(
                        {
                            "success": True,
                            "data": data,
                            "meta": {
                                "total": total,
                                "page": page_value,
                                "per_page": per_page_value,
                                "has_more": end < total,
                                "source_id": payload.get("source_id", source_id),
                            },
                            "error": None,
                        }
                    )

                if kind == _PAGE_KIND:
                    if bool(page_id) == bool(url):
                        return _compact_json(
                            {
                                "success": False,
                                "data": {},
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": "Provide exactly one of page_id or url",
                            }
                        )
                    if page_id:
                        response = await client.get(urljoin(api_url, f"/api/pages/{page_id}"))
                    else:
                        response = await client.get(urljoin(api_url, "/api/pages/by-url"), params={"url": url})
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "data": {},
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": f"Page fetch failed with HTTP {response.status_code}",
                            }
                        )
                    payload = response.json()
                    return _compact_json(
                        {
                            "success": True,
                            "data": payload,
                            "meta": {"source_id": payload.get("source_id")},
                            "error": None,
                        }
                    )

                if kind == _CODE_EXAMPLES_KIND:
                    if not source_id:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": "Missing source_id for code examples fetch",
                            }
                        )
                    params = {"limit": per_page_value, "offset": offset}
                    response = await client.get(
                        urljoin(api_url, f"/api/knowledge-items/{source_id}/code-examples"), params=params
                    )
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": f"Code examples fetch failed with HTTP {response.status_code}",
                            }
                        )
                    payload = response.json()
                    data = payload.get("code_examples", [])
                    total = payload.get("total", len(data))
                    return _compact_json(
                        {
                            "success": True,
                            "data": data,
                            "meta": {
                                "total": total,
                                "page": page_value,
                                "per_page": per_page_value,
                                "has_more": payload.get("has_more", offset + per_page_value < total),
                                "source_id": payload.get("source_id", source_id),
                            },
                            "error": None,
                        }
                    )

                if kind == _CHUNKS_KIND:
                    if not source_id:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": "Missing source_id for chunks fetch",
                            }
                        )
                    params = {"limit": per_page_value, "offset": offset}
                    if domain_filter:
                        params["domain_filter"] = domain_filter
                    response = await client.get(
                        urljoin(api_url, f"/api/knowledge-items/{source_id}/chunks"), params=params
                    )
                    if response.status_code != 200:
                        return _compact_json(
                            {
                                "success": False,
                                "data": [],
                                "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                                "error": f"Chunks fetch failed with HTTP {response.status_code}",
                            }
                        )
                    payload = response.json()
                    data = payload.get("chunks", [])
                    total = payload.get("total", len(data))
                    return _compact_json(
                        {
                            "success": True,
                            "data": data,
                            "meta": {
                                "total": total,
                                "page": page_value,
                                "per_page": per_page_value,
                                "has_more": payload.get("has_more", offset + per_page_value < total),
                                "source_id": payload.get("source_id", source_id),
                            },
                            "error": None,
                        }
                    )

            return _compact_json(
                {
                    "success": False,
                    "data": [],
                    "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                    "error": "Unsupported fetch kind",
                }
            )

        except httpx.RequestError as e:
            logger.error(f"Docs fetch request failed: {e}", exc_info=True)
            return _compact_json(
                {
                    "success": False,
                    "data": [],
                    "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                    "error": f"Docs fetch request failed: {str(e)}",
                }
            )
        except Exception as e:
            logger.error(f"Docs fetch failed: {e}", exc_info=True)
            return _compact_json(
                {
                    "success": False,
                    "data": [],
                    "meta": {"total": 0, "page": page_value, "per_page": per_page_value, "has_more": False},
                    "error": f"Docs fetch failed: {str(e)}",
                }
            )

    logger.info("Docs tools registered")
