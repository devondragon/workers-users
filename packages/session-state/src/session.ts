import { Env } from './env';

export function generateSessionId(): string {
    return crypto.randomUUID();
}

export async function createSession(data: any, env: Env): Promise<string> {
    const sessionId = generateSessionId();
    try {
        await env.sessionstore.put(sessionId, JSON.stringify(data));
    } catch (error) {
        console.error("Error creating session: " + error);
        throw new Error('Failed to create session');
    }
    return sessionId;
}

export async function updateSession(sessionId: string, data: any, env: Env): Promise<void> {
    try {
        await env.sessionstore.put(sessionId, JSON.stringify(data));
    } catch (error) {
        console.error("Error updating session: " + error);
        throw new Error('Failed to update session');
    }
}

export async function addToSession(sessionId: string, data: any, env: Env): Promise<void> {
    const sessionData = await getSessionData(sessionId, env);
    await updateSession(sessionId, { ...sessionData, ...data }, env);
}

export async function getSessionData(sessionId: string, env: Env): Promise<any> {
    const data = await env.sessionstore.get(sessionId);
    return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string, env: Env): Promise<void> {
    try {
        await env.sessionstore.delete(sessionId);
    } catch (error) {
        console.error("Error deleting session: " + error);
        throw new Error('Failed to delete session');
    }
}
