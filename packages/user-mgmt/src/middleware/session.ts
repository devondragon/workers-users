/**
 * Session middleware for extracting and validating session data from cookies.
 * This middleware loads session data from the session-state worker and attaches
 * it to the request context for use by other middleware and handlers.
 */

import { IRequest } from 'itty-router';
import { Env } from '../env';
import { getSessionIdFromCookies } from '../utils';
import { loadSession } from '../session';
import { SessionData } from '../types/rbac';

/**
 * Extended request interface that includes session data
 */
export interface RequestWithSession extends IRequest {
    sessionId?: string;
    sessionData?: SessionData;
}

/**
 * Middleware that extracts session ID from cookies and loads session data.
 * 
 * This middleware:
 * - Extracts the session ID from request cookies
 * - Loads session data from the session-state worker
 * - Attaches both session ID and data to the request for downstream use
 * - Returns 401 Unauthorized if no valid session is found
 * 
 * @param request - The incoming request with potential session cookie
 * @param env - The environment configuration
 * @returns Response if unauthorized, or void to continue to next middleware
 */
export async function withSession(
    request: RequestWithSession,
    env: Env
): Promise<Response | void> {
    // Extract session ID from cookies
    const sessionId = getSessionIdFromCookies(request);
    
    if (!sessionId) {
        return new Response(
            JSON.stringify({ error: 'No session found' }),
            { 
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
    
    try {
        // Load session data from session-state worker
        const sessionData = await loadSession(env, sessionId);
        
        if (!sessionData) {
            return new Response(
                JSON.stringify({ error: 'Invalid or expired session' }),
                { 
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }
        
        // Attach session data to request for downstream use
        request.sessionId = sessionId;
        request.sessionData = sessionData;
        
        // Continue to next middleware/handler
        return;
    } catch (error) {
        console.error('Error loading session:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to validate session' }),
            { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Optional session middleware that allows requests to proceed even without a valid session.
 * Still attempts to load session data if available, but doesn't return an error if missing.
 * 
 * @param request - The incoming request
 * @param env - The environment configuration
 */
export async function withOptionalSession(
    request: RequestWithSession,
    env: Env
): Promise<void> {
    const sessionId = getSessionIdFromCookies(request);
    
    if (sessionId) {
        try {
            const sessionData = await loadSession(env, sessionId);
            if (sessionData) {
                request.sessionId = sessionId;
                request.sessionData = sessionData;
            }
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error loading optional session:', error);
        }
    }
}