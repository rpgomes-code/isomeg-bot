export interface EnvValidationResult {
    valid: boolean;
    missing: string[];
}

export function validateEnv(requiredKeys: string[], env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
    const missing = requiredKeys.filter((key) => !env[key]?.trim());
    return {
        valid: missing.length === 0,
        missing,
    };
}

export function assertEnv(requiredKeys: string[], env: NodeJS.ProcessEnv = process.env): void {
    const result = validateEnv(requiredKeys, env);
    if (!result.valid) {
        throw new Error(`Missing required environment variables: ${result.missing.join(", ")}`);
    }
}
