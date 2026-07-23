import { Listener, Events } from "@sapphire/framework";
import { addXp, getRandomXp } from "../lib/xp";
import { db } from "../db";
import { guilds } from "../db/schema";
import { eq } from "drizzle-orm";
import { seedGuild } from "../db/seed";

export class MessageCreateListener extends Listener {
    constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.MessageCreate,
        });
    }

    public async run(message: {
        author: { bot: boolean; id: string; tag: string; displayName: string };
        guildId: string | null;
        guild: { name: string } | null;
    }): Promise<void> {
        if (message.author.bot || !message.guildId) return;

        let guildConfig = await db
            .select({ xpEnabled: guilds.xpEnabled, xpNotifyInDm: guilds.xpNotifyInDm })
            .from(guilds)
            .where(eq(guilds.guildId, message.guildId))
            .limit(1);

        if (guildConfig.length === 0) {
            await seedGuild(message.guildId, message.guild?.name ?? "Unknown Guild");
            guildConfig = [{ xpEnabled: true, xpNotifyInDm: true }];
        }

        if (!guildConfig[0].xpEnabled) return;

        const result = await addXp(message.guildId, message.author.id, getRandomXp());
        if (!result.awarded) return;

        if (result.leveledUp) {
            this.container.logger.info(
                `Level up! ${message.author.tag} reached level ${result.newLevel} in ${message.guild?.name ?? "Unknown"}`
            );
        }
    }
}
