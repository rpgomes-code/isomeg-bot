import { beforeAll, describe, expect, it } from "vitest";

type BirthdaysModule = typeof import("../lib/birthdays");

let birthdays: BirthdaysModule;

beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/isomeg_test";
    birthdays = await import("../lib/birthdays");
});

describe("birthday helpers", () => {
    it("validates real calendar dates", () => {
        expect(birthdays.isValidBirthday(2, 29)).toBe(true);
        expect(birthdays.isValidBirthday(2, 30)).toBe(false);
        expect(birthdays.isValidBirthday(13, 1)).toBe(false);
        expect(birthdays.isValidBirthday(4, 31)).toBe(false);
    });

    it("formats birthdays consistently", () => {
        expect(birthdays.formatBirthday(7, 23)).toBe("July 23");
    });
});
