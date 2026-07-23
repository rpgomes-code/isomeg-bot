import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChannelType, ChatInputCommandInteraction, Message, MessageFlags, PermissionFlagsBits } from "discord.js";
import { CommandType } from "../../enums/commands/general";
import { createCommandLog } from "../../lib/logger";
import { ensureGuildSettings, updateGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";

export class SetXpChannelCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "setxpchannel",
            description: "Restrict XP awards to a specific text channel.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("setxpchannel")
                    .setDescription("Restrict XP awards to a specific text channel.")
                    .addChannelOption((option) =>
                        option
                            .setName("channel")
                            .setDescription("Channel where XP can be earned. Omit with clear=true to allow all channels.")
                            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                            .setRequired(false)
                    )
                    .addBooleanOption((option) =>
                        option
                            .setName("clear")
                            .setDescription("Clear the XP channel restriction.")
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

        await ensureGuildSettings(interaction.guild.id, interaction.guild.name);
        const clear = interaction.options.getBoolean("clear") ?? false;
        const channel = interaction.options.getChannel("channel");

        if (!clear && !channel) {
            await interaction.reply({ content: "Choose a channel or set clear to true.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        await updateGuildSettings(interaction.guild.id, { xpChannelId: clear ? null : channel!.id });
        await interaction.reply({
            content: clear ? "XP can now be earned in any channel." : `XP can now be earned only in ${channel}.`,
            flags: [MessageFlags.Ephemeral],
        });
    }

    public override async messageRun(message: Message): Promise<void> {
        await message.reply("Please use `/setxpchannel` so Discord can validate the channel selection.");
    }
}
