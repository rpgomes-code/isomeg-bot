import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Colors, EmbedBuilder, Message, MessageFlags } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getActivitySummary } from "../../lib/activity";

export class ActivityCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "activity",
            description: "Show server activity analytics.",
            aliases: ["stats"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("activity")
                .setDescription("Show server activity analytics.")
                .addIntegerOption((option) =>
                    option
                        .setName("days")
                        .setDescription("Number of days to include.")
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(30)
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

        const days = interaction.options.getInteger("days") ?? 7;
        await interaction.reply({ embeds: [await this.createActivityEmbed(interaction.guild.id, days)] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const days = Number.parseInt(await args.single("string").catch(() => "7"), 10) || 7;
        await message.reply({ embeds: [await this.createActivityEmbed(message.guild.id, days)] });
    }

    private async createActivityEmbed(guildId: string, days: number): Promise<EmbedBuilder> {
        const summary = await getActivitySummary(guildId, days);

        return new EmbedBuilder()
            .setTitle(`Activity Analytics (${Math.min(Math.max(days, 1), 30)} days)`)
            .setColor(Colors.DarkAqua)
            .addFields([
                { name: "Messages", value: summary.totalMessages.toLocaleString(), inline: true },
                { name: "Active Users", value: summary.activeUsers.toLocaleString(), inline: true },
                { name: "Active Channels", value: summary.activeChannels.toLocaleString(), inline: true },
                {
                    name: "Top Users",
                    value: summary.topUsers.length > 0
                        ? summary.topUsers.map((user, index) => `${index + 1}. <@${user.userId}> - ${user.messages}`).join("\n")
                        : "No activity yet.",
                    inline: false,
                },
                {
                    name: "Top Channels",
                    value: summary.topChannels.length > 0
                        ? summary.topChannels.map((channel, index) => `${index + 1}. <#${channel.channelId}> - ${channel.messages}`).join("\n")
                        : "No activity yet.",
                    inline: false,
                },
            ])
            .setTimestamp();
    }
}
