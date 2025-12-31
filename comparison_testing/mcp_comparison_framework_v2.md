# Multi-Level MCP Comparison Test Framework v2.0
## Enhanced with Failure Analysis & Gap Identification

You are a TRIAL RUNNER testing two MCP integrations in an independent trial.

## Test Structure

You will spawn 2 isolated sub-agents:
1. Agent A for Archon MCP
2. Agent B for Ptolemy MCP

Each sub-agent must complete the same task independently with detailed failure tracking. You will consolidate their results into a single trial report with gap analysis.

## MCP Systems Under Test

A) **Archon MCP** (tools: rag_get_available_sources, rag_search_knowledge_base, rag_search_code_examples, rag_list_pages_for_source, rag_read_full_page)
B) **Ptolemy MCP** (tools: docs_answer, docs_fetch)

## Task Scenario

Implement a Next.js API route that streams AI responses and supports tool-calling using the Vercel AI SDK v6 with the OpenAI provider. The route should:
- Accept POST with chat messages
- Stream the assistant response
- Define one tool with a schema (e.g., getWeather) and show how tool calls are handled
- Return the correct streaming response type per the SDK docs

## Constraints for All Agents

- No web search
- No prior knowledge - only KB/tool outputs
- Must track all metrics AND failures
- Must provide citations from tool outputs
- Must document every gap encountered

---

## PROMPT FOR EACH trial

You are conducting a controlled MCP comparison experiment for Trial [N].

### Your Mission

1. **Spawn 2 parallel isolated agents**:
   - Agent A: Uses ONLY Archon MCP tools
   - Agent B: Uses ONLY Ptolemy MCP tools

2. **Task them with**: Implementing a Next.js API route that streams AI responses and supports tool-calling using the Vercel AI SDK v6 with the OpenAI provider. The route should:
   - Accept POST with chat messages
   - Stream the assistant response
   - Define one tool with a schema (e.g., getWeather) and show how tool calls are handled
   - Return the correct streaming response type per SDK docs

3. **Critical isolation rules**:
   - Agent A must NEVER use Ptolemy tools (docs_answer, docs_fetch)
   - Agent B must NEVER use Archon tools (rag_*)
   - No web search allowed
   - No prior knowledge - only tool outputs
   - Each agent tracks: tool calls, turns, confidence level, AND all failures

4. **Wait for both agents to complete**

5. **Consolidate into Trial [N] Report** with:

---

## ENHANCED TRIAL [N] REPORT FORMAT

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

   - Query: "[another failed query]"
     - [same structure...]

2. **Tool Limitations Encountered:**
   - Tool: rag_read_full_page
     - Issue: Page exceeded character limit (53,166 chars)
     - Impact: Couldn't access main provider documentation
     - Workaround: Switched to chunks mode with rag_search_knowledge_base
     - Success: Partial - got fragments but not complete picture

   - Tool: [another tool]
     - Issue: [limitation]
     - Impact: [consequence]
     - Workaround: [attempted solution]
     - Success: [Yes/No/Partial]

3. **Documentation Gaps Identified:**
   - Missing: "Complete Next.js App Router route.ts example with streamText and tools"
     - Available: Generic examples, Express/NestJS examples
     - Impact: Had to infer Next.js pattern from other frameworks
     - Confidence hit: Medium → Low

   - Missing: "`toDataStreamResponse` method documentation"
     - Available: `pipeTextStreamToResponse`, `toTextStreamResponse`
     - Impact: Unclear which method to use for Next.js
     - Workaround: Tried searching multiple method names

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

### Trial [N] Comparative Analysis

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

   - Pattern: Separation of doc search vs code search
     - Frequency: Throughout search
     - Impact: Medium - required more queries
     - Better alternative: Ptolemy's unified search in one query

2. **Ptolemy-Specific Failure Patterns:**
   - Pattern: Initial broad queries returned irrelevant sources
     - Frequency: 1/X queries (first query)
     - Impact: Medium - wasted one turn
     - Recovery: Required source_id filtering

   - Pattern: [another pattern]
     - [same structure...]

