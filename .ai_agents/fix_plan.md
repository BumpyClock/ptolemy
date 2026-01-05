
You are a monolithic coding agent running in a while-loop. Each run is one
iteration. Do exactly one meaningful task per loop, then stop.

## Deterministic stack (always read, same order)
1. .ai_agents/specs (project specs) 
2. This file (prioritized TODO list)
3. @AGENT.md (build/test instructions, if present)
4. Files referenced by the chosen task

## Mode selection
- If .ai_agents/specs/merge_topics.md is missing, empty, or clearly wrong: Planning mode.
- Otherwise: Build mode.

## Planning mode (one task, then stop)
- Use subagents (skip subagents if you're codex CLI) to scan specs and code for gaps, TODOs, placeholders, and missing behavior.
- Update @fix_plan.md and .ai_agents/specs/merge_topics.md  with a prioritized bullet list and remove completed items.
- If a spec is missing for a needed feature, write it in @specs/*.

# The  Rules (strict)

1. Do not assume missing. Before changing code, search to confirm it is not
   already implemented. Re-check if search is ambiguous or incomplete.
   
2. Use a subagent for each iteration.
3. Use subagents to keep primary context small: many for search/analysis, only one for build/tests.
4. Full implementations only. No placeholders or stubs.
5. TDD: for behavior changes, write a failing test first, then implement. If a test is not applicable, explain why in the loop output.
6. Backpressure: after implementing or fixing, run the smallest relevant test/build/analyzer. If functionality is missing, add it per specs. Fix failures, even if unrelated. Never skip tests or use skip flags.
7. Keep @fix_plan.md current with findings and completions. If you discover a bug, document it immediately, even if unrelated.
8. When you learn a new build/test command, update @AGENT.md briefly. Never put status reports in @AGENT.md.
9. Capture the "why" in docs/tests so future loops understand intent.
10. If a spec is inconsistent, resolve it and update .ai_agents/friday_mvp.md.
11. You may add logging/diagnostics to loop back evidence when needed.
12. If @fix_plan.md grows large, periodically prune completed items.
13. Keep context small: summarize logs and avoid pasting large outputs.
14. When a task is done and all tests pass, mark it complete in @fix_plan.md. Then commit the change with a clear message. Do not push.
15. Output <promise>GOT EM</promise> when all tasks in @fix_plan.md are complete and things align with specs in .ai_agents/specs/merge_topics.md.

## Project invariants (strict)
- Obey any constraints in .ai_agents/specs/merge_topics.md and @AGENT.md as hard requirements.
- If the project includes a standard library, keep it authored in the target
  language, keep tests next to source, and include a README.md per module.
- If the stdlib needs test primitives, start there first.
- Prefer single sources of truth; avoid migrations/adapters unless required by
  specs.

## Git workflow (strict unless @AGENT.md forbids)
- When tests pass: update @fix_plan.md, run `git add -A`, commit with a clear
  message, and push.

## Loop output
- Summarize changes, tests run, and @fix_plan.md updates.


# Topic + Canonical Dedupe Implementation Tasklist

## 0) Preconditions / Decisions (confirmed)
- [ ] Topics are a distinct concept (projects removed later).
- [ ] Canonical URL strategy = keep raw `url` + add `canonical_url`.
- [ ] Dedupe at **page + chunks** using canonical `page_id` (latest crawl wins).
- [ ] Topic → source_ids expansion done in app code (RPC later if needed).
- [ ] Per-source metadata = hybrid (global page metadata + per-source in join table).

## 1) Migrations & Schema ✅ COMPLETE
- [x] Add `ptolemy_topics` table (id, name, description?, related_topic_ids?, created_at, updated_at).
- [x] Add `ptolemy_topic_sources` join table with unique constraint on `source_id` (v1 single-topic).
- [x] Add `canonical_url` to `ptolemy_page_metadata` (unique + index).
- [x] Add `canonical_url` to `ptolemy_crawled_pages` (index).
- [x] Add `ptolemy_page_sources` join table (page_id, source_id, unique composite index).
- [x] Replace chunk uniqueness from `(url, chunk_number)` → `(page_id, chunk_number)`.
- [x] Add/update indexes for `canonical_url`, `page_id`, and topic/source joins.
- [x] Add/adjust RLS policies for new tables (match existing patterns).
- [x] Added 3 helper functions: ptolemy_get_topic_sources, ptolemy_get_topic_pages, ptolemy_move_source_to_topic.

**Migration files:**
- `migration/9_add_topics_and_canonical_dedupe.sql` - incremental migration
- `migration/complete_setup.sql` - updated Section 4.7 for fresh installs

## 2) Canonicalization Rules ✅ COMPLETE
- [x] Implement canonical URL helper (reuse generate_unique_source_id rules).
- [x] Preserve fragments for llms-full section URLs to avoid collapsing anchors.
- [x] Ensure canonicalization is applied consistently in crawl + backfill.

**Implementation:**
- `URLHandler.canonicalize_url(url, preserve_fragment=False)` - base canonicalization function
- `URLHandler.canonicalize_page_url(url)` - auto-detects llms-full URLs and preserves fragments
- Refactored `generate_unique_source_id()` to use shared `canonicalize_url()`
- Added 13 new unit tests in `tests/test_url_canonicalization.py`

**Canonicalization rules applied:**
- Lowercase scheme and netloc
- Remove default ports (:80 for http, :443 for https)
- Remove trailing slashes (except root path)
- Remove tracking params (utm_*, gclid, fbclid, ref, source)
- Sort query parameters alphabetically
- Drop fragments (except for llms-full.txt/llms.txt/llms/ URLs)

## 3) Ingestion Pipeline Updates (Page + Chunk Dedupe) ✅ COMPLETE
- [x] During crawl, compute `canonical_url` for each page.
- [x] Upsert `ptolemy_page_metadata` on `canonical_url` (raw `url` stored separately).
- [x] If canonical page exists, overwrite `full_content` (latest crawl wins).
- [x] Write `ptolemy_page_sources` link for each source↔page.
- [x] Before chunk insert, delete existing chunks by canonical `page_id`.
- [x] Insert chunks with `page_id` + `canonical_url`.
- [x] Update `chunk_count` on canonical page row after storage (existing functionality).

**Implementation:**
- `page_storage_operations.py`:
  - `store_pages()` now computes `canonical_url` and upserts on it
  - `store_llms_full_sections()` preserves fragments in canonical_url
  - Added `_create_page_source_links()` for provenance tracking
- `document_storage_service.py`:
  - `add_documents_to_supabase()` deletes by `page_id` when available (canonical dedupe)
  - Falls back to URL deletion for legacy chunks
  - Chunks now include `canonical_url` field

## 4) Topic UX + API ✅ API COMPLETE (UI pending)
- [x] Add API endpoints:
  - [x] `GET /api/topics` (list)
  - [x] `POST /api/topics` (create)
  - [x] `GET /api/topics/{topic_id}` (get single)
  - [x] `PUT /api/topics/{topic_id}` (update)
  - [x] `DELETE /api/topics/{topic_id}` (delete)
  - [x] `GET /api/topics/{id}/sources`
  - [x] `PUT /api/topics/{id}/sources` (move source between topics)
  - [x] `GET /api/topics/{id}/pages` (deduped)
- [ ] Update add-knowledge flow to select/create Topic (typeahead + create).
- [ ] Default existing sources to a topic (source name or "Uncategorized").
- [ ] Add optional Related Topics UI (soft relationships only).

**Implementation:**
- `api_routes/topics_api.py` - Full CRUD API with Pydantic models
- `services/topics/topic_service.py` - Business logic following tuple[bool, dict] pattern
- Registered in `main.py`
- Note: Requires migration 9 to be applied before use

## 5) Query / Retrieval Updates
- [ ] Topic pages list: topic_id → source_ids → page_ids via `ptolemy_page_sources`.
- [ ] Chunk retrieval uses canonical `page_id` (no raw-url dependence).
- [ ] RAG search filters: resolve topic → source_ids in app layer.
- [ ] UI dedupe indicator for pages referenced by multiple sources.

## 6) Backfill / Data Migration
- [ ] Create topics for existing sources and link via `ptolemy_topic_sources`.
- [ ] Backfill `canonical_url` for all pages (preserve llms-full fragments).
- [ ] Group pages by `canonical_url`, pick canonical page row (latest updated_at).
- [ ] Insert page↔source links for all source_ids.
- [ ] Delete duplicate page rows (or soft-delete if preferred).
- [ ] Chunk dedupe:
  - [ ] Keep chunks only for canonical page row (latest crawl wins).
  - [ ] Delete chunks tied to duplicate page rows.
  - [ ] Repoint remaining chunks to canonical `page_id`.
- [ ] Backfill `ptolemy_crawled_pages.canonical_url`.
- [ ] Recompute page chunk counts.

## 7) Tests
- [ ] Canonical URL normalization unit tests (including llms-full fragment cases).
- [ ] Ingestion: canonical page upsert + chunk delete/insert behavior.
- [ ] Topic flow: move source between topics.
- [ ] Dedupe: pages returned once; chunks collapse to canonical set.
- [ ] Backfill correctness on sample dataset.

## 8) Rollout
- [ ] Land migrations + backfill script.
- [ ] Update ingestion pipeline.
- [ ] Ship topic APIs + UI.
- [ ] Validate with multi-source crawl (Apple + Microsoft docs).
