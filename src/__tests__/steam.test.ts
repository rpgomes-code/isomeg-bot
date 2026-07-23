import { describe, expect, it } from "vitest";
import { formatSteamMinutes, parseSteamLookupInput } from "../lib/steam";

describe("Steam helpers", () => {
    it("parses SteamID64 input", () => {
        expect(parseSteamLookupInput("76561197960287930")).toEqual({
            type: "steamid",
            value: "76561197960287930",
        });
    });

    it("parses vanity profile URLs", () => {
        expect(parseSteamLookupInput("https://steamcommunity.com/id/example-user/")).toEqual({
            type: "vanity",
            value: "example-user",
        });
    });

    it("formats Steam playtime", () => {
        expect(formatSteamMinutes(45)).toBe("45m");
        expect(formatSteamMinutes(125)).toBe("2h 5m");
        expect(formatSteamMinutes(180)).toBe("3h");
    });
});