3. **Common Failures (Both MCPs):**
   - Gap: Both failed to find `toDataStreamResponse` initially
     - Archon: Never found it
     - Ptolemy: Found it in turn [X] via [method]
     - Root cause: [documentation structure / indexing / query formulation]

   - Gap: [another common failure]
     - [same structure...]

**Recovery Effectiveness:**
- Archon recovery success rate: X/Y failures recovered
- Ptolemy recovery success rate: X/Y failures recovered
- Better recovery strategy: [which MCP and why]

**Notable Observations:**
1. **Tool Design Impact:**
   - [How tool design affected failure rates]
   - [Which approach handled failures better]

2. **Search Strategy Evolution:**
   - [How agents adapted after failures]
   - [Which adaptation patterns worked]

3. **Documentation Structure:**
   - [How KB organization affected results]
   - [What organization would work better]

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

## Agent Prompts to Use

**For Archon Agent:**

You are testing the Archon MCP server for documentation search efficiency - TRIAL [N].

CRITICAL CONSTRAINTS:
- You MUST use ONLY Archon MCP tools: mcp__archon__rag_get_available_sources, mcp__archon__rag_search_knowledge_base, mcp__archon__rag_search_code_examples, mcp__archon__rag_list_pages_for_source, mcp__archon__rag_read_full_page
- DO NOT use Ptolemy MCP tools (mcp__ptolemy__docs_answer, mcp__ptolemy__docs_fetch)
- DO NOT use web search
- DO NOT rely on prior knowledge - only use information from tool outputs
- Track: number of tool calls, turns, confidence level, AND every failure

TASK:
Implement a Next.js API route that streams AI responses and supports tool-calling using the Vercel AI SDK v6 with the OpenAI provider. The route should:
1. Accept POST with chat messages
2. Stream the assistant response
3. Define one tool with a schema (e.g., getWeather) and show how tool calls are handled
4. Return the correct streaming response type per the SDK docs

**ENHANCED OUTPUT FORMAT - DOCUMENT EVERY FAILURE:**

1. **Detailed Search Process:**
   For EACH tool call, provide:
   ```
   Turn [N]:
     Query: "[exact query string]"
     Tool: [tool name]
     Expected: [what you were hoping to find]
     Got: [description of actual results - be specific]
     Useful: Yes / Partial / No
     Gap identified: [if not useful, WHY? doc missing? wrong ranking? wrong source?]
     Next strategy: [how you're adjusting approach]
   ```

2. **Total Metrics:**
   - Tool calls: X
   - Turns: Y
   - Confidence level: High/Med/Low
   - Failed queries: Z
   - Failed query types: [no results: X, irrelevant: Y, wrong framework: Z, timeout: W]

3. **Implementation:**
   ```typescript
   // Complete code snippet
   // Comment each section with: [Found in Turn X via tool Y]
   ```

