/**
 * Hashes a password using the SHA-256 algorithm.
 *
 * @param password - The password to be hashed.
 * @returns A Promise that resolves to the hashed password.
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16)).join('');
    const data = new TextEncoder().encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${salt}:${hashHex}`;
}


/**
 * Compares a provided password with a stored hash.
 * @param providedPassword - The password provided by the user.
 * @param storedHash - The stored hash of the password.
 * @returns A promise that resolves to a boolean indicating whether the provided password matches the stored hash.
 */
export async function comparePassword(providedPassword: string, storedHash: string): Promise<boolean> {
    const [salt, originalHash] = storedHash.split(':');
    const data = new TextEncoder().encode(salt + providedPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === originalHash;
}
