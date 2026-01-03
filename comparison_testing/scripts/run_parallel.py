#!/usr/bin/env -S uv run --script
# /// script
# dependencies = ["rich>=13.7.0"]
# ///
"""Unified runner for comparison scenarios with rich progress UI."""

from __future__ import annotations

import argparse
import asyncio
import os
import signal
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Optional

from rich.console import Console
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)

console = Console()


@dataclass(frozen=True)
class RunnerConfig:
    runner: str
    runs_per_scenario: int
    max_scenarios: int
    scenario_dir: Path
    template_path: Path
    review_template_path: Path
    final_review_template_path: Path
    run_base_dir: Path
    claude_cmd: str
    claude_run_args: list[str]
    claude_review_args: list[str]
    claude_trial_model: str
    claude_synthesis_model: str
    codex_model: str
    codex_run_args: list[str]
    codex_review_args: list[str]
    codex_run_thinking: str
    codex_review_thinking: str


@dataclass
class Scenario:
    name: str
    source_path: Path
    run_dir: Path


class ProcessTracker:
    def __init__(self) -> None:
        self._procs: set[asyncio.subprocess.Process] = set()

    def add(self, proc: asyncio.subprocess.Process) -> None:
        self._procs.add(proc)

    def discard(self, proc: asyncio.subprocess.Process) -> None:
        self._procs.discard(proc)

    def kill_all_immediate(self) -> None:
        """Synchronous immediate kill for signal handlers."""
        for proc in list(self._procs):
            if proc.returncode is None:
                try:
                    proc.kill()
                except (ProcessLookupError, OSError):
                    pass

    async def terminate_all(self) -> None:
        if not self._procs:
            return
        for proc in list(self._procs):
            if proc.returncode is None:
                try:
                    proc.terminate()
                except ProcessLookupError:
                    pass
        await asyncio.sleep(0.1)
        for proc in list(self._procs):
            if proc.returncode is None:
                try:
                    proc.kill()
                except ProcessLookupError:
                    pass


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run comparison scenarios with progress UI")
    parser.add_argument("--runner", choices=["claude", "codex"], required=True)
    parser.add_argument("--prompt-file", type=Path, default=None)
    parser.add_argument("--stdin", action="store_true")
    parser.add_argument("--max-scenarios", type=int, default=None)
    parser.add_argument("--runs-per-scenario", type=int, default=None)
    parser.add_argument("--scenario-dir", type=Path, default=None)
    parser.add_argument("legacy", nargs="?", help="Use '-' for stdin (compat)")
    return parser.parse_args(argv)


def parse_args_list(raw: str) -> list[str]:
    return [arg for arg in raw.split(" ") if arg]


def build_config(args: argparse.Namespace, comparison_dir: Path) -> RunnerConfig:
    runs_per_scenario = args.runs_per_scenario or int(os.getenv("RUNS_PER_SCENARIO", "5"))
    if runs_per_scenario < 5:
        console.print(f"[yellow]RUNS_PER_SCENARIO={runs_per_scenario} < 5; using 5[/yellow]")
        runs_per_scenario = 5

    max_scenarios = args.max_scenarios
    if max_scenarios is None:
        max_scenarios = int(os.getenv("MAX_SCENARIOS", "0"))

    scenario_dir = args.scenario_dir or Path(os.getenv("SCENARIO_DIR", comparison_dir / "scenarios"))

    template_path = comparison_dir / "templates" / f"{args.runner}_prompt_template.md"
    review_template_path = comparison_dir / "review_prompt.md"
    final_review_template_path = comparison_dir / "final_review_prompt.md"

    run_base_dir = comparison_dir / "test_runs" / args.runner / datetime.now().strftime("%Y%m%d_%H%M%S")

    return RunnerConfig(
        runner=args.runner,
        runs_per_scenario=runs_per_scenario,
        max_scenarios=max_scenarios,
        scenario_dir=Path(scenario_dir),
        template_path=template_path,
        review_template_path=review_template_path,
        final_review_template_path=final_review_template_path,
        run_base_dir=run_base_dir,
        claude_cmd=os.getenv("CLAUDE_CMD", "cz"),
        claude_run_args=parse_args_list(os.getenv("CLAUDE_RUN_ARGS", "")),
        claude_review_args=parse_args_list(os.getenv("CLAUDE_REVIEW_ARGS", "")),
        claude_trial_model=os.getenv("CLAUDE_TRIAL_MODEL", "claude-sonnet-4-5"),
        claude_synthesis_model=os.getenv("CLAUDE_SYNTHESIS_MODEL", "claude-sonnet-4-5"),
        codex_model=os.getenv("CODEX_MODEL", "gpt-5.1-codex-mini"),
        codex_run_args=parse_args_list(os.getenv("CODEX_RUN_ARGS", "")),
        codex_review_args=parse_args_list(os.getenv("CODEX_REVIEW_ARGS", "")),
        codex_run_thinking=os.getenv("CODEX_RUN_THINKING", "medium"),
        codex_review_thinking=os.getenv("CODEX_REVIEW_THINKING", "high"),
    )


