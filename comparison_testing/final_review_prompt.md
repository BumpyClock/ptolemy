You are a reviewer and a world class analyst producing a comprehensive cross-scenario analysis from {{SCENARIO_COUNT}} scenarios, each with {{RUNNER_NAME}} consolidated reports.

The consolidated reports from each scenario are provided below. Use only this information for your analysis.

{{CONSOLIDATED_CONTENT}}

STRICT RULES:
- Use only information contained in the consolidated reports; do not add external knowledge.
- Treat each scenario's consolidated report as authoritative for its own findings.
- When aggregating metrics across scenarios, show the sample size (n=) and list missing/invalid scenarios.
- Every major claim must cite evidence by referencing scenario names (e.g., 01_ai_sdk_nextjs_streaming, 02_mcp_typescript_tool_server).
- If data conflicts across scenarios, describe the disagreement and show both sides with scenario names.
- Look for patterns that emerge across multiple scenarios.

DELIVERABLE: A comprehensive cross-scenario analysis (not a short summary). Use the following structure and include all sections.

---

# Cross-Scenario MCP Comparison Analysis ({{RUNNER_NAME}})

## 1) Data Coverage
- Scenarios analyzed: [count] / {{SCENARIO_COUNT}}
- Missing/invalid scenarios: [list scenario names if any]
- Notable format inconsistencies: [brief list]

## 2) Executive Summary (5–8 bullets)
- Overall winner distribution across all scenarios (Archon / Ptolemy / Tie) with scenario names
- One‑sentence verdict on relative performance quality across scenarios
- Top 3–5 high‑confidence insights that hold across multiple scenarios (each with scenario names)
- Scenario-specific patterns (which scenarios favor which MCP and why)

## 3) Scenario-by-Scenario Summary
Create a compact table with one row per scenario:
| Scenario | Winner | Archon avg calls/turns | Ptolemy avg calls/turns | Archon success rate | Ptolemy success rate | Key differentiator |

If any field is missing, write "Unknown" and note the scenario name in section 1.

## 4) Cross-Scenario Aggregate Metrics (with n=)
Provide aggregates across all scenarios for Archon and Ptolemy separately:
- Tool calls: avg / median / range across all scenarios (n=)
- Turns: avg / median / range across all scenarios (n=)
- Failed calls: total and avg across all scenarios (n=)
- Confidence distribution: High / Medium / Low counts across all scenarios (n=)
- Success rate: Correct / Incomplete / Incorrect counts across all scenarios (n=)

## 5) Scenario-Specific Performance Patterns
For each scenario, identify:
- Which MCP performed better and why
- Scenario-specific challenges (e.g., framework complexity, documentation availability)
- Scenario-specific strengths of each MCP

## 6) Archon Analysis (cross-scenario depth required)
### Strengths (across scenarios)
- [Finding that holds across multiple scenarios] — Evidence: scenario_XX, scenario_YY
- [Scenario-specific strength] — Evidence: scenario_XX

### Weaknesses (across scenarios)
- [Finding that holds across multiple scenarios] — Evidence: scenario_XX, scenario_YY
- [Scenario-specific weakness] — Evidence: scenario_XX

### Tool limitations observed (cross-scenario)
- [Issue + impact across scenarios] — Evidence: scenario_XX, scenario_YY
- [Scenario-specific limitation] — Evidence: scenario_XX

### Documentation gaps discovered (cross-scenario)
- [Gap + impact across scenarios] — Evidence: scenario_XX, scenario_YY
- [Scenario-specific gap] — Evidence: scenario_XX

### Recovery effectiveness (cross-scenario)
- [Pattern + success rate across scenarios] — Evidence: scenario_XX, scenario_YY

## 7) Ptolemy Analysis (cross-scenario depth required)
Same structure as section 6, with evidence from multiple scenarios.

## 8) Comparative Analysis (Archon vs Ptolemy - Cross-Scenario)
Address across all scenarios:
- Efficiency (calls/turns) - which MCP is more efficient across scenarios
- Quality/correctness - which MCP produces better results across scenarios
- Framework specificity - how each MCP handles different frameworks
- Recovery strategies - which MCP recovers better from failures
- Consistency - which MCP shows more consistent performance across scenarios

For each point, include evidence with scenario names and note any scenario-specific variations.

## 9) Cross-Scenario Failure & Gap Pattern Synthesis
Group by category and list the top patterns that appear across multiple scenarios:
- Query formulation failures (which scenarios, which MCP)
- Tool limitations (which scenarios, which MCP)
- Documentation gaps (which scenarios, which MCP)
- Ranking/relevance issues (which scenarios, which MCP)
- Framework-specific challenges

For each pattern, list affected scenarios and a short root‑cause summary.

## 10) Scenario Disagreements & Outliers
- Scenarios where MCPs performed very differently (explain why)
- Best-performing scenario for Archon (why it succeeded)
- Best-performing scenario for Ptolemy (why it succeeded)
- Worst-performing scenario for each MCP (why it failed)
- Scenarios with conflicting patterns (explain the disagreement)

## 11) Prioritized Recommendations (Cross-Scenario)
Provide concrete, prioritized actions with evidence from multiple scenarios.

### For Archon MCP
- P0 / P1 / P2 items with rationale and evidence (scenario names)
- Items that would help across multiple scenarios vs scenario-specific

### For Ptolemy MCP
- P0 / P1 / P2 items with rationale and evidence (scenario names)
- Items that would help across multiple scenarios vs scenario-specific

### For Shared Documentation / Indexing
- P0 / P1 / P2 items with rationale and evidence (scenario names)
- Cross-scenario documentation needs

## 12) Next Steps (short list)
List 5–8 actionable steps tied directly to the cross-scenario findings.

---

Quality bar: This report should read like a comprehensive post‑mortem across all scenarios — detailed, evidence‑based, and actionable. Use concise language but do not omit analysis. Focus on patterns that emerge across scenarios and scenario-specific insights.

