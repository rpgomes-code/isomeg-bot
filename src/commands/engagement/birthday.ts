import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChannelType, ChatInputCommandInteraction, Colors, EmbedBuilder, Message, MessageFlags, PermissionFlagsBits } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { formatBirthday, getBirthday, listBirthdays, removeBirthday, setBirthday } from "../../lib/birthdays";
import { ensureGuildSettings, updateGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";

export class BirthdayCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "birthday",
            description: "Manage birthday reminders.",
            aliases: ["bday"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("birthday")
                .setDescription("Manage birthday reminders.")
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("set")
                        .setDescription("Set your birthday.")
                        .addIntegerOption((option) => option.setName("month").setDescription("Month number, 1-12.").setRequired(true).setMinValue(1).setMaxValue(12))
                        .addIntegerOption((option) => option.setName("day").setDescription("Day number.").setRequired(true).setMinValue(1).setMaxValue(31))
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("view")
                        .setDescription("View a birthday.")
                        .addUserOption((option) => option.setName("user").setDescription("User to check.").setRequired(false))
                )
                .addSubcommand((subcommand) => subcommand.setName("list").setDescription("List upcoming birthdays."))
                .addSubcommand((subcommand) => subcommand.setName("remove").setDescription("Remove your birthday."))
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName("channel")
                        .setDescription("Set the birthday reminder channel.")
                        .addChannelOption((option) =>
                            option
                                .setName("channel")
                                .setDescription("Channel for birthday reminders.")
                                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                                .setRequired(true)
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

        await ensureGuildSettings(interaction.guild.id, interaction.guild.name);
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "set") {
            const month = interaction.options.getInteger("month", true);
            const day = interaction.options.getInteger("day", true);
            try {
                await setBirthday(interaction.guild.id, interaction.user.id, month, day);
                await interaction.reply({ content: `Your birthday is set to ${formatBirthday(month, day)}.`, flags: [MessageFlags.Ephemeral] });
            } catch (error) {
                await interaction.reply({ content: error instanceof Error ? error.message : "Could not set birthday.", flags: [MessageFlags.Ephemeral] });
            }
            return;
        }

        if (subcommand === "remove") {
            const removed = await removeBirthday(interaction.guild.id, interaction.user.id);
            await interaction.reply({ content: removed ? "Your birthday was removed." : "You do not have a birthday set.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        if (subcommand === "view") {
            const target = interaction.options.getUser("user") ?? interaction.user;
            const birthday = await getBirthday(interaction.guild.id, target.id);
            await interaction.reply({
                content: birthday ? `${target} has a birthday on ${formatBirthday(birthday.month, birthday.day)}.` : `${target} has no birthday set.`,
                flags: [MessageFlags.Ephemeral],
            });
            return;
        }

        if (subcommand === "list") {
            await interaction.reply({ embeds: [await this.createBirthdayListEmbed(interaction.guild.id)], flags: [MessageFlags.Ephemeral] });
            return;
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You don't have permission to update birthday settings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const channel = interaction.options.getChannel("channel", true);
        await updateGuildSettings(interaction.guild.id, { birthdayChannelId: channel.id });
        await interaction.reply({ content: `Birthday reminders will be sent in ${channel}.`, flags: [MessageFlags.Ephemeral] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const month = Number.parseInt(await args.single("string").catch(() => ""), 10);
        const day = Number.parseInt(await args.single("string").catch(() => ""), 10);
        if (!month || !day) {
            await message.reply("Usage: `$birthday <month> <day>` or use `/birthday` for more options.");
            return;
        }

        try {
            await setBirthday(message.guild.id, message.author.id, month, day);
            await message.reply(`Your birthday is set to ${formatBirthday(month, day)}.`);
        } catch (error) {
            await message.reply(error instanceof Error ? error.message : "Could not set birthday.");
        }
    }

    private async createBirthdayListEmbed(guildId: string): Promise<EmbedBuilder> {
        const rows = await listBirthdays(guildId);
        const description = rows.length > 0
            ? rows.slice(0, 20).map((row) => `<@${row.userId}> - ${formatBirthday(row.month, row.day)}`).join("\n")
            : "No birthdays have been set yet.";

        return new EmbedBuilder()
            .setTitle("Birthdays")
            .setColor(Colors.DarkAqua)
            .setDescription(description)
            .setFooter({ text: rows.length > 20 ? `Showing 20 of ${rows.length}` : "Dates use UTC for reminders." })
            .setTimestamp();
    }
}