def strip_test_structure(text: str) -> str:
    lines = text.splitlines()
    output: list[str] = []
    skipping = False
    for line in lines:
        if line.startswith("## Test Structure"):
            skipping = True
            continue
        if line.startswith("## MCP Systems Under Test"):
            skipping = False
        if not skipping:
            output.append(line)
    return "\n".join(output) + ("\n" if text.endswith("\n") else "")


def build_prompt_from_template(template: str, scenario: str) -> str:
    return template.replace("{{TASK_SCENARIO}}", scenario)


def build_review_prompt(template: str, agents_dir: Path, run_count: int, runner_name: str) -> str:
    run_files = sorted(agents_dir.glob("run_*.md"))
    concatenated_runs: list[str] = []
    for run_file in run_files:
        try:
            content = run_file.read_text()
            concatenated_runs.append(f"## {run_file.stem}\n\n{content}\n")
        except Exception:
            concatenated_runs.append(f"## {run_file.stem}\n\n[Error reading file]\n")
    
    runs_content = "\n---\n\n".join(concatenated_runs) if concatenated_runs else "[No run files found]"
    
    return (
        template.replace("{{AGENTS_DIR}}", str(agents_dir))
        .replace("{{RUN_COUNT}}", str(run_count))
        .replace("{{RUNNER_NAME}}", runner_name)
        .replace("{{RUNS_CONTENT}}", runs_content)
    )


def build_final_review_prompt(template: str, scenarios: list[Scenario], runner_name: str) -> str:
    concatenated_consolidated: list[str] = []
    for scenario in scenarios:
        consolidated_path = scenario.run_dir / "consolidated.md"
        try:
            if consolidated_path.exists():
                content = consolidated_path.read_text()
                concatenated_consolidated.append(f"## {scenario.name}\n\n{content}\n")
            else:
                concatenated_consolidated.append(f"## {scenario.name}\n\n[Consolidated report not found]\n")
        except Exception:
            concatenated_consolidated.append(f"## {scenario.name}\n\n[Error reading consolidated report]\n")
    
    consolidated_content = "\n---\n\n".join(concatenated_consolidated) if concatenated_consolidated else "[No consolidated reports found]"
    
    return (
        template.replace("{{SCENARIO_COUNT}}", str(len(scenarios)))
        .replace("{{RUNNER_NAME}}", runner_name)
        .replace("{{CONSOLIDATED_CONTENT}}", consolidated_content)
    )


def load_scenarios(config: RunnerConfig) -> list[Scenario]:
    if not config.scenario_dir.exists():
        raise FileNotFoundError(f"Scenario directory not found: {config.scenario_dir}")

    scenario_files = sorted(config.scenario_dir.glob("*.md"))
    if not scenario_files:
        raise FileNotFoundError(f"No scenario files found in {config.scenario_dir}")

    return [
        Scenario(
            name=path.stem,
            source_path=path,
            run_dir=config.run_base_dir / path.stem,
        )
        for path in scenario_files
    ]


