#!/usr/bin/env bash
# prettier 格式化脚本（无 package.json / 无 npm 依赖，基于 npx）
#
# 用法:
#   bash scripts/format.sh          # 格式化 src/、src-firefox/、tests/
#   bash scripts/format.sh --check  # 只检查是否已格式化（供 CI / 人工使用）
set -euo pipefail
cd "$(dirname "$0")/.."

PRETTIER="npx --yes prettier@3.9.6"
TARGETS=(src src-firefox tests)

if [ "${1:-}" = "--check" ]; then
	exec $PRETTIER --check "${TARGETS[@]}"
fi

exec $PRETTIER --write "${TARGETS[@]}"
