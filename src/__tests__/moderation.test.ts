import { beforeAll, describe, expect, it } from "vitest";
import { PermissionFlagsBits, type PermissionResolvable } from "discord.js";

type ModerationModule = typeof import("../lib/moderation");

let moderation: ModerationModule;

beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/isomeg_test";
    moderation = await import("../lib/moderation");
});

function member(options: {
    id: string;
    ownerId?: string;
    permissions?: PermissionResolvable[];
    roleCompare?: number;
}) {
    const permissions = new Set(options.permissions ?? []);

    return {
        id: options.id,
        guild: { ownerId: options.ownerId ?? "owner" },
        permissions: {
            has: (permission: PermissionResolvable) => permissions.has(permission),
        },
        roles: {
            highest: {
                comparePositionTo: () => options.roleCompare ?? 1,
            },
        },
    } as any;
}

describe("moderation permission checks", () => {
    it("allows administrators without the specific permission", () => {
        const moderator = member({
            id: "mod",
            permissions: [PermissionFlagsBits.Administrator],
        });

        expect(moderation.hasModeratorPermission(moderator, PermissionFlagsBits.BanMembers)).toBe(true);
    });

    it("requires the requested moderation permission", () => {
        const moderator = member({
            id: "mod",
            permissions: [PermissionFlagsBits.ModerateMembers],
        });

        expect(moderation.hasModeratorPermission(moderator, PermissionFlagsBits.BanMembers)).toBe(false);
        expect(moderation.hasModeratorPermission(moderator, PermissionFlagsBits.ModerateMembers)).toBe(true);
    });

    it("blocks self-targeting and equal or higher target roles", () => {
        const check = moderation.checkModPermissions(
            member({ id: "mod", permissions: [PermissionFlagsBits.ModerateMembers], roleCompare: 0 }),
            member({ id: "mod" }),
            member({ id: "bot", roleCompare: 1 })
        );

        expect(check.targetHigher).toBe(true);
        expect(moderation.getModPermissionFailure(check, "mute")).toBe("Cannot mute a user with equal or higher role than you.");
    });

    it("blocks actions when the bot role is not high enough", () => {
        const check = moderation.checkModPermissions(
            member({ id: "mod", permissions: [PermissionFlagsBits.ModerateMembers], roleCompare: 1 }),
            member({ id: "target" }),
            member({ id: "bot", roleCompare: 0 })
        );

        expect(check.botHigher).toBe(true);
        expect(moderation.getModPermissionFailure(check, "warn")).toBe("I can't warn users with equal or higher role than me.");
    });

    it("lets the guild owner pass target role hierarchy checks", () => {
        const check = moderation.checkModPermissions(
            member({ id: "owner", ownerId: "owner", permissions: [PermissionFlagsBits.ModerateMembers], roleCompare: -1 }),
            member({ id: "target", ownerId: "owner" }),
            member({ id: "bot", ownerId: "owner", roleCompare: 1 })
        );

        expect(check.targetHigher).toBe(false);
        expect(moderation.getModPermissionFailure(check, "warn")).toBeNull();
    });
});
