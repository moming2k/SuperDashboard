#!/bin/bash

# SuperDashboard AI Code Review Pre-commit Hook
# This script runs AI-powered code review on staged files before commit
#
# Installation:
#   1. Make this script executable: chmod +x pre-commit-hook.sh
#   2. Copy to .git/hooks/pre-commit: cp pre-commit-hook.sh .git/hooks/pre-commit
#   3. Ensure SuperDashboard backend is running on http://localhost:8000
#
# Configuration:
#   Set SKIP_CODE_REVIEW=1 to bypass the check: SKIP_CODE_REVIEW=1 git commit
#   Set CODE_REVIEW_SEVERITY=critical to only block on critical issues

set -e

# Configuration
API_BASE="${CODE_REVIEW_API:-http://localhost:8000}"
SEVERITY_THRESHOLD="${CODE_REVIEW_SEVERITY:-high}"  # critical, high, medium, low
SKIP="${SKIP_CODE_REVIEW:-0}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Skip if requested
if [ "$SKIP" = "1" ]; then
    echo -e "${YELLOW}⚠ Code review skipped (SKIP_CODE_REVIEW=1)${NC}"
    exit 0
fi

# Check if backend is running
if ! curl -s -o /dev/null -w "%{http_code}" "$API_BASE/plugins/code-review/health" | grep -q "200"; then
    echo -e "${YELLOW}⚠ Code review backend not available at $API_BASE${NC}"
    echo -e "${YELLOW}  Skipping pre-commit review. Start SuperDashboard backend or set SKIP_CODE_REVIEW=1${NC}"
    exit 0
fi

echo -e "${BLUE}🔍 Running AI Code Review on staged files...${NC}"

# Get list of staged files (excluding deletions)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No files to review${NC}"
    exit 0
fi

# Prepare JSON payload
JSON_FILES="["
FIRST=true

for FILE in $STAGED_FILES; do
    # Skip binary files, images, etc.
    if file "$FILE" | grep -q "text"; then
        CONTENT=$(git show ":$FILE" | jq -Rs .)
        FILENAME=$(echo "$FILE" | jq -Rs . | sed 's/"$//' | sed 's/^"//')

        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            JSON_FILES="$JSON_FILES,"
        fi

        JSON_FILES="$JSON_FILES{\"filename\":\"$FILENAME\",\"content\":$CONTENT}"
    fi
done

JSON_FILES="$JSON_FILES]"

# Skip if no text files
if [ "$JSON_FILES" = "[]" ]; then
    echo -e "${GREEN}✓ No text files to review${NC}"
    exit 0
fi

# Call API
RESPONSE=$(curl -s -X POST "$API_BASE/plugins/code-review/precommit-check" \
    -H "Content-Type: application/json" \
    -d "{\"files\": $JSON_FILES}")

# Parse response
PASSED=$(echo "$RESPONSE" | jq -r '.passed')
TOTAL_ISSUES=$(echo "$RESPONSE" | jq -r '.total_issues')
CRITICAL_ISSUES=$(echo "$RESPONSE" | jq -r '.critical_issues')
SUMMARY=$(echo "$RESPONSE" | jq -r '.summary')

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Code Review Results${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "$SUMMARY"
echo ""
echo "Total Issues: $TOTAL_ISSUES"
echo "Critical Issues: $CRITICAL_ISSUES"
echo ""

# Display issues by file
FILE_REVIEWS=$(echo "$RESPONSE" | jq -r '.file_reviews')

echo "$RESPONSE" | jq -r '
.file_reviews | to_entries[] |
"File: \(.key)\nScore: \(.value.score)/100\n" +
(.value.issues[] | "  [\(.severity | ascii_upcase)] \(.category): \(.message)\n") + ""
'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Determine if commit should be blocked
SHOULD_BLOCK=false

case "$SEVERITY_THRESHOLD" in
    critical)
        if [ "$CRITICAL_ISSUES" -gt 0 ]; then
            SHOULD_BLOCK=true
        fi
        ;;
    high)
        if [ "$PASSED" = "false" ]; then
            SHOULD_BLOCK=true
        fi
        ;;
    medium|low)
        # More lenient - could customize based on total issues
        if [ "$CRITICAL_ISSUES" -gt 0 ]; then
            SHOULD_BLOCK=true
        fi
        ;;
esac

if [ "$SHOULD_BLOCK" = true ]; then
    echo ""
    echo -e "${RED}✗ Commit blocked due to code review issues${NC}"
    echo -e "${YELLOW}  Fix the issues above or bypass with: SKIP_CODE_REVIEW=1 git commit${NC}"
    echo ""
    exit 1
else
    echo ""
    if [ "$TOTAL_ISSUES" -gt 0 ]; then
        echo -e "${YELLOW}⚠ Code review found issues, but allowing commit${NC}"
        echo -e "${YELLOW}  Consider addressing these before pushing${NC}"
    else
        echo -e "${GREEN}✓ Code review passed!${NC}"
    fi
    echo ""
    exit 0
fi