async def run_subprocess(
    cmd: list[str],
    stdin_text: Optional[str],
    stdout_path: Path,
    stderr_path: Path,
    tracker: ProcessTracker,
    cwd: Optional[Path] = None,
) -> int:
    stdout_path.parent.mkdir(parents=True, exist_ok=True)
    stderr_path.parent.mkdir(parents=True, exist_ok=True)
    if stdout_path == stderr_path:
        stdout_file = stdout_path.open("w")
        stderr_file = stdout_file
    else:
        stdout_file = stdout_path.open("w")
        stderr_file = stderr_path.open("w")
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if stdin_text is not None else None,
            stdout=stdout_file,
            stderr=stderr_file,
            cwd=str(cwd) if cwd is not None else None,
        )
        tracker.add(proc)
        if stdin_text is not None:
            assert proc.stdin is not None
            proc.stdin.write(stdin_text.encode("utf-8"))
            await proc.stdin.drain()
            proc.stdin.close()
        return_code = await proc.wait()
        tracker.discard(proc)
        return return_code
    finally:
        stdout_file.close()
        if stderr_file is not stdout_file:
            stderr_file.close()


async def run_trial(
    config: RunnerConfig,
    prompt_text: str,
    run_dir: Path,
    run_id: int,
    tracker: ProcessTracker,
) -> None:
    agents_dir = run_dir / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)

    run_id_str = f"{run_id:02d}"
    trial_prompt_path = agents_dir / f"prompt_{run_id_str}.txt"
    out_path = agents_dir / f"run_{run_id_str}.md"
    log_path = agents_dir / f"run_{run_id_str}.log"
    trial_prompt_text = prompt_text.replace("[N]", str(run_id))
    trial_prompt_path.write_text(trial_prompt_text)

    if config.runner == "claude":
        cmd = [config.claude_cmd, "--model", config.claude_trial_model, "-p", trial_prompt_text]
        cmd.extend(config.claude_run_args)
        await run_subprocess(cmd, None, out_path, log_path, tracker, cwd=run_dir)
        return

    cmd = [
        "codex",
        "exec",
        "-",
        "-C",
        str(run_dir),
        "-c",
        f"model_reasoning_effort={config.codex_run_thinking}",
        "--output-last-message",
        str(out_path),
    ]
    if config.codex_model:
        cmd.extend(["--model", config.codex_model])
    cmd.extend(config.codex_run_args)
    await run_subprocess(cmd, trial_prompt_text, log_path, log_path, tracker, cwd=run_dir)


async def run_consolidation(
    config: RunnerConfig,
    review_prompt: str,
    run_dir: Path,
    tracker: ProcessTracker,
) -> None:
    out_path = run_dir / "consolidated.md"
    log_path = run_dir / "consolidated.log"

    if config.runner == "claude":
        cmd = [config.claude_cmd, "--model", config.claude_synthesis_model, "-p", review_prompt]
        cmd.extend(config.claude_review_args)
        await run_subprocess(cmd, None, out_path, log_path, tracker, cwd=run_dir)
        return

    cmd = [
        "codex",
        "exec",
        "-",
        "-C",
        str(run_dir),
        "-c",
        f"model_reasoning_effort={config.codex_review_thinking}",
        "--output-last-message",
        str(out_path),
    ]
    if config.codex_model:
        cmd.extend(["--model", config.codex_model])
    cmd.extend(config.codex_review_args)
    await run_subprocess(cmd, review_prompt, log_path, log_path, tracker, cwd=run_dir)


