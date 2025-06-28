// session.ts
import { Env, getRbacEnabled } from './env';
import { getUserPermissions } from './rbac';
import { SessionData } from './types/rbac';

export async function createSession(env: Env, user: any): Promise<string> {
    const sessionData: SessionData = {
        username: user.Username,
        firstName: user.FirstName,
        lastName: user.LastName,
    };

    // Include permissions if RBAC is enabled
    if (getRbacEnabled(env)) {
        try {
            const permissions = await getUserPermissions(env, user.UserID);
            sessionData.permissions = permissions;
        } catch (error) {
            console.error('Error fetching user permissions:', error);
            // Continue without permissions rather than failing the session creation
        }
    }

    const sessionCreationRequest = new Request("https://session-state.d1.compact.workers.dev/create", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
    });

    const sessionResponse = await env.sessionService.fetch(sessionCreationRequest);
    return await sessionResponse.text();
}

export async function deleteSession(env: Env, sessionId: string): Promise<void> {
    const deleteSessionUrl = `https://session-state.d1.compact.workers.dev/delete/${sessionId}`;
    const deleteRequest = new Request(deleteSessionUrl, { method: 'DELETE' });
    await env.sessionService.fetch(deleteRequest);
}

export async function loadSession(env: Env, sessionId: string): Promise<any> {
    const loadSessionUrl = `https://session-state.d1.compact.workers.dev/get/${sessionId}`;
    const loadRequest = new Request(loadSessionUrl);
    const loadResponse = await env.sessionService.fetch(loadRequest);
    if (loadResponse.ok) {
        return await loadResponse.json();
    }
    return null;
}
