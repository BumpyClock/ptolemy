# Ptolemy

A trimmed-down Ptolemy port focused on knowledge base RAG + MCP tools.

## Services
- **API server**: FastAPI backend for knowledge base, crawling, RAG, settings, providers, progress.
- **MCP server**: FastMCP with RAG-only tools.
- **UI**: React/TanStack Query frontend for knowledge management + settings.

## Quick Start (Docker)
1. Copy `.env.example` to `.env` and set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`.
2. Run:

```bash
cd ptolemy
docker compose up --build
```

UI: http://localhost:3737
API: http://localhost:8181
MCP: http://localhost:8051/mcp

## Notes
- If you are upgrading from a legacy schema, run `migration/0.1.0/012_rename_legacy_schema_to_ptolemy.sql` first.
- MCP tools included: `rag_get_available_sources`, `rag_search_knowledge_base`,
  `rag_search_code_examples`, `rag_list_pages_for_source`, `rag_read_full_page`.
- Projects/Agent Work Orders UI and API routes are disabled in this port.
