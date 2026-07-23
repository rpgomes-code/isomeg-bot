import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { db } from "../../db";
import { users } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { DAILY_COINS } from "../../lib/xp";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class DailyCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "daily",
            description: "Claim your daily coins.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('daily')
                    .setDescription("Claim your daily coins."),
            {
                registerCommandIfMissing: true,
            }
        );
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: interaction.guild?.name ?? "DM",
            type: CommandType.Slash,
            user: { username: interaction.user.username, displayName: interaction.user.displayName },
            createdAt: interaction.createdAt
        });

        if (!interaction.guild) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const guildId = interaction.guild.id;
        const userId = interaction.user.id;
        const now = new Date();

        let result = await db
            .select()
            .from(users)
            .where(and(eq(users.guildId, guildId), eq(users.userId, userId)))
            .limit(1);

        if (result.length === 0) {
            await db.insert(users).values({ guildId, userId, coins: DAILY_COINS, dailyClaimedAt: now });
        } else {
            const user = result[0];
            const lastClaim = user.dailyClaimedAt;

            if (lastClaim && now.getTime() - lastClaim.getTime() < 24 * 60 * 60 * 1000) {
                const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now.getTime() - lastClaim.getTime())) / (60 * 60 * 1000));
                await interaction.reply({
                    content: `You already claimed your daily! Come back in ~${hoursLeft} hours.`,
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }

            await db
                .update(users)
                .set({ coins: user.coins + DAILY_COINS, dailyClaimedAt: now })
                .where(and(eq(users.guildId, guildId), eq(users.userId, userId)));
        }

        await interaction.reply({
            content: `You claimed your daily **${DAILY_COINS}** coins!`,
        });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        createCommandLog({
            command: this.name,
            guild: message.guild.name,
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const guildId = message.guild.id;
        const userId = message.author.id;
        const now = new Date();

        let result = await db
            .select()
            .from(users)
            .where(and(eq(users.guildId, guildId), eq(users.userId, userId)))
            .limit(1);

        if (result.length === 0) {
            await db.insert(users).values({ guildId, userId, coins: DAILY_COINS, dailyClaimedAt: now });
            await message.reply(`Claimed daily ${DAILY_COINS} coins!`);
        } else {
            const user = result[0];
            const lastClaim = user.dailyClaimedAt;
            if (lastClaim && now.getTime() - lastClaim.getTime() < 24 * 60 * 60 * 1000) {
                const hoursLeft = Math.ceil((24 * 60 * 60 * 1000 - (now.getTime() - lastClaim.getTime())) / (60 * 60 * 1000));
                await message.reply(`You already claimed your daily! Come back in ~${hoursLeft} hours.`);
                return;
            }
            await db.update(users).set({ coins: user.coins + DAILY_COINS, dailyClaimedAt: now })
                .where(and(eq(users.guildId, guildId), eq(users.userId, userId)));
            await message.reply(`Claimed daily ${DAILY_COINS} coins!`);
        }
    }
}
