import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { handleForgotPasswordNewPassword, handleForgotPasswordValidate } from "../../../src/handlers";
import { getUserByValidResetToken } from "../../../src/utils";
import { comparePassword } from "../../../src/auth";
import { setupTestDatabase, cleanupTestDatabase } from "../../setup";
import { createMockEnv, createMockRequest } from "../../helpers/mocks";

const USERNAME = "member@test.com";
const TOKEN = "reset-token-under-test";
const MINUTE_MS = 60 * 1000;

async function seedToken(ageMinutes: number): Promise<void> {
    const db = env.usersDB as D1Database;
    await db
        .prepare("UPDATE User SET ResetToken = ?, ResetTokenTime = ?, Password = 'hashed_password' WHERE Username = ?")
        .bind(TOKEN, Date.now() - ageMinutes * MINUTE_MS, USERNAME)
        .run();
}

async function getUser(): Promise<{ Password: string; ResetToken: string | null; ResetTokenTime: number | null }> {
    const db = env.usersDB as D1Database;
    return (await db.prepare("SELECT Password, ResetToken, ResetTokenTime FROM User WHERE Username = ?").bind(USERNAME).first())!;
}

describe("Password reset token expiry", () => {
    beforeAll(async () => {
        await setupTestDatabase();
    });

    afterAll(async () => {
        await cleanupTestDatabase();
    });

    describe("handleForgotPasswordNewPassword()", () => {
        it("rejects an expired token and leaves the password unchanged", async () => {
            await seedToken(120);
            const mockEnv = createMockEnv();

            const validate = await handleForgotPasswordValidate(
                createMockRequest("http://localhost/forgot-password-validate", { method: "POST", body: { token: TOKEN } }),
                mockEnv,
            );
            expect(validate.status).toBe(400);
            expect(await validate.json()).toEqual({ error: "Token expired" });

            const response = await handleForgotPasswordNewPassword(
                createMockRequest("http://localhost/forgot-password-new-password", {
                    method: "POST",
                    body: { token: TOKEN, password: "NewP@ssw0rd!" },
                }),
                mockEnv,
            );
            expect(response.status).toBe(400);

            const user = await getUser();
            expect(user.Password).toBe("hashed_password");
            expect(user.ResetToken).toBe(TOKEN);
        });

        it("accepts a fresh token, changes the password, and clears the token", async () => {
            await seedToken(1);
            const mockEnv = createMockEnv();

            const response = await handleForgotPasswordNewPassword(
                createMockRequest("http://localhost/forgot-password-new-password", {
                    method: "POST",
                    body: { token: TOKEN, password: "NewP@ssw0rd!" },
                }),
                mockEnv,
            );
            expect(response.status).toBe(200);

            const user = await getUser();
            expect(await comparePassword("NewP@ssw0rd!", user.Password)).toBe(true);
            expect(user.ResetToken).toBeNull();
            expect(user.ResetTokenTime).toBeNull();
        });

        it("rejects a request with no token", async () => {
            const response = await handleForgotPasswordNewPassword(
                createMockRequest("http://localhost/forgot-password-new-password", {
                    method: "POST",
                    body: { password: "NewP@ssw0rd!" },
                }),
                createMockEnv(),
            );
            expect(response.status).toBe(400);
        });
    });

    describe("getUserByValidResetToken()", () => {
        it("returns null for an expired token and the user for a fresh one", async () => {
            const mockEnv = createMockEnv();
            await seedToken(61);
            expect(await getUserByValidResetToken(mockEnv, TOKEN)).toBeNull();
            await seedToken(59);
            expect((await getUserByValidResetToken(mockEnv, TOKEN))?.Username).toBe(USERNAME);
        });
    });
});
