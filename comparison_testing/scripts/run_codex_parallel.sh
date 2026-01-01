#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

log() {
  local ts
  ts="$(date +"%Y-%m-%d %H:%M:%S")"
  echo "[${ts}] $*"
}

cleanup_root() {
  local child_pids
  child_pids="$(jobs -pr)"
  if [[ -n "${child_pids}" ]]; then
    kill ${child_pids} 2>/dev/null || true
  fi
}

trap cleanup_root EXIT INT TERM

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPARISON_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
RUN_START_TIME="$(date +"%Y%m%d_%H%M%S")"
RUN_BASE_DIR="${COMPARISON_DIR}/test_runs/codex/${RUN_START_TIME}"
TEMPLATE_PROMPT_PATH="${COMPARISON_DIR}/templates/codex_prompt_template.md"
DEFAULT_SCENARIO_DIR="${COMPARISON_DIR}/scenarios"
REVIEW_TEMPLATE_PATH="${COMPARISON_DIR}/review_prompt.md"

CODEX_MODEL="${CODEX_MODEL:-}"
CODEX_RUN_THINKING="low"
CODEX_REVIEW_THINKING="high"
CODEX_RUN_ARGS_RAW="${CODEX_RUN_ARGS:-}"
CODEX_REVIEW_ARGS_RAW="${CODEX_REVIEW_ARGS:-}"
RUNS_PER_SCENARIO="${RUNS_PER_SCENARIO:-5}"
MAX_SCENARIOS="${MAX_SCENARIOS:-0}"

read -r -a CODEX_RUN_ARGS <<< "${CODEX_RUN_ARGS_RAW}"
read -r -a CODEX_REVIEW_ARGS <<< "${CODEX_REVIEW_ARGS_RAW}"

if [[ "${RUNS_PER_SCENARIO}" -lt 5 ]]; then
  log "RUNS_PER_SCENARIO=${RUNS_PER_SCENARIO} < 5; using 5"
  RUNS_PER_SCENARIO=5
fi

log "Stage: setup directories"

is_number() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

MAX_SCENARIOS_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-scenarios=*)
      MAX_SCENARIOS_ARG="${1#*=}"
      shift
      ;;
    --max-scenarios)
      shift
      MAX_SCENARIOS_ARG="${1:-}"
      shift || true
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [[ -n "${MAX_SCENARIOS_ARG}" ]]; then
  if ! is_number "${MAX_SCENARIOS_ARG}"; then
    echo "Invalid --max-scenarios value: ${MAX_SCENARIOS_ARG}"
    exit 1
  fi
  MAX_SCENARIOS="${MAX_SCENARIOS_ARG}"
fi

build_prompt_from_template() {
  local template_path="$1"
  local scenario_path="$2"
  local output_path="$3"

  awk -v scenario_file="${scenario_path}" '
    /{{TASK_SCENARIO}}/ {
      while ((getline line < scenario_file) > 0) {
        print line
      }
      close(scenario_file)
      next
    }
    { print }
  ' "${template_path}" > "${output_path}"
}