async def run_scenario(
    config: RunnerConfig,
    scenario: Scenario,
    progress: Progress,
    progress_task: int,
    overall_task: int,
    tracker: ProcessTracker,
) -> None:
    scenario.run_dir.mkdir(parents=True, exist_ok=True)
    agents_dir = scenario.run_dir / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)

    template_text = config.template_path.read_text()
    scenario_text = scenario.source_path.read_text()
    prompt_source = build_prompt_from_template(template_text, scenario_text)
    prompt_source_path = scenario.run_dir / "prompt_source.txt"
    prompt_source_path.write_text(prompt_source)

    if config.runner == "claude":
        prompt_text = strip_test_structure(prompt_source)
    else:
        prompt_text = prompt_source

    prompt_path = scenario.run_dir / "prompt.txt"
    prompt_path.write_text(prompt_text)

    progress.update(progress_task, description=f"{scenario.name} (running)")

    tasks = [
        asyncio.create_task(run_trial(config, prompt_text, scenario.run_dir, i + 1, tracker))
        for i in range(config.runs_per_scenario)
    ]

    for task in asyncio.as_completed(tasks):
        await task
        progress.advance(progress_task, 1)
        progress.advance(overall_task, 1)

    review_template = config.review_template_path.read_text()
    review_prompt = build_review_prompt(
        review_template,
        agents_dir,
        config.runs_per_scenario,
        "Claude" if config.runner == "claude" else "Codex",
    )
    review_prompt_path = scenario.run_dir / "review_prompt.txt"
    review_prompt_path.write_text(review_prompt)

    progress.update(progress_task, description=f"{scenario.name} (consolidating)")
    await run_consolidation(config, review_prompt, scenario.run_dir, tracker)
    progress.advance(progress_task, 1)
    progress.advance(overall_task, 1)

    progress.update(progress_task, description=f"{scenario.name} (done)")


