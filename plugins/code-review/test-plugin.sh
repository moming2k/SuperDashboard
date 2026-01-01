#!/bin/bash

# Test script for AI Code Review Plugin
# This script tests all endpoints of the code review plugin

set -e

API_BASE="http://localhost:8000"
PLUGIN_PATH="/plugins/code-review"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  AI Code Review Plugin - Test Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Check if backend is running
echo -e "${YELLOW}→ Checking if backend is running...${NC}"
if curl -s -o /dev/null -w "%{http_code}" "$API_BASE/plugins/code-review/health" | grep -q "200"; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running${NC}"
    echo -e "${YELLOW}  Please start the backend first:${NC}"
    echo -e "${YELLOW}    cd backend && python main.py${NC}"
    exit 1
fi

echo ""

# Test 1: Health check
echo -e "${YELLOW}→ Test 1: Health Check${NC}"
RESPONSE=$(curl -s "$API_BASE$PLUGIN_PATH/health")
echo "$RESPONSE" | jq .
if echo "$RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
fi

echo ""

# Test 2: Code Review
echo -e "${YELLOW}→ Test 2: Code Review${NC}"
cat > /tmp/test_code.json <<'EOF'
{
  "code": "def login(username, password):\n    query = f\"SELECT * FROM users WHERE username='{username}'\"\n    return db.execute(query)",
  "language": "python",
  "filename": "auth.py"
}
EOF

echo -e "${BLUE}Testing with vulnerable Python code...${NC}"
RESPONSE=$(curl -s -X POST "$API_BASE$PLUGIN_PATH/review" \
    -H "Content-Type: application/json" \
    -d @/tmp/test_code.json)

if echo "$RESPONSE" | jq -e '.issues' > /dev/null 2>&1; then
    ISSUE_COUNT=$(echo "$RESPONSE" | jq '.issues | length')
    SCORE=$(echo "$RESPONSE" | jq '.score')
    echo -e "${GREEN}✓ Code review completed${NC}"
    echo -e "  Issues found: $ISSUE_COUNT"
    echo -e "  Quality score: $SCORE/100"

    # Show first issue if any
    if [ "$ISSUE_COUNT" -gt 0 ]; then
        echo -e "${BLUE}  First issue:${NC}"
        echo "$RESPONSE" | jq '.issues[0]' | sed 's/^/    /'
    fi
else
    echo -e "${RED}✗ Code review failed${NC}"
    echo "$RESPONSE" | jq . | sed 's/^/    /'
fi

echo ""

# Test 3: Security Scan
echo -e "${YELLOW}→ Test 3: Security Scan${NC}"
RESPONSE=$(curl -s -X POST "$API_BASE$PLUGIN_PATH/review/security" \
    -H "Content-Type: application/json" \
    -d @/tmp/test_code.json)

if echo "$RESPONSE" | jq -e '.issues' > /dev/null 2>&1; then
    SECURITY_ISSUES=$(echo "$RESPONSE" | jq '.issues | length')
    echo -e "${GREEN}✓ Security scan completed${NC}"
    echo -e "  Security issues found: $SECURITY_ISSUES"
else
    echo -e "${RED}✗ Security scan failed${NC}"
fi

echo ""

# Test 4: Quality Check
echo -e "${YELLOW}→ Test 4: Quality Check${NC}"
RESPONSE=$(curl -s -X POST "$API_BASE$PLUGIN_PATH/review/quality" \
    -H "Content-Type: application/json" \
    -d @/tmp/test_code.json)

if echo "$RESPONSE" | jq -e '.score' > /dev/null 2>&1; then
    QUALITY_SCORE=$(echo "$RESPONSE" | jq '.score')
    echo -e "${GREEN}✓ Quality check completed${NC}"
    echo -e "  Quality score: $QUALITY_SCORE/100"
else
    echo -e "${RED}✗ Quality check failed${NC}"
fi

echo ""

# Test 5: Best Practices
echo -e "${YELLOW}→ Test 5: Best Practices Review${NC}"
RESPONSE=$(curl -s -X POST "$API_BASE$PLUGIN_PATH/review/best-practices" \
    -H "Content-Type: application/json" \
    -d @/tmp/test_code.json)

if echo "$RESPONSE" | jq -e '.issues' > /dev/null 2>&1; then
    BP_ISSUES=$(echo "$RESPONSE" | jq '.issues | length')
    echo -e "${GREEN}✓ Best practices review completed${NC}"
    echo -e "  Best practice issues: $BP_ISSUES"
else
    echo -e "${RED}✗ Best practices review failed${NC}"
fi

echo ""

# Test 6: Pre-commit Check
echo -e "${YELLOW}→ Test 6: Pre-commit Check${NC}"
cat > /tmp/precommit_test.json <<'EOF'
{
  "files": [
    {
      "filename": "auth.py",
      "content": "def login(username, password):\n    query = f\"SELECT * FROM users WHERE username='{username}'\"\n    return db.execute(query)"
    },
    {
      "filename": "api.js",
      "content": "function getUser() {\n  return fetch('/api/user').then(r => r.json())\n}"
    }
  ]
}
EOF

RESPONSE=$(curl -s -X POST "$API_BASE$PLUGIN_PATH/precommit-check" \
    -H "Content-Type: application/json" \
    -d @/tmp/precommit_test.json)

if echo "$RESPONSE" | jq -e '.passed' > /dev/null 2>&1; then
    PASSED=$(echo "$RESPONSE" | jq '.passed')
    TOTAL=$(echo "$RESPONSE" | jq '.total_issues')
    CRITICAL=$(echo "$RESPONSE" | jq '.critical_issues')

    echo -e "${GREEN}✓ Pre-commit check completed${NC}"
    echo -e "  Passed: $PASSED"
    echo -e "  Total issues: $TOTAL"
    echo -e "  Critical issues: $CRITICAL"
else
    echo -e "${RED}✗ Pre-commit check failed${NC}"
fi

echo ""

# Test 7: PR Description Generation
echo -e "${YELLOW}→ Test 7: PR Description Generation${NC}"
cat > /tmp/pr_test.json <<'EOF'
{
  "diff": "diff --git a/auth.py b/auth.py\n+def hash_password(password):\n+    return bcrypt.hashpw(password, bcrypt.gensalt())\n+\n def login(username, password):\n-    query = f\"SELECT * FROM users WHERE username='{username}'\"\n+    query = \"SELECT * FROM users WHERE username=?\"\n+    user = db.execute(query, (username,))\n+    if user and verify_password(password, user.password_hash):\n+        return create_session(user)\n     return None",
  "branch_name": "security/fix-sql-injection"
}
EOF

RESPONSE=$(curl -s -X POST "$API_BASE$PLUGIN_PATH/generate-pr-description" \
    -H "Content-Type: application/json" \
    -d @/tmp/pr_test.json)

if echo "$RESPONSE" | jq -e '.title' > /dev/null 2>&1; then
    TITLE=$(echo "$RESPONSE" | jq -r '.title')
    CHANGES=$(echo "$RESPONSE" | jq '.changes | length')

    echo -e "${GREEN}✓ PR description generated${NC}"
    echo -e "  Title: $TITLE"
    echo -e "  Changes: $CHANGES items"
else
    echo -e "${RED}✗ PR description generation failed${NC}"
    echo "$RESPONSE" | jq .
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Test suite completed${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Cleanup
rm -f /tmp/test_code.json /tmp/precommit_test.json /tmp/pr_test.json
