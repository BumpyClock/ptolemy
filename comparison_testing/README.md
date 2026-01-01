# Comparison Testing

This folder contains the multi-scenario MCP comparison harness.

## Quick start

Run all scenarios in parallel (each scenario runs at least 5 trials):

```
comparison_testing/scripts/run_claude_parallel.sh
comparison_testing/scripts/run_codex_parallel.sh
```

Limit the number of scenarios running at once:

```
comparison_testing/scripts/run_claude_parallel.sh --max-scenarios 2
comparison_testing/scripts/run_codex_parallel.sh --max-scenarios 2
```

## Single prompt mode

Run one prompt file:

```
comparison_testing/scripts/run_claude_parallel.sh path/to/prompt.md
comparison_testing/scripts/run_codex_parallel.sh path/to/prompt.md
```

Read a prompt from stdin:

```
cat path/to/prompt.md | comparison_testing/scripts/run_claude_parallel.sh -
cat path/to/prompt.md | comparison_testing/scripts/run_codex_parallel.sh -
```

## Scenarios

Scenarios live in `comparison_testing/scenarios/*.md`.
Templates live in `comparison_testing/templates/` and inject `{{TASK_SCENARIO}}` into the base prompt.

## Environment variables

- `RUNS_PER_SCENARIO` sets the number of trials per scenario (min 5)
- `SCENARIO_DIR` overrides the scenarios directory
- `MAX_SCENARIOS` limits scenario-level concurrency (0 = unlimited)
- `CODEX_MODEL`, `CODEX_RUN_ARGS`, `CODEX_REVIEW_ARGS` control Codex
- `CLAUDE_CMD`, `CLAUDE_RUN_ARGS`, `CLAUDE_REVIEW_ARGS` control Claude

## Outputs

Runs are written under `comparison_testing/test_runs/<runner>/<timestamp>/<scenario>/` and include:

- `agents/run_XX.txt` and `agents/run_XX.log`
- `review_prompt.txt`
- `consolidated.md` and `consolidated.log`

The runners set their working/context directory to the scenario run folder, and prompts instruct agents to avoid writing files so outputs stay contained in `test_runs/`.

If you interrupt a run (Ctrl+C or termination), the scripts will kill any spawned processes to avoid strays.
