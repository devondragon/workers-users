// session.ts
import { Env } from './env';

export async function createSession(env: Env, user: any): Promise<string> {
    const sessionData = {
        username: user.Username,
        firstName: user.FirstName,
        lastName: user.LastName,
    };

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
