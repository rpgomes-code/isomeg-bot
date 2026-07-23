import { beforeAll, describe, expect, it } from "vitest";

type XpModule = typeof import("../lib/xp");

let xp: XpModule;

beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/isomeg_test";
    xp = await import("../lib/xp");
});

describe("XP helpers", () => {
    it("calculates level progress at boundaries", () => {
        expect(xp.calculateLevel(0)).toEqual({ level: 0, xpInLevel: 0, xpToNext: 100 });
        expect(xp.calculateLevel(99)).toEqual({ level: 0, xpInLevel: 99, xpToNext: 1 });
        expect(xp.calculateLevel(100)).toEqual({ level: 1, xpInLevel: 0, xpToNext: xp.calculateXpForLevel(2) });
    });

    it("generates XP inside the configured inclusive range", () => {
        for (let i = 0; i < 100; i++) {
            const amount = xp.getRandomXp(3, 5);
            expect(amount).toBeGreaterThanOrEqual(3);
            expect(amount).toBeLessThanOrEqual(5);
        }
    });

    it("normalizes inverted random XP ranges safely", () => {
        expect(xp.getRandomXp(7, 3)).toBe(7);
    });

    it("detects cooldown windows", () => {
        const now = new Date("2026-07-23T12:00:00.000Z");

        expect(xp.isXpOnCooldown(new Date("2026-07-23T11:59:31.000Z"), now, 30_000)).toBe(true);
        expect(xp.isXpOnCooldown(new Date("2026-07-23T11:59:30.000Z"), now, 30_000)).toBe(false);
        expect(xp.isXpOnCooldown(null, now, 30_000)).toBe(false);
    });
});
