import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChannelType, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, MessageFlags, PermissionFlagsBits } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { ensureGuildSettings, updateGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";
import { DEFAULT_GOODBYE_MESSAGE, DEFAULT_WELCOME_MESSAGE } from "../../lib/welcome";

export class WelcomeCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "welcome",
            description: "Configure welcome and goodbye messages.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("welcome")
                .setDescription("Configure welcome and goodbye messages.")
                .addSubcommand((subcommand) =>
                    subcommand.setName("view").setDescription("View welcome and goodbye settings.")
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("set")
                        .setDescription("Set the welcome channel and optional message.")
                        .addChannelOption((option) =>
                            option
                                .setName("channel")
                                .setDescription("Channel for welcome messages.")
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName("message")
                                .setDescription("Use {user}, {userTag}, {username}, {server}, {memberCount}.")
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("goodbye")
                        .setDescription("Set the goodbye channel and optional message.")
                        .addChannelOption((option) =>
                            option
                                .setName("channel")
                                .setDescription("Channel for goodbye messages.")
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName("message")
                                .setDescription("Use {userTag}, {username}, {server}, {memberCount}.")
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("disable")
                        .setDescription("Disable welcome or goodbye messages.")
                        .addStringOption((option) =>
                            option
                                .setName("type")
                                .setDescription("Which message type to disable.")
                                .setRequired(true)
                                .addChoices(
                                    { name: "Welcome", value: "welcome" },
                                    { name: "Goodbye", value: "goodbye" }
                                )
                        )
                ),
            { registerCommandIfMissing: true }
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
            await interaction.reply({ embeds: [this.createWelcomeEmbed(settings)], flags: [MessageFlags.Ephemeral] });
            return;
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You don't have permission to update welcome settings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (subcommand === "set") {
            const channel = interaction.options.getChannel("channel", true);
            const message = interaction.options.getString("message");
            const updated = await updateGuildSettings(interaction.guild.id, {
                welcomeChannelId: channel.id,
                welcomeEnabled: true,
                welcomeMessage: message?.trim() || settings.welcomeMessage,
            });

            await interaction.reply({ embeds: [this.createWelcomeEmbed(updated ?? settings)], flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (subcommand === "goodbye") {
            const channel = interaction.options.getChannel("channel", true);
            const message = interaction.options.getString("message");
            const updated = await updateGuildSettings(interaction.guild.id, {
                goodbyeChannelId: channel.id,
                goodbyeEnabled: true,
                goodbyeMessage: message?.trim() || settings.goodbyeMessage,
            });

            await interaction.reply({ embeds: [this.createWelcomeEmbed(updated ?? settings)], flags: [MessageFlags.Ephemeral] });
            return;
        }

        const type = interaction.options.getString("type", true);
        const updated = await updateGuildSettings(interaction.guild.id, type === "welcome"
            ? { welcomeEnabled: false }
            : { goodbyeEnabled: false }
        );

        await interaction.reply({ embeds: [this.createWelcomeEmbed(updated ?? settings)], flags: [MessageFlags.Ephemeral] });
    }

    public override async messageRun(message: Message): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const settings = await ensureGuildSettings(message.guild.id, message.guild.name);
        await message.reply({ embeds: [this.createWelcomeEmbed(settings)] });
    }

    private createWelcomeEmbed(settings: Awaited<ReturnType<typeof ensureGuildSettings>>): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle("Welcome Settings")
            .setColor(Colors.DarkAqua)
            .addFields([
                { name: "Welcome", value: `${settings.welcomeEnabled ? "Enabled" : "Disabled"} | ${settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : "No channel"}`, inline: false },
                { name: "Welcome Message", value: settings.welcomeMessage ?? DEFAULT_WELCOME_MESSAGE, inline: false },
                { name: "Goodbye", value: `${settings.goodbyeEnabled ? "Enabled" : "Disabled"} | ${settings.goodbyeChannelId ? `<#${settings.goodbyeChannelId}>` : "No channel"}`, inline: false },
                { name: "Goodbye Message", value: settings.goodbyeMessage ?? DEFAULT_GOODBYE_MESSAGE, inline: false },
            ])
            .setTimestamp();
    }
}
