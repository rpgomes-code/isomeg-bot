import { beforeAll, describe, expect, it } from "vitest";

type PollsModule = typeof import("../lib/polls");

let polls: PollsModule;

beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/isomeg_test";
    polls = await import("../lib/polls");
});

describe("poll helpers", () => {
    it("normalizes poll options to unique non-empty values", () => {
        expect(polls.normalizePollOptions([" Yes ", "No", "", "Yes", "Maybe"])).toEqual(["Yes", "No", "Maybe"]);
    });

    it("parses prefix poll syntax", () => {
        expect(polls.parsePrefixPollInput("Best game? | Elden Ring | Hades")).toEqual({
            question: "Best game?",
            options: ["Elden Ring", "Hades"],
        });
    });

    it("detects expired polls", () => {
        const poll = { expiresAt: new Date("2026-07-23T10:00:00.000Z") } as any;

        expect(polls.isPollExpired(poll, new Date("2026-07-23T10:00:01.000Z"))).toBe(true);
        expect(polls.isPollExpired(poll, new Date("2026-07-23T09:59:59.000Z"))).toBe(false);
    });
});
