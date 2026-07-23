import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    Colors,
    ComponentType,
    EmbedBuilder,
    Message,
    MessageFlags,
} from "discord.js";
import type { GuildQueue } from "discord-player";
import { getPlayer } from "../../music/player";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { repeatModeName } from "../../lib/musicGuards";

const PAGE_SIZE = 10;

export class QueueCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "queue",
            description: "Display the current music queue.",
            aliases: ["q"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("queue")
                    .setDescription("Display the current music queue.")
                    .addIntegerOption((option) =>
                        option
                            .setName("page")
                            .setDescription("Queue page to show.")
                            .setRequired(false)
                            .setMinValue(1)
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

        const player = getPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || queue.deleted) {
            await interaction.reply({ content: "Nothing is playing right now.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        let page = Math.max(1, interaction.options.getInteger("page") ?? 1);
        const customIdPrefix = `queue:${interaction.id}`;
        await interaction.reply(this.createQueueMessage(queue, page, customIdPrefix));

        const totalPages = this.getTotalPages(queue);
        if (totalPages <= 1) return;

        const responseMessage = await interaction.fetchReply();
        const collector = responseMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 120_000,
            filter: (buttonInteraction) =>
                buttonInteraction.user.id === interaction.user.id &&
                buttonInteraction.customId.startsWith(customIdPrefix),
        });

        collector.on("collect", async (buttonInteraction) => {
            page += buttonInteraction.customId.endsWith(":next") ? 1 : -1;
            page = Math.min(Math.max(page, 1), this.getTotalPages(queue));
            await buttonInteraction.update(this.createQueueMessage(queue, page, customIdPrefix));
        });

        collector.on("end", async () => {
            await interaction.editReply({ components: [] }).catch(() => null);
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const player = getPlayer();
        const queue = player.nodes.get(message.guild.id);
        if (!queue || queue.deleted) {
            await message.reply("Nothing is playing right now.");
            return;
        }

        const page = Number.parseInt(await args.single("string").catch(() => "1"), 10) || 1;
        await message.reply({ embeds: [this.createQueueEmbed(queue, page)] });
    }

    private createQueueMessage(queue: GuildQueue, page: number, customIdPrefix: string) {
        const totalPages = this.getTotalPages(queue);
        const clampedPage = Math.min(Math.max(page, 1), totalPages);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`${customIdPrefix}:prev`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(clampedPage <= 1),
            new ButtonBuilder()
                .setCustomId(`${customIdPrefix}:next`)
                .setLabel("Next")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(clampedPage >= totalPages)
        );

        return {
            embeds: [this.createQueueEmbed(queue, clampedPage)],
            components: totalPages > 1 ? [row] : [],
        };
    }

    private createQueueEmbed(queue: GuildQueue, page: number): EmbedBuilder {
        const totalPages = this.getTotalPages(queue);
        const clampedPage = Math.min(Math.max(page, 1), totalPages);
        const start = (clampedPage - 1) * PAGE_SIZE;
        const tracks = queue.tracks
            .map((track, index) => `${index + 1}. **${track.title}**`)
            .slice(start, start + PAGE_SIZE);

        const currentTrack = queue.currentTrack;
        let description = currentTrack ? `Now playing: **${currentTrack.title}**\n\n` : "";
        description += tracks.length > 0 ? tracks.join("\n") : "*No upcoming tracks*";

        return new EmbedBuilder()
            .setTitle("Music Queue")
            .setColor(Colors.DarkAqua)
            .setDescription(description)
            .addFields([
                { name: "Volume", value: `${queue.options.volume}%`, inline: true },
                { name: "Repeat", value: repeatModeName(queue.repeatMode), inline: true },
                { name: "Tracks", value: `${queue.tracks.size}`, inline: true },
            ])
            .setFooter({ text: `Page ${clampedPage}/${totalPages}` })
            .setTimestamp();
    }

    private getTotalPages(queue: GuildQueue): number {
        return Math.max(1, Math.ceil(queue.tracks.size / PAGE_SIZE));
    }
}
