import { env } from "cloudflare:test";
import { Env } from "../../src/env";
import { SessionData } from "../../src/types/rbac";

/**
 * Creates a mock Env object for testing.
 * Uses the real D1Database from cloudflare:test and mocks other services.
 */
export function createMockEnv(overrides: Partial<Env> = {}): Env {
    return {
        usersDB: env.usersDB as D1Database,
        sessionService: createMockSessionService(),
        EMAIL_FROM: "test@test.com",
        EMAIL_FROM_NAME: "Test",
        FORGOT_PASSWORD_URL: "https://test.com/reset",
        TOKEN_VALID_MINUTES: 60,
        EMAIL_DKIM_DOMAIN: "test.com",
        EMAIL_DKIM_SELECTOR: "test",
        EMAIL_DKIM_PRIVATE_KEY: "test-key",
        RBAC_ENABLED: "true",
        SUPER_ADMIN_EMAIL: "admin@test.com",
        SUPER_ADMIN_EMAIL_CONFIRMED: "true", // Enable bootstrap in tests
        ...overrides,
    };
}

/**
 * Session data for mock sessions
 */
const mockSessions: Record<string, SessionData> = {
    "admin-session": {
        username: "admin@test.com",
        firstName: "Admin",
        lastName: "User",
        permissions: ["admin:all"],
        roles: [],
    },
    "member-session": {
        username: "member@test.com",
        firstName: "Member",
        lastName: "User",
        permissions: ["users:read"],
        roles: [],
    },
    "role-manager-session": {
        username: "rolemanager@test.com",
        firstName: "Role",
        lastName: "Manager",
        permissions: ["roles:assign", "roles:read", "roles:write"],
        roles: [],
    },
    "moderator-session": {
        username: "moderator@test.com",
        firstName: "Mod",
        lastName: "User",
        permissions: ["users:read", "users:write"],
        roles: [],
    },
};

/**
 * Creates a mock session service fetcher that returns session data based on session ID.
 */
export function createMockSessionService(): Fetcher {
    return {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            // Get method from init or from Request object
            const method = init?.method || (input instanceof Request ? input.method : "GET");

            // Handle /get/:sessionId requests
            if (url.includes("/get/")) {
                const sessionId = url.split("/get/")[1];
                const sessionData = mockSessions[sessionId];

                if (sessionData) {
                    return new Response(JSON.stringify(sessionData), {
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                    });
                } else {
                    return new Response(JSON.stringify({ error: "Session not found" }), {
                        status: 404,
                        headers: { "Content-Type": "application/json" },
                    });
                }
            }

            // Handle /create requests
            if (url.includes("/create")) {
                return new Response("mock-session-id", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" },
                });
            }

            // Handle /delete/:sessionId requests
            if (url.includes("/delete/")) {
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            // Handle cache routes for permission caching
            // PUT /cache/:cacheKey - Return success for cache set operations
            if (url.includes("/cache/") && method === "PUT") {
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            // DELETE /cache/:cacheKey - Return success for cache invalidation
            if (url.includes("/cache/") && method === "DELETE") {
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            // GET /cache/:cacheKey - Always return 404 (cache miss) so tests hit the database
            if (url.includes("/cache/") && method === "GET") {
                return new Response(JSON.stringify({ error: "Cache key not found" }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                });
            }

            // Default response
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        },
    } as Fetcher;
}

/**
 * Creates a mock Request object with the specified options.
 */
export function createMockRequest(
    url: string,
    options: {
        method?: string;
        body?: unknown;
        cookies?: Record<string, string>;
        headers?: Record<string, string>;
    } = {}
): Request {
    const { method = "GET", body, cookies = {}, headers = {} } = options;

    const cookieHeader = Object.entries(cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");

    const requestHeaders = new Headers(headers);
    if (cookieHeader) {
        requestHeaders.set("Cookie", cookieHeader);
    }
    if (body) {
        requestHeaders.set("Content-Type", "application/json");
    }

    return new Request(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * Creates a mock RequestWithSession for middleware testing.
 */
export function createMockRequestWithSession(
    url: string,
    sessionData: SessionData | null,
    options: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
    } = {}
): Request & { sessionData?: SessionData } {
    const request = createMockRequest(url, options) as Request & {
        sessionData?: SessionData;
    };
    if (sessionData) {
        request.sessionData = sessionData;
    }
    return request;
}

/**
 * Creates session data with specified permissions.
 */
export function createSessionData(
    permissions: string[],
    overrides: Partial<SessionData> = {}
): SessionData {
    return {
        username: "test@test.com",
        firstName: "Test",
        lastName: "User",
        permissions,
        roles: [],
        ...overrides,
    };
}

/**
 * Creates admin session data (with admin:all permission).
 */
export function createAdminSessionData(
    overrides: Partial<SessionData> = {}
): SessionData {
    return createSessionData(["admin:all"], {
        username: "admin@test.com",
        firstName: "Admin",
        lastName: "User",
        ...overrides,
    });
}

/**
 * Creates member session data (with users:read permission only).
 */
export function createMemberSessionData(
    overrides: Partial<SessionData> = {}
): SessionData {
    return createSessionData(["users:read"], {
        username: "member@test.com",
        firstName: "Member",
        lastName: "User",
        ...overrides,
    });
}
