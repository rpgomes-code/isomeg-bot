import { describe, expect, it } from "vitest";
import { findGuildCommandDuplicates } from "../lib/commandRegistrations";

describe("guild command cleanup plan", () => {
    const globalCommand = { id: "global-8ball", name: "8ball", type: 1 };
    const guildCommand = { id: "guild-8ball", name: "8ball", type: 1 };

    it("targets the server copy while retaining its global replacement", () => {
        expect(findGuildCommandDuplicates([globalCommand], [guildCommand], [])).toEqual([
            { guildCommand, globalCommand, hasPermissionOverrides: false },
        ]);
    });

    it("leaves guild-only commands and different command types alone", () => {
        expect(findGuildCommandDuplicates([globalCommand], [
            { id: "guild-poll", name: "poll", type: 1 },
            { id: "guild-user-action", name: "8ball", type: 2 },
        ], [])).toEqual([]);
    });

    it("does not remove any commands when the global registry is empty", () => {
        expect(findGuildCommandDuplicates([], [guildCommand], [])).toEqual([]);
    });

    it("flags server copies with custom role, user or channel permissions for preservation", () => {
        const plan = findGuildCommandDuplicates([globalCommand], [guildCommand], [
            { id: guildCommand.id, permissions: [{ id: "role", type: 1, permission: false }] },
        ]);
        expect(plan[0].hasPermissionOverrides).toBe(true);
    });

    it("does not confuse unrelated permission entries with a duplicate's overrides", () => {
        const plan = findGuildCommandDuplicates([globalCommand], [guildCommand], [
            { id: "another-command", permissions: [{ permission: false }] },
            { id: guildCommand.id, permissions: [] },
        ]);
        expect(plan[0].hasPermissionOverrides).toBe(false);
    });
});