run_scenario() {
  local scenario_label="$1"
  local prompt_path="$2"
  local run_dir="$3"
  local total_runs="$4"

  local agents_dir="${run_dir}/agents"
  local context_dir="${run_dir}"
  local -a pids=()
  local completed_runs=0
  local REVIEW_PROMPT_PATH
  local CONSOLIDATED_OUT
  local CONSOLIDATED_LOG
  local -a codex_args
  local -a consolidation_args
  mkdir -p "${agents_dir}"

  cleanup_runs() {
    if [[ ${#pids[@]} -gt 0 ]]; then
      kill "${pids[@]}" 2>/dev/null || true
    fi
  }

  trap cleanup_runs EXIT INT TERM

  log "Scenario: ${scenario_label}"
  log "Run directory: ${run_dir}"
  log "Prompt file: ${prompt_path}"
  if [[ -n "${CODEX_MODEL}" ]]; then
    log "Codex model: ${CODEX_MODEL}"
  fi
  log "Codex thinking (runs): ${CODEX_RUN_THINKING}"
  log "Codex thinking (review): ${CODEX_REVIEW_THINKING}"

  log "Stage: launching ${total_runs} parallel codex runs"
  for i in $(seq 1 "${total_runs}"); do
    run_id="$(printf "%02d" "${i}")"
    out_file="${agents_dir}/run_${run_id}.txt"
    log_file="${agents_dir}/run_${run_id}.log"
    log "Starting run ${run_id}"
    codex_args=()
    codex_args+=("exec" "-")
    codex_args+=("-C" "${context_dir}")
    if [[ -n "${CODEX_MODEL}" ]]; then
      codex_args+=("--model" "${CODEX_MODEL}")
    fi
    codex_args+=("--config" "thinking=${CODEX_RUN_THINKING}")
    codex_args+=("--output-last-message" "${out_file}")
    if [[ ${#CODEX_RUN_ARGS[@]} -gt 0 ]]; then
      codex_args+=("${CODEX_RUN_ARGS[@]}")
    fi
    codex "${codex_args[@]}" \
      < "${prompt_path}" \
      > "${log_file}" 2>&1 &
    pids+=("$!")
  done

  log "Stage: waiting for runs to complete"
  for pid in "${pids[@]}"; do
    wait "${pid}"
    completed_runs=$((completed_runs + 1))
    log "Progress: ${completed_runs}/${total_runs} runs completed"
  done
  log "Stage: all runs completed"

  REVIEW_PROMPT_PATH="${run_dir}/review_prompt.txt"
  log "Stage: preparing consolidation prompt"
  if [[ ! -f "${REVIEW_TEMPLATE_PATH}" ]]; then
    echo "Review prompt template not found: ${REVIEW_TEMPLATE_PATH}"
    exit 1
  fi
  sed -e "s|{{AGENTS_DIR}}|${agents_dir}|g" \
    -e "s|{{RUN_COUNT}}|${total_runs}|g" \
    -e "s|{{RUNNER_NAME}}|Codex|g" \
    "${REVIEW_TEMPLATE_PATH}" > "${REVIEW_PROMPT_PATH}"

  CONSOLIDATED_OUT="${run_dir}/consolidated.md"
  CONSOLIDATED_LOG="${run_dir}/consolidated.log"
  log "Stage: running consolidation"
  consolidation_args=()
  consolidation_args+=("exec" "-")
  consolidation_args+=("-C" "${context_dir}")
  if [[ -n "${CODEX_MODEL}" ]]; then
    consolidation_args+=("--model" "${CODEX_MODEL}")
  fi
  consolidation_args+=("--config" "thinking=${CODEX_REVIEW_THINKING}")
  consolidation_args+=("--output-last-message" "${CONSOLIDATED_OUT}")
  if [[ ${#CODEX_REVIEW_ARGS[@]} -gt 0 ]]; then
    consolidation_args+=("${CODEX_REVIEW_ARGS[@]}")
  fi
  codex "${consolidation_args[@]}" \
    < "${REVIEW_PROMPT_PATH}" \
    > "${CONSOLIDATED_LOG}" 2>&1

  log "Stage: done"
  log "Consolidated report: ${CONSOLIDATED_OUT}"
}

PROMPT_ARG="${1:-}"

if [[ "${PROMPT_ARG}" == "-" ]]; then
  RUN_DIR="${RUN_BASE_DIR}/stdin"
  log "Stage: reading prompt from stdin"
  PROMPT_PATH="${RUN_DIR}/prompt.txt"
  mkdir -p "${RUN_DIR}"
  cat > "${PROMPT_PATH}"
  run_scenario "stdin" "${PROMPT_PATH}" "${RUN_DIR}" "${RUNS_PER_SCENARIO}"
  exit 0
fi

if [[ "${PROMPT_ARG}" != "" ]]; then
  RUN_DIR="${RUN_BASE_DIR}/custom"
  log "Stage: reading prompt from file"
  PROMPT_PATH="$(cd "$(dirname "${PROMPT_ARG}")" && pwd)/$(basename "${PROMPT_ARG}")"
  if [[ ! -f "${PROMPT_PATH}" ]]; then
    echo "Prompt file not found: ${PROMPT_PATH}"
    exit 1
  fi
  mkdir -p "${RUN_DIR}"
  cp "${PROMPT_PATH}" "${RUN_DIR}/prompt.txt"
  run_scenario "custom" "${RUN_DIR}/prompt.txt" "${RUN_DIR}" "${RUNS_PER_SCENARIO}"
  exit 0
fi

SCENARIO_DIR="${SCENARIO_DIR:-${DEFAULT_SCENARIO_DIR}}"
if [[ ! -d "${SCENARIO_DIR}" ]]; then
  echo "Scenario directory not found: ${SCENARIO_DIR}"
  exit 1
fi
if [[ ! -f "${TEMPLATE_PROMPT_PATH}" ]]; then
  echo "Template prompt not found: ${TEMPLATE_PROMPT_PATH}"
  exit 1
fi

scenario_files=("${SCENARIO_DIR}"/*.md)
if [[ ${#scenario_files[@]} -eq 0 ]]; then
  echo "No scenario files found in ${SCENARIO_DIR}"
  exit 1
fi

scenario_pids=()
scenario_names=()

wait_for_scenario_slot() {
  if [[ "${MAX_SCENARIOS}" -le 0 ]]; then
    return 0
  fi
  while [[ ${#scenario_pids[@]} -ge "${MAX_SCENARIOS}" ]]; do
    local pid="${scenario_pids[0]}"
    local name="${scenario_names[0]}"
    wait "${pid}"
    log "Scenario completed: ${name}"
    scenario_pids=("${scenario_pids[@]:1}")
    scenario_names=("${scenario_names[@]:1}")
  done
}

for scenario_path in "${scenario_files[@]}"; do
  scenario_name="$(basename "${scenario_path}" .md)"
  RUN_DIR="${RUN_BASE_DIR}/${scenario_name}"
  mkdir -p "${RUN_DIR}"
  PROMPT_PATH="${RUN_DIR}/prompt.txt"
  build_prompt_from_template "${TEMPLATE_PROMPT_PATH}" "${scenario_path}" "${PROMPT_PATH}"
  run_scenario "${scenario_name}" "${PROMPT_PATH}" "${RUN_DIR}" "${RUNS_PER_SCENARIO}" &
  scenario_pids+=("$!")
  scenario_names+=("${scenario_name}")
  wait_for_scenario_slot
done

completed_scenarios=0
total_scenarios=${#scenario_pids[@]}
while [[ ${#scenario_pids[@]} -gt 0 ]]; do
  pid="${scenario_pids[0]}"
  name="${scenario_names[0]}"
  wait "${pid}"
  completed_scenarios=$((completed_scenarios + 1))
  log "Scenario completed: ${name} (${completed_scenarios}/${total_scenarios})"
  scenario_pids=("${scenario_pids[@]:1}")
  scenario_names=("${scenario_names[@]:1}")
done
