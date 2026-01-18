import { Env } from './env';
import { IRequest } from 'itty-router';
import { createSession, getSessionData, deleteSession, updateSession, addToSession } from './session';

// Constants for HTTP status codes
const STATUS_CREATED = 201;
const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const STATUS_INTERNAL_SERVER_ERROR = 500;

// Utility function to parse JSON safely
async function parseJson(request: IRequest): Promise<any> {
    try {
        return await request.json();
    } catch (error) {
        console.error('Failed to parse JSON:', error);
        throw new Error('Invalid JSON');
    }
}

// Handle Create Session
export async function handleCreateSession(request: IRequest, env: Env): Promise<Response> {
    try {
        const requestData = await parseJson(request);
        const sessionId = await createSession(requestData, env);
        return new Response(sessionId, { status: STATUS_CREATED });
    } catch (error) {
        console.error('Error in handleCreateSession:', error);
        return new Response('Failed to create session', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Handle Get Session
export async function handleGetSessionData(request: IRequest, env: Env): Promise<Response> {
    try {
        const { sessionId } = request.params;
        const data = await getSessionData(sessionId, env);
        if (!data) {
            return new Response('Session not found', { status: STATUS_NOT_FOUND });
        }
        return new Response(JSON.stringify(data), { status: STATUS_OK });
    } catch (error) {
        console.error('Error in handleGetSessionData:', error);
        return new Response('Failed to retrieve session', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Handle Delete Session
export async function handleDeleteSession(request: IRequest, env: Env): Promise<Response> {
    try {
        const { sessionId } = request.params;
        await deleteSession(sessionId, env);
        return new Response('Session deleted', { status: STATUS_OK });
    } catch (error) {
        console.error('Error in handleDeleteSession:', error);
        return new Response('Failed to delete session', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Handle Update Session
export async function handleUpdateSession(request: IRequest, env: Env): Promise<Response> {
    try {
        const { sessionId } = request.params;
        const requestData = await parseJson(request);
        await updateSession(sessionId, requestData, env);
        return new Response('Session updated', { status: STATUS_OK });
    } catch (error) {
        console.error('Error in handleUpdateSession:', error);
        return new Response('Failed to update session', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Handle Add to Session
export async function handleAddToSession(request: IRequest, env: Env): Promise<Response> {
    try {
        const { sessionId } = request.params;
        const requestData = await parseJson(request);
        await addToSession(sessionId, requestData, env);
        return new Response('Session updated with additional data', { status: STATUS_OK });
    } catch (error) {
        console.error('Error in handleAddToSession:', error);
        return new Response('Failed to update session with additional data', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Cache TTL in seconds (5 minutes)
const CACHE_TTL_SECONDS = 300;

// Handle Get Cache - retrieves a cached value by key
export async function handleGetCache(request: IRequest, env: Env): Promise<Response> {
    try {
        const { cacheKey } = request.params;
        const data = await env.sessionstore.get(cacheKey, 'json');
        if (!data) {
            return new Response('Cache miss', { status: STATUS_NOT_FOUND });
        }
        return new Response(JSON.stringify(data), {
            status: STATUS_OK,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error in handleGetCache:', error);
        return new Response('Failed to retrieve cache', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Handle Set Cache - stores a value in cache with TTL
export async function handleSetCache(request: IRequest, env: Env): Promise<Response> {
    try {
        const { cacheKey } = request.params;
        const requestData = await parseJson(request);
        const ttl = requestData.ttl ?? CACHE_TTL_SECONDS;
        await env.sessionstore.put(cacheKey, JSON.stringify(requestData.data), {
            expirationTtl: ttl
        });
        return new Response('Cache set', { status: STATUS_OK });
    } catch (error) {
        console.error('Error in handleSetCache:', error);
        return new Response('Failed to set cache', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}

// Handle Delete Cache - removes a cached value
export async function handleDeleteCache(request: IRequest, env: Env): Promise<Response> {
    try {
        const { cacheKey } = request.params;
        await env.sessionstore.delete(cacheKey);
        return new Response('Cache deleted', { status: STATUS_OK });
    } catch (error) {
        console.error('Error in handleDeleteCache:', error);
        return new Response('Failed to delete cache', { status: STATUS_INTERNAL_SERVER_ERROR });
    }
}
