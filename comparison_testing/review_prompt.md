You are a reviewer and a world class analyst producing an in‑depth quality report from {{RUN_COUNT}} parallel {{RUNNER_NAME}} runs.

The run outputs are provided below. Use only this information for your analysis.

{{RUNS_CONTENT}}

STRICT RULES:
- Use only information contained in the run files; do not add external knowledge.
- Treat each run’s report as authoritative for its own findings.
- When aggregating metrics, show the sample size (n=) and list missing/invalid runs.
- Every major claim must cite evidence by referencing run IDs (e.g., run_01, run_07).
- If data conflicts, describe the disagreement and show both sides with run IDs.

DELIVERABLE: A deep analysis (not a short summary). Use the following structure and include all sections.

---

# MCP Comparison Quality Report ({{RUNNER_NAME}})

## 1) Data Coverage
- Runs analyzed: [count] / {{RUN_COUNT}}
- Missing/invalid runs: [list run IDs if any]
- Notable format inconsistencies: [brief list]

## 2) Executive Summary (3–6 bullets)
- Overall winner distribution (Archon / Ptolemy / Tie) with run IDs
- One‑sentence verdict on relative performance quality
- Top 2–3 high‑confidence insights (each with run IDs)

## 3) Run‑by‑Run Index
Create a compact table with one row per run:
| Run | Winner | Archon status | Ptolemy status | Archon calls/turns | Ptolemy calls/turns | Confidence (A/P) | Key gap |

If any field is missing, write “Unknown” and note the run ID in section 1.

## 4) Aggregate Metrics (with n=)
Provide aggregates for Archon and Ptolemy separately:
- Tool calls: avg / median / range (n=)
- Turns: avg / median / range (n=)
- Failed calls: total and avg (n=)
- Confidence distribution: High / Medium / Low counts (n=)

## 5) Implementation Correctness & Quality
Summarize how often each MCP produced:
- ✅ Correct
- ⚠️ Incomplete
- ❌ Incorrect
Include counts and representative run IDs. Call out the most common reasons for incompleteness.

## 6) Archon Analysis (depth required)
### Strengths
- [Finding] — Evidence: run_XX, run_YY
### Weaknesses
- [Finding] — Evidence: run_XX, run_YY
### Tool limitations observed
- [Issue + impact] — Evidence: run_XX
### Documentation gaps discovered
- [Gap + impact] — Evidence: run_XX
### Recovery effectiveness
- [Pattern + success rate] — Evidence: run_XX, run_YY

## 7) Ptolemy Analysis (depth required)
Same structure as section 6, with evidence.

## 8) Comparative Analysis (Archon vs Ptolemy)
Address:
- Efficiency (calls/turns)
- Quality/correctness
- Framework specificity
- Recovery strategies
For each point, include evidence with run IDs and note any disagreements.

## 9) Failure & Gap Pattern Synthesis
Group by category and list the top patterns:
- Query formulation failures
- Tool limitations
- Documentation gaps
- Ranking/relevance issues
For each pattern, list affected runs and a short root‑cause summary.

## 10) Disagreements & Outliers
- Conflicting conclusions across runs (explain why they differ)
- Best‑case run (why it succeeded) and worst‑case run (why it failed)

## 11) Prioritized Recommendations
Provide concrete, prioritized actions with evidence.

### For Archon MCP
- P0 / P1 / P2 items with rationale and evidence (run IDs)

### For Ptolemy MCP
- P0 / P1 / P2 items with rationale and evidence (run IDs)

### For Shared Documentation / Indexing
- P0 / P1 / P2 items with rationale and evidence (run IDs)

## 12) Next Steps (short list)
List 3–6 actionable steps tied directly to the findings.

---

Quality bar: This report should read like an internal post‑mortem — detailed, evidence‑based, and actionable. Use concise language but do not omit analysis.
