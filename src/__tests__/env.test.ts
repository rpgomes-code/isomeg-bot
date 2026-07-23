import { describe, expect, it } from "vitest";
import { assertEnv, validateEnv } from "../lib/env";

describe("env validation", () => {
    it("passes when required variables are non-empty", () => {
        const result = validateEnv(["CLIENT_TOKEN", "DATABASE_URL"], {
            CLIENT_TOKEN: "token",
            DATABASE_URL: "postgresql://example",
        } as NodeJS.ProcessEnv);

        expect(result).toEqual({ valid: true, missing: [] });
    });

    it("reports missing and blank variables", () => {
        const result = validateEnv(["CLIENT_TOKEN", "DATABASE_URL"], {
            CLIENT_TOKEN: "   ",
        } as NodeJS.ProcessEnv);

        expect(result.valid).toBe(false);
        expect(result.missing).toEqual(["CLIENT_TOKEN", "DATABASE_URL"]);
    });

    it("throws a startup-friendly error", () => {
        expect(() => assertEnv(["CLIENT_TOKEN"], {} as NodeJS.ProcessEnv))
            .toThrow("Missing required environment variables: CLIENT_TOKEN");
    });
});
