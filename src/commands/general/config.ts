import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Colors, EmbedBuilder, Message, MessageFlags, PermissionFlagsBits } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { ensureGuildSettings, normalizeXpRange, updateGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";

export class ConfigCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "config",
            description: "View or update server bot settings.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("config")
                    .setDescription("View or update server bot settings.")
                    .addSubcommand((subcommand) =>
                        subcommand
                            .setName("view")
                            .setDescription("View current server settings.")
                    )
                    .addSubcommand((subcommand) =>
                        subcommand
                            .setName("xp")
                            .setDescription("Update XP cooldown and award range.")
                            .addIntegerOption((option) =>
                                option
                                    .setName("cooldown-seconds")
                                    .setDescription("Seconds between XP gains per user.")
                                    .setRequired(false)
                                    .setMinValue(5)
                                    .setMaxValue(3600)
                            )
                            .addIntegerOption((option) =>
                                option
                                    .setName("min-xp")
                                    .setDescription("Minimum XP awarded per eligible message.")
                                    .setRequired(false)
                                    .setMinValue(1)
                                    .setMaxValue(1000)
                            )
                            .addIntegerOption((option) =>
                                option
                                    .setName("max-xp")
                                    .setDescription("Maximum XP awarded per eligible message.")
                                    .setRequired(false)
                                    .setMinValue(1)
                                    .setMaxValue(1000)
                            )
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

        const settings = await ensureGuildSettings(interaction.guild.id, interaction.guild.name);
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "view") {
            await interaction.reply({ embeds: [this.createSettingsEmbed(settings)], flags: [MessageFlags.Ephemeral] });
            return;
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You don't have permission to update server settings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const cooldownSeconds = interaction.options.getInteger("cooldown-seconds") ?? settings.xpCooldownSeconds;
        const minXp = interaction.options.getInteger("min-xp") ?? settings.xpMin;
        const maxXp = interaction.options.getInteger("max-xp") ?? settings.xpMax;

        try {
            const range = normalizeXpRange(minXp, maxXp);
            const updated = await updateGuildSettings(interaction.guild.id, {
                xpCooldownSeconds: cooldownSeconds,
                xpMin: range.min,
                xpMax: range.max,
            });

            await interaction.reply({
                embeds: [this.createSettingsEmbed(updated ?? settings).setTitle("Updated Server Settings")],
                flags: [MessageFlags.Ephemeral],
            });
        } catch (error) {
            await interaction.reply({
                content: error instanceof Error ? error.message : "Failed to update XP settings.",
                flags: [MessageFlags.Ephemeral],
            });
        }
    }

    public override async messageRun(message: Message): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const settings = await ensureGuildSettings(message.guild.id, message.guild.name);
        await message.reply({ embeds: [this.createSettingsEmbed(settings)] });
    }

    private createSettingsEmbed(settings: Awaited<ReturnType<typeof ensureGuildSettings>>): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle("Server Settings")
            .setColor(Colors.DarkAqua)
            .addFields([
                { name: "Prefix", value: `\`${settings.prefix}\``, inline: true },
                { name: "XP Enabled", value: settings.xpEnabled ? "Yes" : "No", inline: true },
                { name: "Level-up DMs", value: settings.xpNotifyInDm ? "Yes" : "No", inline: true },
                { name: "Welcome", value: `${settings.welcomeEnabled ? "Yes" : "No"} | ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "Not set"}`, inline: true },
                { name: "Goodbye", value: `${settings.goodbyeEnabled ? "Yes" : "No"} | ${settings.goodbyeChannelId ? `<#${settings.goodbyeChannelId}>` : "Not set"}`, inline: true },
                { name: "Birthday Channel", value: settings.birthdayChannelId ? `<#${settings.birthdayChannelId}>` : "Not set", inline: true },
                { name: "XP Range", value: `${settings.xpMin}-${settings.xpMax}`, inline: true },
                { name: "XP Cooldown", value: `${settings.xpCooldownSeconds}s`, inline: true },
                { name: "XP Channel", value: settings.xpChannelId ? `<#${settings.xpChannelId}>` : "Any channel", inline: true },
                { name: "Mod Log", value: settings.modLogChannelId ? `<#${settings.modLogChannelId}>` : "Not set", inline: true },
                { name: "Music Enabled", value: settings.musicEnabled ? "Yes" : "No", inline: true },
            ])
            .setTimestamp();
    }
}
