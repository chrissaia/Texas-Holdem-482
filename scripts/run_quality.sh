#!/usr/bin/env bash
# Purpose: run full application checks and export measured coverage evidence.
set -euo pipefail
RIVR_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RIVR_PYTHON="${RIVR_PYTHON:-$RIVR_ROOT/backend/.venv/bin/python}"
cd "$RIVR_ROOT/backend"
"$RIVR_PYTHON" manage.py check
"$RIVR_PYTHON" manage.py makemigrations --check --dry-run
"$RIVR_PYTHON" -m pytest --junitxml=test-results.xml --cov --cov-report=term-missing --cov-report=json --cov-report=xml --cov-report=html
cd "$RIVR_ROOT"
npm --prefix frontend run test:coverage -- --reporter=default --reporter=junit --outputFile=coverage/test-results.xml
npm --prefix frontend run build
npm --prefix frontend run lint
"$RIVR_PYTHON" scripts/export_coverage.py
