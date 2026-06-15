#!/bin/bash
# Crest Study Consult Super Admin API Test Script
# Usage: ./scripts/test-super-api.sh [base_url]
#
# Requires: SUPER_ADMIN_API_KEY environment variable
# Example:  SUPER_ADMIN_API_KEY=your-key ./scripts/test-super-api.sh

set -e

# Configuration
BASE_URL="${1:-http://localhost:5173}"
API_KEY="${SUPER_ADMIN_API_KEY}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Check API key
if [ -z "$API_KEY" ]; then
  echo -e "${RED}Error: SUPER_ADMIN_API_KEY environment variable not set${NC}"
  echo "Usage: SUPER_ADMIN_API_KEY=your-key ./scripts/test-super-api.sh"
  exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Crest Study Consult Super Admin API Test Suite                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Base URL: ${YELLOW}$BASE_URL${NC}"
echo -e "API Key:  ${YELLOW}${API_KEY:0:8}...${NC}"
echo ""

# Helper function for API calls
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  local description="$4"
  
  echo -e "${BLUE}Testing:${NC} $description"
  echo -e "  ${method} ${endpoint}"
  
  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "${BASE_URL}${endpoint}")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $API_KEY" \
      "${BASE_URL}${endpoint}")
  fi
  
  # Extract status code (last line) and body (everything else)
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  # Check if successful (2xx status code)
  if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
    echo -e "  ${GREEN}✓ Status: $http_code${NC}"
    ((PASSED++))
  else
    echo -e "  ${RED}✗ Status: $http_code${NC}"
    echo -e "  ${RED}Response: $body${NC}"
    ((FAILED++))
  fi
  
  # Return body for further use
  echo "$body"
  echo ""
}

# ============================================
# Test: Authentication
# ============================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Testing Authentication${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test without auth (should fail)
echo -e "${BLUE}Testing:${NC} Request without API key (should fail)"
response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/super/users")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "401" ]; then
  echo -e "  ${GREEN}✓ Correctly rejected (401)${NC}"
  ((PASSED++))
else
  echo -e "  ${RED}✗ Expected 401, got $http_code${NC}"
  ((FAILED++))
fi
echo ""

# Test with invalid auth (should fail)
echo -e "${BLUE}Testing:${NC} Request with invalid API key (should fail)"
response=$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer invalid-key" \
  "${BASE_URL}/api/super/users")
http_code=$(echo "$response" | tail -n1)
if [ "$http_code" = "401" ]; then
  echo -e "  ${GREEN}✓ Correctly rejected (401)${NC}"
  ((PASSED++))
else
  echo -e "  ${RED}✗ Expected 401, got $http_code${NC}"
  ((FAILED++))
fi
echo ""

# ============================================
# Test: Admin Users API
# ============================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Testing /api/super/users${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# List users
api_call "GET" "/api/super/users" "" "List all admin users"

# Create test user
TEST_EMAIL="test-$(date +%s)@propx.africa"
CREATE_RESPONSE=$(api_call "POST" "/api/super/users" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"TestP@ssw0rd123!\",\"name\":\"Test User\",\"role\":\"WRITER\"}" \
  "Create new admin user")

# Extract user ID from response
USER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$USER_ID" ]; then
  echo -e "${BLUE}Created user ID:${NC} $USER_ID"
  echo ""
  
  # Update user
  api_call "PATCH" "/api/super/users" \
    "{\"id\":\"$USER_ID\",\"name\":\"Updated Test User\",\"role\":\"EDITOR\"}" \
    "Update admin user"
  
  # Deactivate user
  api_call "DELETE" "/api/super/users" \
    "{\"id\":\"$USER_ID\"}" \
    "Deactivate admin user"
fi

# ============================================
# Test: Authors API
# ============================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Testing /api/super/authors${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# List authors
api_call "GET" "/api/super/authors" "" "List all authors"

# List authors with stats
api_call "GET" "/api/super/authors?withStats=true" "" "List authors with post counts"

# Create test author
TEST_SLUG="test-author-$(date +%s)"
CREATE_AUTHOR_RESPONSE=$(api_call "POST" "/api/super/authors" \
  "{\"name\":\"Test Author\",\"slug\":\"$TEST_SLUG\",\"bio\":\"A test author for API testing\"}" \
  "Create new author")

# Extract author ID
AUTHOR_ID=$(echo "$CREATE_AUTHOR_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$AUTHOR_ID" ]; then
  echo -e "${BLUE}Created author ID:${NC} $AUTHOR_ID"
  echo ""
  
  # Update author
  api_call "PATCH" "/api/super/authors" \
    "{\"id\":\"$AUTHOR_ID\",\"bio\":\"Updated bio for test author\"}" \
    "Update author"
  
  # Delete author
  api_call "DELETE" "/api/super/authors" \
    "{\"id\":\"$AUTHOR_ID\"}" \
    "Delete author"
fi

# ============================================
# Test: Deletions API
# ============================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Testing /api/super/deletions${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# List pending deletions
api_call "GET" "/api/super/deletions" "" "List pending deletion requests"

# List all deletions
api_call "GET" "/api/super/deletions?status=ALL" "" "List all deletion requests"

# ============================================
# Test: Audit Log API
# ============================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Testing /api/super/audit${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# List audit logs
api_call "GET" "/api/super/audit" "" "List recent audit logs"

# List with filters
api_call "GET" "/api/super/audit?action=CREATE_USER&limit=10" "" "List CREATE_USER audit logs"

# Create audit entry
api_call "POST" "/api/super/audit" \
  "{\"action\":\"TEST_ACTION\",\"resource\":\"test\",\"details\":{\"test\":true}}" \
  "Create audit log entry"

# ============================================
# Summary
# ============================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test Summary${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
