# Ptolemy

Ptolemy is a trimmed-down knowledge MCP focused on RAG search and knowledge base management.

## Services
- **API server**: FastAPI backend for knowledge base, crawling, RAG, settings, providers, progress.
- **MCP server**: FastMCP with docs tools for RAG search and retrieval.
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

## Database Bootstrap
This repo uses a single bootstrap SQL for a fresh start:

- Run `migration/complete_setup.sql` in Supabase SQL Editor.
- This creates the full `ptolemy_*` schema and seeds default settings.

## MCP Tools
- `docs_answer`
- `docs_fetch`

## Notes
- Projects/Agent Work Orders UI and API routes are disabled in this port.
