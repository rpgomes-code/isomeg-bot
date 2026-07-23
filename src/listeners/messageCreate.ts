import { Listener, Events } from "@sapphire/framework";
import type { Message } from "discord.js";
import { addXp, getRandomXp } from "../lib/xp";
import { ensureGuildSettings } from "../lib/guildSettings";
import { recordMessageActivity } from "../lib/activity";

export class MessageCreateListener extends Listener {
    constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.MessageCreate,
        });
    }

    public async run(message: Message): Promise<void> {
        if (message.author.bot || !message.guildId || !message.guild) return;

        const guildConfig = await ensureGuildSettings(message.guildId, message.guild.name);

        await recordMessageActivity(message.guildId, message.channelId, message.author.id).catch((error) => {
            this.container.logger.warn(
                `[Activity] Could not record message activity: ${error instanceof Error ? error.message : error}`
            );
        });

        if (!guildConfig.xpEnabled) return;
        if (guildConfig.xpChannelId && guildConfig.xpChannelId !== message.channelId) return;

        const result = await addXp(
            message.guildId,
            message.author.id,
            getRandomXp(guildConfig.xpMin, guildConfig.xpMax),
            guildConfig.xpCooldownSeconds * 1000
        );

        if (!result.awarded || !result.leveledUp) return;

        this.container.logger.info(
            `Level up! ${message.author.tag} reached level ${result.newLevel} in ${message.guild.name}`
        );

        if (guildConfig.xpNotifyInDm) {
            await message.author.send(
                `You reached level ${result.newLevel} in ${message.guild.name}. Nice work.`
            ).catch((error) => {
                this.container.logger.warn(
                    `[XP] Could not DM level-up notification to ${message.author.tag}: ${error instanceof Error ? error.message : error}`
                );
            });
        }
    }
}
