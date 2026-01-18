/**
 * Represents the environment configuration for the user management module.
 */
export interface Env {
    usersDB: D1Database;
    sessionService: Fetcher;
    EMAIL_FROM: string;
    EMAIL_FROM_NAME: string;
    FORGOT_PASSWORD_URL: string;
    TOKEN_VALID_MINUTES: number;
    EMAIL_DKIM_DOMAIN: string;
    EMAIL_DKIM_SELECTOR: string;
    EMAIL_DKIM_PRIVATE_KEY: string;
    RBAC_ENABLED: string;
    SUPER_ADMIN_EMAIL?: string;
    /** Enable IP address logging in audit logs (GDPR consideration - disabled by default) */
    LOG_IP_ADDRESS?: string;
}

export function getUsersDB(env: Env): D1Database {
    return env.usersDB;
}

export function getSessionService(env: Env): Fetcher {
    return env.sessionService;
}

export function getEmailFrom(env: Env): string {
    return env.EMAIL_FROM;
}

export function getEmailFromName(env: Env): string {
    return env.EMAIL_FROM_NAME;
}

export function getForgotPasswordUrl(env: Env): string {
    return env.FORGOT_PASSWORD_URL;
}

export function getTokenValidMinutes(env: Env): number {
    return env.TOKEN_VALID_MINUTES;
}

export function getEmailDkimDomain(env: Env): string {
    return env.EMAIL_DKIM_DOMAIN;
}

export function getEmailDkimSelector(env: Env): string {
    return env.EMAIL_DKIM_SELECTOR;
}

export function getEmailDkimPrivateKey(env: Env): string {
    return env.EMAIL_DKIM_PRIVATE_KEY;
}

export function getRbacEnabled(env: Env): boolean {
    return env.RBAC_ENABLED === "true";
}

export function getSuperAdminEmail(env: Env): string | undefined {
    return env.SUPER_ADMIN_EMAIL;
}

/**
 * Check if IP address logging is enabled (GDPR consideration).
 * Defaults to false for privacy compliance.
 */
export function getIpLoggingEnabled(env: Env): boolean {
    return env.LOG_IP_ADDRESS === 'true';
}
