import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
    test: {
        poolOptions: {
            workers: {
                main: "./src/index.ts",
                miniflare: {
                    compatibilityDate: "2024-01-17",
                    d1Databases: {
                        usersDB: "test-db",
                    },
                    bindings: {
                        RBAC_ENABLED: "true",
                        SUPER_ADMIN_EMAIL: "admin@test.com",
                        EMAIL_FROM: "test@test.com",
                        EMAIL_FROM_NAME: "Test",
                        FORGOT_PASSWORD_URL: "https://test.com/reset",
                        TOKEN_VALID_MINUTES: "60",
                        EMAIL_DKIM_DOMAIN: "test.com",
                        EMAIL_DKIM_SELECTOR: "test",
                        EMAIL_DKIM_PRIVATE_KEY: "test-key",
                    },
                },
            },
        },
        include: ["test/**/*.test.ts"],
        globals: true,
    },
});
