import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message, PermissionFlagsBits } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { db } from "../../db";
import { guilds } from "../../db/schema";
import { eq } from "drizzle-orm";
import { hasModeratorPermission } from '../../lib/moderation';
import { seedGuild } from "../../db/seed";

export class SetlogCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "setlog",
            description: "Set the moderation log channel.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('setlog')
                    .setDescription("Set the moderation log channel.")
                    .addChannelOption((option) =>
                        option.setName("channel").setDescription("Channel to log mod actions to").setRequired(true)
                    ),
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

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You don't have permission to update server settings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const channel = interaction.options.getChannel("channel", true);

        try {
            await seedGuild(interaction.guild.id, interaction.guild.name);
            await db
                .update(guilds)
                .set({ modLogChannelId: channel.id, updatedAt: new Date() })
                .where(eq(guilds.guildId, interaction.guild.id));
        } catch {
            await interaction.reply({
                content: "Failed to update log channel. Make sure this guild is registered in the database.",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        await interaction.reply({
            content: `Moderation log channel set to ${channel}.`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        // This command requires a channel mention which is complex in prefix format
        await message.reply("Please use the slash command: `/setlog channel:<channel>` to set the moderation log channel.");
    }
}
