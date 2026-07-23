import { describe, it, expect } from "vitest";
import { formatDateTime } from "../lib/utils";

describe("formatDateTime", () => {
    it("formats a date as yyyy-MM-dd HH:mm:ss", () => {
        const date = new Date(2025, 0, 15, 9, 30, 45);
        expect(formatDateTime(date)).toBe("2025-01-15 09:30:45");
    });

    it("pads single-digit months, days, hours, minutes, seconds", () => {
        const date = new Date(2025, 1, 2, 3, 4, 5);
        expect(formatDateTime(date)).toBe("2025-02-02 03:04:05");
    });
});