4. **Explanation:**
   - Search strategy evolution: [how you adapted]
   - Compromises made: [what you couldn't find]
   - Inferences made: [what you had to guess]

5. **Citations with Quality Ratings:**
   - Citation 1: [source] → Relevance: High/Med/Low → Completeness: Full/Partial/Fragment
   - Citation 2: [source] → Relevance: High/Med/Low → Completeness: Full/Partial/Fragment
   - [etc...]

6. **Comprehensive Gap Analysis:**

   **A. Documentation Gaps:**
   - Missing: "[specific information that should exist but doesn't]"
     - Needed for: [what task]
     - Available elsewhere: [if known]
     - Impact: [how this blocked progress]
   - [continue for all gaps...]

   **B. Tool Limitations:**
   - Tool: [name]
     - Limitation: [what it can't do]
     - Example: [when you hit this limit]
     - Workaround: [what you tried]
     - Success: [Yes/No/Partial]
   - [continue for all limitations...]

   **C. Query Formulation Challenges:**
   - Failed query: "[exact query]"
     - Why it failed: [too broad, too specific, wrong keywords, etc.]
     - What you learned: [how to query better]
     - Better formulation: "[improved query]"
   - [continue for all challenges...]

   **D. Ranking/Relevance Issues:**
   - Irrelevant but high-ranked: [example result]
     - Why irrelevant: [explanation]
     - What should have ranked higher: [example]
   - [continue for all issues...]

   **E. Recovery Strategies That Worked:**
   - When [X] failed: [strategy used] → Success: [Yes/No]
   - When [Y] failed: [strategy used] → Success: [Yes/No]
   - [continue for all recoveries...]

   **F. Actionable Improvements:**
   For MCP Server:
   - [ ] Add this documentation: [specific content]
   - [ ] Fix this tool limitation: [specific issue]
   - [ ] Improve this ranking: [specific case]

   For Users:
   - [ ] Use this query pattern: [recommendation]
   - [ ] Avoid this approach: [anti-pattern]
   - [ ] Try this workaround: [tip]

Begin your search now and **document every single failure with root cause analysis**.

---

**For Ptolemy Agent:**

[EXACT SAME ENHANCED FORMAT AS ARCHON ABOVE, but with Ptolemy tools]

You are testing the Ptolemy MCP server for documentation search efficiency - TRIAL [N].

CRITICAL CONSTRAINTS:
- You MUST use ONLY Ptolemy MCP tools: mcp__ptolemy__docs_answer, mcp__ptolemy__docs_fetch
- DO NOT use Archon MCP tools (mcp__archon__rag_*)
- DO NOT use web search
- DO NOT rely on prior knowledge - only use information from tool outputs
- Track: number of tool calls, turns, confidence level, AND every failure

TASK: [same as Archon]

**ENHANCED OUTPUT FORMAT - DOCUMENT EVERY FAILURE:**
[same structure as Archon]

Begin your search now and **document every single failure with root cause analysis**.

---

## FINAL CONSOLIDATION

After both sub-agents complete, consolidate into:

# MCP COMPARISON REPORT (Single Trial)
## With Comprehensive Gap Analysis

## Aggregate Metrics

### Archon MCP
- Average tool calls: X.X ± σ
- Tool call range: [min, max]
- Average turns: Y.Y ± σ
- Failed calls: Z total across all trials
- Failure types breakdown:
  - Page too large: X instances
  - No results: Y instances
  - Irrelevant results: Z instances
  - Wrong framework: W instances
- Consistency score: [variance analysis]
- Success rate: X/10 correct implementations
- Recovery rate: X/Y failures successfully recovered

### Ptolemy MCP
[Same structure as Archon]

---

## Comparative Analysis

- Efficiency: [Compare tool calls and turns]
- Reliability: [Compare failed call rates]
- Quality: [Compare implementation correctness and specificity]
- Recovery effectiveness: [Which MCP recovered from failures better]

---

## Comprehensive Gap Analysis

### 1. Documentation Gaps (Common to Both MCPs)

**Critical Missing Documentation:**
- [ ] Next.js App Router specific examples with streamText
  - Impact: High - forced inference from other frameworks
  - Recommendation: Add complete app/api/route.ts examples to both KBs

- [ ] `toDataStreamResponse` method documentation
  - Impact: High - unclear which streaming method to use
  - Recommendation: [specific addition needed]

- [ ] [Other gaps identified across trials...]

**Framework-Specific Examples Needed:**
- [ ] Next.js App Router patterns (currently have Pages Router)
- [ ] [Other framework gaps...]

---

### 2. Tool Limitation Patterns

**Archon-Specific Limitations:**
- **Page Size Limits:**
  - Frequency: [count within trial]
  - Impact: Blocked access to full documentation pages
  - Workaround effectiveness: Partial (chunks mode)
  - Recommendation: Increase limit or auto-chunk large pages

- **Separate Doc/Code Tools:**
  - Frequency: [count within trial] (inherent design)
  - Impact: Requires more queries for complete picture
  - Workaround: Multiple sequential searches
  - Recommendation: Consider unified search option

**Ptolemy-Specific Limitations:**
- **Broad Query Filtering:**
  - Frequency: [count within trial] (first query issues)
  - Impact: Initial queries returned wrong sources
  - Workaround: Requires source_id filtering
  - Recommendation: Better default source filtering

- **[Other limitations...]**

---

### 3. Query Formulation Insights

**Queries That Worked Well:**

For Archon:
- ✅ "[example successful query]" - Why it worked: [analysis]
- ✅ "[another successful query]" - Why it worked: [analysis]

For Ptolemy:
- ✅ "[example successful query]" - Why it worked: [analysis]
- ✅ "[another successful query]" - Why it worked: [analysis]

**Queries That Failed:**

For Archon:
- ❌ "[failed query]" - Why it failed: [too broad/specific/wrong keywords]
- ❌ "[failed query]" - Why it failed: [analysis]

For Ptolemy:
- ❌ "[failed query]" - Why it failed: [analysis]
- ❌ "[failed query]" - Why it failed: [analysis]

**Query Pattern Recommendations:**
- For implementation tasks: [recommended pattern]
- For conceptual searches: [recommended pattern]
- For code examples: [recommended pattern]

---

### 4. Ranking/Relevance Issues

**Archon Ranking Patterns:**
- Ranks too high: [type of results that shouldn't be top]
- Ranks too low: [type of results that should be higher]
- Recommendation: [ranking improvement suggestions]

**Ptolemy Ranking Patterns:**
- Ranks too high: [type of results]
- Ranks too low: [type of results]
- Recommendation: [suggestions]

---

### 5. Recovery Strategy Effectiveness

**Successful Recovery Patterns:**
- When X fails → Do Y: Success rate: [%]
- When X fails → Do Y: Success rate: [%]

**Failed Recovery Patterns:**
- When X fails → Tried Y: Success rate: [%] (not effective)
- When X fails → Tried Y: Success rate: [%] (not effective)

---

## Final Verdict

### Winner: [Archon/Ptolemy] with [High/Medium/Low] Confidence

### Reasoning:
1. [Statistical significance of efficiency differences]
2. [Consistency patterns across trials]
3. [Quality assessment]
4. [Recovery effectiveness]
5. [Usability factors]

**Confidence Level**: [High/Medium/Low]
- Based on: [variance analysis, consistency, clear winner in X/4 trials]

---

## Actionable Recommendations

### For Archon MCP Development Team:
**High Priority:**
- [ ] Fix: [critical gap/limitation with trial evidence]
- [ ] Add: [missing documentation with examples from trials]
- [ ] Improve: [ranking issue with specific cases]

**Medium Priority:**
- [ ] [recommendation]
- [ ] [recommendation]

**Low Priority:**
- [ ] [recommendation]

---

### For Ptolemy MCP Development Team:
**High Priority:**
- [ ] Fix: [critical gap/limitation with trial evidence]
- [ ] Add: [missing documentation with examples from trials]
- [ ] Improve: [ranking issue with specific cases]

**Medium Priority:**
- [ ] [recommendation]

**Low Priority:**
- [ ] [recommendation]

---

### For MCP Users:

**When Using Archon:**
- ✅ Do: [best practice learned from trials]
- ❌ Avoid: [anti-pattern from failures]
- 💡 Tip: [workaround that proved effective]

**When Using Ptolemy:**
- ✅ Do: [best practice]
- ❌ Avoid: [anti-pattern]
- 💡 Tip: [workaround]

**General Best Practices:**
- Start with: [which MCP for what type of task]
- Escalate to: [when to switch MCP]
- Query formulation: [recommended patterns]

---

## Appendix: All Failure Cases

### Trial Failures:
- [Complete list with root causes]

---

## Execution Instructions

1. Spawn 2 sub-agents in parallel using Task tool
2. Sub-agents document EVERY failure with root cause analysis
3. Consolidate into a single trial report with gap identification
4. Present final verdict with actionable improvement roadmap

---

## Success Criteria for Enhanced Framework

✅ Every failure documented with root cause
✅ Every gap classified (doc/tool/query/ranking)
✅ Recovery strategies evaluated for effectiveness
✅ Actionable recommendations for both MCP teams
✅ User best practices derived from real failure patterns
✅ Comparative analysis showing which MCP handles failures better

---

This enhanced framework provides:
- **Debugging data** for MCP development teams
- **Gap identification** for knowledge base improvements
- **User guidance** for effective MCP usage
  - **Actionable insights** not just metrics
