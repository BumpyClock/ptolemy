#!/usr/bin/env bash
set -euo pipefail

log() {
  local ts
  ts="$(date +"%Y-%m-%d %H:%M:%S")"
  echo "[${ts}] $*"
}

if [[ "${1:-}" == "" ]]; then
  echo "Usage: $0 <prompt-file>|-"
  echo "  Provide a prompt file path, or '-' to read prompt from stdin"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPARISON_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${COMPARISON_DIR}/.." && pwd)"
RUN_START_TIME="$(date +"%Y%m%d_%H%M%S")"
RUN_DIR="${COMPARISON_DIR}/test_runs/codex/${RUN_START_TIME}"
AGENTS_DIR="${RUN_DIR}/agents"
REVIEW_TEMPLATE_PATH="${COMPARISON_DIR}/review_prompt.md"

CODEX_MODEL="${CODEX_MODEL:-}"
CODEX_RUN_THINKING="medium"
CODEX_REVIEW_THINKING="high"
CODEX_RUN_ARGS_RAW="${CODEX_RUN_ARGS:-}"
CODEX_REVIEW_ARGS_RAW="${CODEX_REVIEW_ARGS:-}"

read -r -a CODEX_RUN_ARGS <<< "${CODEX_RUN_ARGS_RAW}"
read -r -a CODEX_REVIEW_ARGS <<< "${CODEX_REVIEW_ARGS_RAW}"

mkdir -p "${AGENTS_DIR}"

log "Stage: setup directories"

PROMPT_PATH=""
if [[ "$1" == "-" ]]; then
  log "Stage: reading prompt from stdin"
  PROMPT_PATH="${RUN_DIR}/prompt.txt"
  cat > "${PROMPT_PATH}"
else
  log "Stage: reading prompt from file"
  PROMPT_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
  if [[ ! -f "${PROMPT_PATH}" ]]; then
    echo "Prompt file not found: ${PROMPT_PATH}"
    exit 1
  fi
  cp "${PROMPT_PATH}" "${RUN_DIR}/prompt.txt"
  PROMPT_PATH="${RUN_DIR}/prompt.txt"
fi

log "Run directory: ${RUN_DIR}"
log "Prompt file: ${PROMPT_PATH}"
if [[ -n "${CODEX_MODEL}" ]]; then
  log "Codex model: ${CODEX_MODEL}"
fi
log "Codex thinking (runs): ${CODEX_RUN_THINKING}"
log "Codex thinking (review): ${CODEX_REVIEW_THINKING}"

total_runs=10
pids=()
log "Stage: launching ${total_runs} parallel codex runs"
for i in $(seq 1 "${total_runs}"); do
  run_id="$(printf "%02d" "${i}")"
  out_file="${AGENTS_DIR}/run_${run_id}.txt"
  log_file="${AGENTS_DIR}/run_${run_id}.log"
  log "Starting run ${run_id}"
  codex_args=()
  codex_args+=("exec" "-")
  codex_args+=("-C" "${ROOT_DIR}")
  if [[ -n "${CODEX_MODEL}" ]]; then
    codex_args+=("--model" "${CODEX_MODEL}")
  fi
  codex_args+=("--config" "thinking=${CODEX_RUN_THINKING}")
  codex_args+=("--output-last-message" "${out_file}")
  codex_args+=(${CODEX_RUN_ARGS[@]+"${CODEX_RUN_ARGS[@]}"})
  codex "${codex_args[@]}" \
    < "${PROMPT_PATH}" \
    > "${log_file}" 2>&1 &
  pids+=("$!")
done

log "Stage: waiting for runs to complete"
completed_runs=0
for pid in "${pids[@]}"; do
  wait "${pid}"
  completed_runs=$((completed_runs + 1))
  log "Progress: ${completed_runs}/${total_runs} runs completed"
done
log "Stage: all runs completed"

REVIEW_PROMPT_PATH="${RUN_DIR}/review_prompt.txt"
log "Stage: preparing consolidation prompt"
if [[ ! -f "${REVIEW_TEMPLATE_PATH}" ]]; then
  echo "Review prompt template not found: ${REVIEW_TEMPLATE_PATH}"
  exit 1
fi
sed -e "s|{{AGENTS_DIR}}|${AGENTS_DIR}|g" \
  -e "s|{{RUN_COUNT}}|${total_runs}|g" \
  -e "s|{{RUNNER_NAME}}|Codex|g" \
  "${REVIEW_TEMPLATE_PATH}" > "${REVIEW_PROMPT_PATH}"

CONSOLIDATED_OUT="${RUN_DIR}/consolidated.txt"
CONSOLIDATED_LOG="${RUN_DIR}/consolidated.log"
log "Stage: running consolidation"
consolidation_args=()
consolidation_args+=("exec" "-")
consolidation_args+=("-C" "${ROOT_DIR}")
if [[ -n "${CODEX_MODEL}" ]]; then
  consolidation_args+=("--model" "${CODEX_MODEL}")
fi
consolidation_args+=("--config" "thinking=${CODEX_REVIEW_THINKING}")
consolidation_args+=("--output-last-message" "${CONSOLIDATED_OUT}")
consolidation_args+=(${CODEX_REVIEW_ARGS[@]+"${CODEX_REVIEW_ARGS[@]}"})
codex "${consolidation_args[@]}" \
  < "${REVIEW_PROMPT_PATH}" \
  > "${CONSOLIDATED_LOG}" 2>&1

log "Stage: done"
log "Consolidated report: ${CONSOLIDATED_OUT}"
