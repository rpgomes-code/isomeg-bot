import { db } from ".";
import { guilds } from "./schema/index";
import { eq } from "drizzle-orm";

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
        prefix: "$",
        xpEnabled: true,
        musicEnabled: true,
    });

    console.log(`Guild "${guildName}" seeded successfully.`);
    return true;
}
