/**
 * Crest Study Consult Super Admin API Test Script
 * 
 * Tests all super admin endpoints with proper assertions.
 * 
 * Usage:
 *   npx tsx scripts/test-super-api.ts [base_url]
 * 
 * Environment:
 *   SUPER_ADMIN_API_KEY - Required API key for authentication
 * 
 * Example:
 *   npm run test:api
 *   npm run test:api:prod
 */

import { config } from "dotenv";

// Load environment variables from .env.local, .env, etc.
config({ path: ".env.local" });
config({ path: ".env" });

const BASE_URL = process.argv[2] || "http://localhost:5173";
const API_KEY = process.env.SUPER_ADMIN_API_KEY;

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Test results tracking
const results: { name: string; passed: boolean; error?: string }[] = [];

// ============================================
// Utility Functions
// ============================================

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function apiCall<T = unknown>(
  method: string,
  endpoint: string,
  body?: object,
  expectStatus = 200
): Promise<{ status: number; data: T }> {
  const url = `${BASE_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  let data: T;
  
  try {
    data = await response.json();
  } catch {
    data = {} as T;
  }

  return { status: response.status, data };
}

async function test(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
    results.push({ name, passed: true });
    log("green", `  ✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message });
    log("red", `  ✗ ${name}`);
    log("red", `    Error: ${message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// ============================================
// Test Suites
// ============================================

async function testAuthentication() {
  log("yellow", "\n━━━ Authentication Tests ━━━");

  await test("Reject request without API key", async () => {
    const response = await fetch(`${BASE_URL}/api/super/users`);
    assertEquals(response.status, 401, "Should reject with 401");
  });

  await test("Reject request with invalid API key", async () => {
    const response = await fetch(`${BASE_URL}/api/super/users`, {
      headers: { Authorization: "Bearer invalid-key" },
    });
    assertEquals(response.status, 401, "Should reject with 401");
  });

  await test("Accept request with valid API key", async () => {
    const { status, data } = await apiCall<{ success: boolean }>("GET", "/api/super/users");
    if (status !== 200) {
      throw new Error(`Expected 200, got ${status}. Response: ${JSON.stringify(data)}`);
    }
  });
}

async function testUsersAPI() {
  log("yellow", "\n━━━ Users API Tests ━━━");

  let testUserId: string | null = null;
  const testEmail = `test-${Date.now()}@creststudyconsult.com`;

  await test("GET /api/super/users - List users", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { users: unknown[] } }>(
      "GET",
      "/api/super/users"
    );
    assertEquals(status, 200);
    assert(data.success === true, "Response should indicate success");
    assert(Array.isArray(data.data.users), "Should return users array");
  });

  await test("POST /api/super/users - Create user", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { user: { id: string } } }>(
      "POST",
      "/api/super/users",
      {
        email: testEmail,
        password: "TestP@ssw0rd123!",
        name: "Test User",
        role: "WRITER",
      }
    );
    assertEquals(status, 201);
    assert(data.success === true, "Response should indicate success");
    assert(typeof data.data.user.id === "string", "Should return user ID");
    testUserId = data.data.user.id;
  });

  await test("POST /api/super/users - Reject weak password", async () => {
    const { status, data } = await apiCall<{ success: boolean; error: string }>(
      "POST",
      "/api/super/users",
      {
        email: `weak-${Date.now()}@creststudyconsult.com`,
        password: "weak",
        name: "Weak Password User",
      }
    );
    assertEquals(status, 400);
    assert(data.success === false, "Should fail");
    assert(data.error.includes("Password"), "Should mention password issue");
  });

  await test("POST /api/super/users - Reject duplicate email", async () => {
    const { status, data } = await apiCall<{ success: boolean; error: string }>(
      "POST",
      "/api/super/users",
      {
        email: testEmail,
        password: "TestP@ssw0rd123!",
        name: "Duplicate User",
      }
    );
    assertEquals(status, 400);
    assert(data.error.includes("already"), "Should mention duplicate");
  });

  await test("PATCH /api/super/users - Update user", async () => {
    if (!testUserId) throw new Error("No test user created");
    
    const { status, data } = await apiCall<{ success: boolean }>(
      "PATCH",
      "/api/super/users",
      {
        id: testUserId,
        name: "Updated Test User",
        role: "EDITOR",
      }
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
  });

  await test("DELETE /api/super/users - Deactivate user", async () => {
    if (!testUserId) throw new Error("No test user created");
    
    const { status, data } = await apiCall<{ success: boolean }>(
      "DELETE",
      "/api/super/users",
      { id: testUserId }
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
  });
}

async function testAuthorsAPI() {
  log("yellow", "\n━━━ Authors API Tests ━━━");

  let testAuthorId: string | null = null;
  const testSlug = `test-author-${Date.now()}`;

  await test("GET /api/super/authors - List authors", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { authors: unknown[] } }>(
      "GET",
      "/api/super/authors"
    );
    assertEquals(status, 200);
    assert(data.success === true, "Response should indicate success");
    assert(Array.isArray(data.data.authors), "Should return authors array");
  });

  await test("GET /api/super/authors?withStats=true - List with stats", async () => {
    const { status, data } = await apiCall<{ success: boolean }>(
      "GET",
      "/api/super/authors?withStats=true"
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed with stats");
  });

  await test("POST /api/super/authors - Create author", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { author: { id: string } } }>(
      "POST",
      "/api/super/authors",
      {
        name: "Test Author",
        slug: testSlug,
        bio: "A test author for API testing",
      }
    );
    assertEquals(status, 201);
    assert(data.success === true, "Should succeed");
    assert(typeof data.data.author.id === "string", "Should return author ID");
    testAuthorId = data.data.author.id;
  });

  await test("PATCH /api/super/authors - Update author", async () => {
    if (!testAuthorId) throw new Error("No test author created");
    
    const { status, data } = await apiCall<{ success: boolean }>(
      "PATCH",
      "/api/super/authors",
      {
        id: testAuthorId,
        bio: "Updated bio for test author",
      }
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
  });

  await test("DELETE /api/super/authors - Delete author", async () => {
    if (!testAuthorId) throw new Error("No test author created");
    
    const { status, data } = await apiCall<{ success: boolean }>(
      "DELETE",
      "/api/super/authors",
      { id: testAuthorId }
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
  });
}

async function testDeletionsAPI() {
  log("yellow", "\n━━━ Deletions API Tests ━━━");

  await test("GET /api/super/deletions - List pending deletions", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { deletions: unknown[] } }>(
      "GET",
      "/api/super/deletions"
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
    assert(Array.isArray(data.data.deletions), "Should return deletions array");
  });

  await test("GET /api/super/deletions?status=ALL - List all deletions", async () => {
    const { status, data } = await apiCall<{ success: boolean }>(
      "GET",
      "/api/super/deletions?status=ALL"
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
  });
}

async function testAuditAPI() {
  log("yellow", "\n━━━ Audit API Tests ━━━");

  await test("GET /api/super/audit - List audit logs", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { logs: unknown[] } }>(
      "GET",
      "/api/super/audit"
    );
    assertEquals(status, 200);
    assert(data.success === true, "Should succeed");
  });

  await test("GET /api/super/audit?limit=10 - List with limit", async () => {
    const { status, data } = await apiCall<{ success: boolean; data: { pagination: { limit: number } } }>(
      "GET",
      "/api/super/audit?limit=10"
    );
    assertEquals(status, 200);
    assert(data.data.pagination.limit === 10, "Should respect limit");
  });

  await test("POST /api/super/audit - Create audit entry", async () => {
    const { status, data } = await apiCall<{ success: boolean }>(
      "POST",
      "/api/super/audit",
      {
        action: "TEST_ACTION",
        resource: "test",
        details: { test: true, timestamp: Date.now() },
      }
    );
    assertEquals(status, 201);
    assert(data.success === true, "Should succeed");
  });
}

// ============================================
// Main Runner
// ============================================

async function main() {
  console.log("");
  log("blue", "╔════════════════════════════════════════════════════════════╗");
  log("blue", "║     Crest Study Consult Super Admin API Test Suite                ║");
  log("blue", "╚════════════════════════════════════════════════════════════╝");
  console.log("");
  
  log("cyan", `Base URL: ${BASE_URL}`);
  log("cyan", `API Key:  ${API_KEY?.slice(0, 8)}...`);
  console.log("");

  // Check API key
  if (!API_KEY || API_KEY.length < 32) {
    log("red", "Error: SUPER_ADMIN_API_KEY not set or too short (min 32 chars)");
    log("yellow", "Usage: SUPER_ADMIN_API_KEY=your-key npx tsx scripts/test-super-api.ts");
    process.exit(1);
  }

  // Run all test suites
  try {
    await testAuthentication();
    await testUsersAPI();
    await testAuthorsAPI();
    await testDeletionsAPI();
    await testAuditAPI();
  } catch (error) {
    log("red", `\nFatal error: ${error}`);
  }

  // Summary
  console.log("");
  log("yellow", "━━━ Test Summary ━━━");
  console.log("");
  
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  
  log("green", `Passed: ${passed}`);
  log("red", `Failed: ${failed}`);
  console.log("");

  if (failed === 0) {
    log("green", "✓ All tests passed!");
    process.exit(0);
  } else {
    log("red", "✗ Some tests failed:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log("red", `  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  }
}

main();
