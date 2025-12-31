#!/usr/bin/env bash
set -euo pipefail

log() {
  local ts
  ts="$(date +"%Y-%m-%d %H:%M:%S")"
  echo "[${ts}] $*"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPARISON_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${COMPARISON_DIR}/.." && pwd)"
RUN_START_TIME="$(date +"%Y%m%d_%H%M%S")"
RUN_DIR="${COMPARISON_DIR}/test_runs/claude/${RUN_START_TIME}"
AGENTS_DIR="${RUN_DIR}/agents"
DEFAULT_PROMPT_PATH="${COMPARISON_DIR}/mcp_comparison_framework_v2.md"
REVIEW_TEMPLATE_PATH="${COMPARISON_DIR}/review_prompt.md"

CLAUDE_CMD="${CLAUDE_CMD:-claude}"
CLAUDE_RUN_ARGS_RAW="${CLAUDE_RUN_ARGS:-}"
CLAUDE_REVIEW_ARGS_RAW="${CLAUDE_REVIEW_ARGS:-}"

read -r -a CLAUDE_RUN_ARGS <<< "${CLAUDE_RUN_ARGS_RAW}"
read -r -a CLAUDE_REVIEW_ARGS <<< "${CLAUDE_REVIEW_ARGS_RAW}"

mkdir -p "${AGENTS_DIR}"

log "Stage: setup directories"

PROMPT_SOURCE_PATH=""
if [[ "${1:-}" == "-" ]]; then
  log "Stage: reading prompt from stdin"
  PROMPT_SOURCE_PATH="${RUN_DIR}/prompt_source.txt"
  cat > "${PROMPT_SOURCE_PATH}"
elif [[ "${1:-}" == "" ]]; then
  log "Stage: using default prompt file"
  PROMPT_SOURCE_PATH="${DEFAULT_PROMPT_PATH}"
else
  log "Stage: reading prompt from file"
  PROMPT_SOURCE_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
fi

if [[ ! -f "${PROMPT_SOURCE_PATH}" ]]; then
  echo "Prompt file not found: ${PROMPT_SOURCE_PATH}"
  exit 1
fi

PROMPT_PATH="${RUN_DIR}/prompt.txt"
awk '
  $0 ~ /^## Test Structure$/ { skipping=1; next }
  $0 ~ /^## MCP Systems Under Test$/ { skipping=0 }
  skipping==0 { print }
' "${PROMPT_SOURCE_PATH}" > "${PROMPT_PATH}"

log "Run directory: ${RUN_DIR}"
log "Prompt file: ${PROMPT_PATH}"
log "Claude trial model: claude-sonnet-4-5"
log "Claude synthesis model: claude-opus-4-5"

total_runs=10
pids=()
log "Stage: launching ${total_runs} parallel Claude runs"
for i in $(seq 1 "${total_runs}"); do
  run_id="$(printf "%02d" "${i}")"
  out_file="${AGENTS_DIR}/run_${run_id}.txt"
  log_file="${AGENTS_DIR}/run_${run_id}.log"
  trial_prompt="${AGENTS_DIR}/prompt_${run_id}.txt"
  sed "s/\\[N\\]/${i}/g" "${PROMPT_PATH}" > "${trial_prompt}"
  log "Starting run ${run_id}"
  "${CLAUDE_CMD}" --model "claude-sonnet-4-5" -p "$(cat "${trial_prompt}")" ${CLAUDE_RUN_ARGS[@]+"${CLAUDE_RUN_ARGS[@]}"} \
    > "${out_file}" 2> "${log_file}" &
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
  -e "s|{{RUNNER_NAME}}|Claude|g" \
  "${REVIEW_TEMPLATE_PATH}" > "${REVIEW_PROMPT_PATH}"
  
CONSOLIDATED_OUT="${RUN_DIR}/consolidated.txt"
CONSOLIDATED_LOG="${RUN_DIR}/consolidated.log"
log "Stage: running consolidation"
"${CLAUDE_CMD}" --model "claude-opus-4-5" -p "$(cat "${REVIEW_PROMPT_PATH}")" ${CLAUDE_REVIEW_ARGS[@]+"${CLAUDE_REVIEW_ARGS[@]}"} \
  > "${CONSOLIDATED_OUT}" 2> "${CONSOLIDATED_LOG}"

log "Stage: done"
log "Consolidated report: ${CONSOLIDATED_OUT}"
