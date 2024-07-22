import { Env } from './env';

// Constants for error messages
const ERROR_CREATING_SESSION = 'Failed to create session';
const ERROR_UPDATING_SESSION = 'Failed to update session';
const ERROR_DELETING_SESSION = 'Failed to delete session';

export function generateSessionId(): string {
    return crypto.randomUUID();
}

export async function createSession(data: any, env: Env): Promise<string> {
    const sessionId = generateSessionId();
    try {
        await env.sessionstore.put(sessionId, JSON.stringify(data));
        return sessionId;
    } catch (error) {
        console.error("Error creating session:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`${ERROR_CREATING_SESSION}: ${errorMessage}`);
    }
}

export async function updateSession(sessionId: string, data: any, env: Env): Promise<void> {
    try {
        await env.sessionstore.put(sessionId, JSON.stringify(data));
    } catch (error) {
        console.error("Error updating session:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`${ERROR_UPDATING_SESSION}: ${errorMessage}`);
    }
}

export async function addToSession(sessionId: string, data: any, env: Env): Promise<void> {
    try {
        const sessionData = await getSessionData(sessionId, env);
        await updateSession(sessionId, { ...sessionData, ...data }, env);
    } catch (error) {
        console.error("Error adding to session:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`${ERROR_UPDATING_SESSION}: ${errorMessage}`);
    }
}

export async function getSessionData(sessionId: string, env: Env): Promise<any> {
    try {
        const data = await env.sessionstore.get(sessionId);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error("Error retrieving session data:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`Failed to retrieve session data: ${errorMessage}`);
    }
}

export async function deleteSession(sessionId: string, env: Env): Promise<void> {
    try {
        await env.sessionstore.delete(sessionId);
    } catch (error) {
        console.error("Error deleting session:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new Error(`${ERROR_DELETING_SESSION}: ${errorMessage}`);
    }
}
