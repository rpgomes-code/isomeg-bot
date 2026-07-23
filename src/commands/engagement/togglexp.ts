import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags, PermissionFlagsBits } from "discord.js";
import { CommandType } from "../../enums/commands/general";
import { createCommandLog } from "../../lib/logger";
import { ensureGuildSettings, updateGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";

export class ToggleXpCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "togglexp",
            description: "Enable or disable XP awards in this server.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("togglexp")
                    .setDescription("Enable or disable XP awards in this server.")
                    .addBooleanOption((option) =>
                        option
                            .setName("enabled")
                            .setDescription("Whether XP should be enabled.")
                            .setRequired(false)
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
            createdAt: interaction.createdAt,
        });

        if (!interaction.guild) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You don't have permission to update XP settings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const settings = await ensureGuildSettings(interaction.guild.id, interaction.guild.name);
        const enabled = interaction.options.getBoolean("enabled") ?? !settings.xpEnabled;
        await updateGuildSettings(interaction.guild.id, { xpEnabled: enabled });

        await interaction.reply({ content: `XP is now ${enabled ? "enabled" : "disabled"}.`, flags: [MessageFlags.Ephemeral] });
    }

    public override async messageRun(message: Message): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const moderator = await message.guild.members.fetch(message.author.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await message.reply("You don't have permission to update XP settings.");
            return;
        }

        const settings = await ensureGuildSettings(message.guild.id, message.guild.name);
        const enabled = !settings.xpEnabled;
        await updateGuildSettings(message.guild.id, { xpEnabled: enabled });
        await message.reply(`XP is now ${enabled ? "enabled" : "disabled"}.`);
    }
}