async def run_with_concurrency(
    config: RunnerConfig,
    scenarios: Iterable[Scenario],
) -> None:
    tracker = ProcessTracker()
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def handle_signal() -> None:
        stop_event.set()
        tracker.kill_all_immediate()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except NotImplementedError:
            signal.signal(sig, lambda _signum, _frame: handle_signal())

    max_scenarios = config.max_scenarios
    scenario_list = list(scenarios)
    total_steps = len(scenario_list) * (config.runs_per_scenario + 1) + 1

    progress = Progress(
        SpinnerColumn(),
        TextColumn("{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
        console=console,
    )

    overall_task = progress.add_task("all scenarios", total=total_steps)

    async def scenario_runner(scenario: Scenario) -> None:
        scenario_task = progress.add_task(
            f"{scenario.name} (pending)", total=config.runs_per_scenario + 1
        )
        await run_scenario(config, scenario, progress, scenario_task, overall_task, tracker)
        progress.update(scenario_task, description=f"{scenario.name} (done)")

    with progress:
        if max_scenarios <= 0:
            tasks = [asyncio.create_task(scenario_runner(s)) for s in scenario_list]
            while tasks:
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                if stop_event.is_set():
                    for task in pending:
                        task.cancel()
                    await tracker.terminate_all()
                    return
                tasks = list(pending)
        else:
            sem = asyncio.Semaphore(max_scenarios)

            async def run_with_sem(scenario: Scenario) -> None:
                async with sem:
                    await scenario_runner(scenario)

            tasks = [asyncio.create_task(run_with_sem(s)) for s in scenario_list]
            while tasks:
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                if stop_event.is_set():
                    for task in pending:
                        task.cancel()
                    await tracker.terminate_all()
                    return
                tasks = list(pending)

        if stop_event.is_set():
            await tracker.terminate_all()
            return

        final_task = progress.add_task("final cross-scenario analysis", total=1)
        progress.update(final_task, description="final cross-scenario analysis (running)")
        
        final_review_template = config.final_review_template_path.read_text()
        final_review_prompt = build_final_review_prompt(
            final_review_template,
            scenario_list,
            "Claude" if config.runner == "claude" else "Codex",
        )
        final_review_prompt_path = config.run_base_dir / "final_review_prompt.txt"
        final_review_prompt_path.write_text(final_review_prompt)
        
        final_out_path = config.run_base_dir / "final_consolidated.md"
        final_log_path = config.run_base_dir / "final_consolidated.log"
        
        if config.runner == "claude":
            cmd = [config.claude_cmd, "--model", config.claude_synthesis_model, "-p", final_review_prompt]
            cmd.extend(config.claude_review_args)
            await run_subprocess(cmd, None, final_out_path, final_log_path, tracker, cwd=config.run_base_dir)
        else:
            cmd = [
                "codex",
                "exec",
                "-",
                "-C",
                str(config.run_base_dir),
                "-c",
                f"model_reasoning_effort={config.codex_review_thinking}",
                "--output-last-message",
                str(final_out_path),
            ]
            if config.codex_model:
                cmd.extend(["--model", config.codex_model])
            cmd.extend(config.codex_review_args)
            await run_subprocess(cmd, final_review_prompt, final_log_path, final_log_path, tracker, cwd=config.run_base_dir)
        
        progress.advance(final_task, 1)
        progress.advance(overall_task, 1)
        progress.update(final_task, description="final cross-scenario analysis (done)")


async def run_single_prompt(config: RunnerConfig, prompt_text: str, run_dir: Path) -> None:
    tracker = ProcessTracker()
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def handle_signal() -> None:
        stop_event.set()
        tracker.kill_all_immediate()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except NotImplementedError:
            signal.signal(sig, lambda _signum, _frame: handle_signal())

    run_dir.mkdir(parents=True, exist_ok=True)
    agents_dir = run_dir / "agents"
    agents_dir.mkdir(parents=True, exist_ok=True)

    prompt_path = run_dir / "prompt.txt"
    prompt_path.write_text(prompt_text)

    progress = Progress(
        SpinnerColumn(),
        TextColumn("{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
        console=console,
    )

    task_id = progress.add_task("runs", total=config.runs_per_scenario + 1)

    with progress:
        tasks = [
            asyncio.create_task(run_trial(config, prompt_text, run_dir, i + 1, tracker))
            for i in range(config.runs_per_scenario)
        ]
        for task in asyncio.as_completed(tasks):
            await task
            progress.advance(task_id, 1)
            if stop_event.is_set():
                for pending in tasks:
                    pending.cancel()
                await tracker.terminate_all()
                return

        review_template = config.review_template_path.read_text()
        review_prompt = build_review_prompt(
            review_template,
            agents_dir,
            config.runs_per_scenario,
            "Claude" if config.runner == "claude" else "Codex",
        )
        review_prompt_path = run_dir / "review_prompt.txt"
        review_prompt_path.write_text(review_prompt)

        if stop_event.is_set():
            await tracker.terminate_all()
            return

        await run_consolidation(config, review_prompt, run_dir, tracker)
        progress.advance(task_id, 1)


def read_stdin() -> str:
    return sys.stdin.read()


def normalize_prompt_text(config: RunnerConfig, text: str) -> str:
    if config.runner == "claude":
        return strip_test_structure(text)
    return text


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    comparison_dir = Path(__file__).resolve().parents[1]
    config = build_config(args, comparison_dir)

    if not config.template_path.exists():
        console.print(f"[red]Template prompt not found: {config.template_path}[/red]")
        return 1

    if not config.review_template_path.exists():
        console.print(f"[red]Review prompt template not found: {config.review_template_path}[/red]")
        return 1

    if args.stdin and args.prompt_file:
        console.print("[red]Use only one of --stdin or --prompt-file[/red]")
        return 1

    if args.legacy and not args.stdin and not args.prompt_file:
        if args.legacy == "-":
            args.stdin = True
        else:
            args.prompt_file = Path(args.legacy)

    if args.stdin:
        run_dir = config.run_base_dir / "stdin"
        prompt_text = normalize_prompt_text(config, read_stdin())
        asyncio.run(run_single_prompt(config, prompt_text, run_dir))
        return 0

    if args.prompt_file:
        if not args.prompt_file.exists():
            console.print(f"[red]Prompt file not found: {args.prompt_file}[/red]")
            return 1
        run_dir = config.run_base_dir / "custom"
        prompt_text = normalize_prompt_text(config, args.prompt_file.read_text())
        asyncio.run(run_single_prompt(config, prompt_text, run_dir))
        return 0

    if not config.final_review_template_path.exists():
        console.print(f"[red]Final review prompt template not found: {config.final_review_template_path}[/red]")
        return 1

    scenarios = load_scenarios(config)
    asyncio.run(run_with_concurrency(config, scenarios))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
