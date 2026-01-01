# Multi-Level MCP Comparison Test Framework v2.0 (Codex-Exec Compatible)
## Single-Agent Trial Format (No Sub-Agents)

You are a SINGLE Codex agent running one trial. Do NOT spawn sub-agents or use any task/parallel agent tools.
You will execute TWO isolated tool-only passes yourself:
1) Archon MCP pass (Archon tools only)
2) Ptolemy MCP pass (Ptolemy tools only)

The orchestration script runs multiple parallel trials; you only return ONE trial report in the format below.

## MCP Systems Under Test

A) **Archon MCP** (tools: rag_get_available_sources, rag_search_knowledge_base, rag_search_code_examples, rag_list_pages_for_source, rag_read_full_page)
B) **Ptolemy MCP** (tools: docs_answer, docs_fetch)

## Task Scenario

{{TASK_SCENARIO}}

## Constraints

- No web search
- No prior knowledge - only MCP tool outputs
- Must track all metrics AND failures
- Must provide citations from tool outputs
- Must document every gap encountered
- Do not create, edit, or delete any files
- Do not run shell commands or use any tools that write to disk

---

## TRIAL REPORT (Single Agent)

If no trial number is provided, label it as "Trial Unknown".

### Trial Header
- Trial: [Number or "Unknown"]
- Agent: Single-agent, sequential passes

---

### Archon MCP Results

**Metrics:**
- Tool calls: X
- Turns: Y
- Confidence: High/Med/Low
- Failed calls: Z (specify type: timeout, no results, wrong results, etc.)

**Detailed Search Journey:**
```
Turn 1:
  Query: "[exact query string]"
  Tool: rag_search_knowledge_base
  Expected: Next.js App Router example with streamText
  Got: [description of actual results]
  Useful: Partial - found tool patterns but not Next.js specific
  Gap: Documentation lacks Next.js App Router examples
  Next Strategy: Search for code examples separately

Turn 2:
  Query: "[exact query string]"
  Tool: rag_search_code_examples
  Expected: Complete route.ts file
  Got: [description]
  Useful: Yes/No/Partial
  Gap: [if failed, explain why]
  Next Strategy: [adaptation]

[Continue for all turns...]
```

**Critical Findings:**
- Turn [X]: Breakthrough - found [what]
- Turn [Y]: Pivot - changed strategy because [why]
- Turn [Z]: Dead end - [what didn't work]

**Implementation Assessment:**
- Status: ✅ Correct / ⚠️ Incomplete / ❌ Incorrect
- What worked:
  - ✅ [Aspect 1 with citation]
  - ✅ [Aspect 2 with citation]
- What was missing:
  - ❌ [Aspect 1] - Gap type: [doc missing/tool limit/query issue]
  - ❌ [Aspect 2] - Gap type: [doc missing/tool limit/query issue]
- Workarounds used:
  - [How agent compensated for gaps]

**Failure Analysis:**

1. **Query Failures:**
   - Query: "[exact query that failed]"
     - Expected: [what agent needed]
     - Got: [irrelevant results / no results / wrong framework]
     - Root cause: [poor ranking / missing docs / wrong source / query formulation]
     - Recovery: [how agent adapted]

2. **Tool Limitations Encountered:**
   - Tool: rag_read_full_page
     - Issue: Page exceeded character limit (53,166 chars)
     - Impact: Couldn't access main provider documentation
     - Workaround: Switched to chunks mode with rag_search_knowledge_base
     - Success: Partial - got fragments but not complete picture

3. **Documentation Gaps Identified:**
   - Missing: "Complete Next.js App Router route.ts example with streamText and tools"
     - Available: Generic examples, Express/NestJS examples
     - Impact: Had to infer Next.js pattern from other frameworks
     - Confidence hit: Medium → Low

4. **Ranking/Relevance Issues:**
   - High-ranked but irrelevant: [example]
   - Should have ranked higher: [example]
   - Wrong framework surfaced: [example]

**Citations Quality:**
- Citation 1: `chunk_index 74` - Relevance: High - Completeness: Partial (tool schema only)
- Citation 2: `https://v6.ai-sdk.dev/llms.txt` - Relevance: Medium - Completeness: Low (too large to read)
- [Continue for all citations...]

---

### Ptolemy MCP Results

[EXACT SAME STRUCTURE AS ARCHON ABOVE]

**Metrics:**
[...]

**Detailed Search Journey:**
```
Turn 1:
  Query: "[exact query]"
  Tool: docs_answer
  Expected: [...]
  Got: [...]
  Useful: [...]
  Gap: [...]
  Next Strategy: [...]
[...]
```

**Critical Findings:**
[...]

**Implementation Assessment:**
[...]

**Failure Analysis:**
1. Query Failures: [...]
2. Tool Limitations: [...]
3. Documentation Gaps: [...]
4. Ranking/Relevance Issues: [...]

**Citations Quality:**
[...]

---

### Trial Comparative Analysis

**Winner**: [Archon / Ptolemy / Tie]

**Efficiency Delta**: [% difference in tool calls]

**Quality Delta**:
- Implementation correctness: [comparison]
- Search relevance: [comparison]
- Framework-specificity: [comparison]

**Failure Pattern Comparison:**

1. **Archon-Specific Failure Patterns:**
   - Pattern: Page size limits blocking full documentation access
     - Frequency: 2/X queries
     - Impact: High - forced chunk-based searching
     - Better alternative: Ptolemy's unified search didn't hit this

2. **Ptolemy-Specific Failure Patterns:**
   - Pattern: Initial broad queries returned irrelevant sources
     - Frequency: 1/X queries (first query)
     - Impact: Medium - wasted one turn
     - Recovery: Required source_id filtering

3. **Common Failures (Both MCPs):**
   - Gap: Both failed to find `toDataStreamResponse` initially
     - Archon: Never found it
     - Ptolemy: Found it in turn [X] via [method]
     - Root cause: [documentation structure / indexing / query formulation]

**Recovery Effectiveness:**
- Archon recovery success rate: X/Y failures recovered
- Ptolemy recovery success rate: X/Y failures recovered
- Better recovery strategy: [which MCP and why]

**Actionable Gaps for Debugging:**

FOR ARCHON:
- [ ] Add: [specific documentation needed]
- [ ] Fix: [tool limitation to address]
- [ ] Improve: [ranking/relevance issue]

FOR PTOLEMY:
- [ ] Add: [specific documentation needed]
- [ ] Fix: [tool limitation to address]
- [ ] Improve: [ranking/relevance issue]

FOR BOTH:
- [ ] Missing docs: [what should be added to knowledge base]
- [ ] Indexing: [what needs better indexing]
- [ ] Examples: [what framework-specific examples needed]

---

## Execution Instructions

1. Do NOT spawn sub-agents
2. Run Archon-only pass first
3. Run Ptolemy-only pass second
4. Return the Trial Report above only
