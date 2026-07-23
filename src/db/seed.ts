import { db } from ".";
import { guilds } from "./schema/index";
import { eq } from "drizzle-orm";
import { DEFAULT_PREFIX, DEFAULT_XP_COOLDOWN_SECONDS, DEFAULT_XP_MAX, DEFAULT_XP_MIN } from "../constants/defaults";

export async function seedGuild(guildId: string, guildName: string) {
    console.log(`Checking guild "${guildName}" (${guildId}) exists...`);

    const existing = await db
        .select({ id: guilds.id })
        .from(guilds)
        .where(eq(guilds.guildId, guildId))
        .limit(1);

    if (existing.length > 0) {
        console.log(`Guild "${guildName}" already exists in database.`);
        return false;
    }

    await db.insert(guilds).values({
        guildId,
        guildName,
        prefix: DEFAULT_PREFIX,
        welcomeEnabled: true,
        goodbyeEnabled: true,
        xpEnabled: true,
        xpNotifyInDm: true,
        xpCooldownSeconds: DEFAULT_XP_COOLDOWN_SECONDS,
        xpMin: DEFAULT_XP_MIN,
        xpMax: DEFAULT_XP_MAX,
        musicEnabled: true,
    });

    console.log(`Guild "${guildName}" seeded successfully.`);
    return true;
}
