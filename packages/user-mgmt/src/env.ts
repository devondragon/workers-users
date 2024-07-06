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
