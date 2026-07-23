import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { HowLongToBeatService, SearchModifier } from 'howlongtobeat-ts';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class HltbCommand extends Command {
    private hltb = new HowLongToBeatService();

    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "hltb",
            description: "Check game completion times from howlongtobeat.com.",
            aliases: ["howlongtobeat"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('hltb')
                    .setDescription("Check game completion times from howlongtobeat.com.")
                    .addStringOption((option) =>
                        option.setName("game").setDescription("Name of the game").setRequired(true)
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

        const query = interaction.options.getString("game", true);
        await this.handleHltb(query, interaction);
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        createCommandLog({
            command: this.name,
            guild: message.guild?.name ?? "DM",
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const query = await args.rest('string').catch(() => null);
        if (!query) {
            await message.reply("Please provide a game name! e.g. `$hltb Elden Ring`");
            return;
        }
        await this.handleHltb(query, message);
    }

    private async handleHltb(query: string, target: ChatInputCommandInteraction | Message) {
        const sendError = async (content: string) => {
            if (target instanceof ChatInputCommandInteraction) {
                if (target.deferred || target.replied) {
                    await target.editReply(content);
                } else {
                    await target.reply({ content, flags: [MessageFlags.Ephemeral] });
                }
            } else {
                await target.reply(content);
            }
        };

        if (target instanceof ChatInputCommandInteraction && !target.deferred && !target.replied) {
            await target.deferReply();
        }

        let result: any;
        try {
            result = await this.hltb.search(query, SearchModifier.HIDE_DLC);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "An unexpected error occurred";
            return sendError(`❌ Error searching for "${query}": ${msg}`);
        }

        if (!result || result.length === 0) {
            return sendError(`No results found for "${query}".`);
        }

        const game = result[0];

        const formatTime = (seconds?: number, count?: number) => {
            if (!seconds) return "N/A";
            return `${this.formatHours(seconds / 3600)} (${this.formatNumber(count)} users)`;
        };

        const fields: { name: string; value: string; inline: boolean }[] = [
            { name: "Main Story", value: formatTime(game.mainTime, game.mainCount), inline: true },
            { name: "Main + Extras", value: formatTime(game.mainExtraTime, game.mainExtraCount), inline: true },
            { name: "Completionist", value: formatTime(game.completionistTime, game.completionistCount), inline: true },
            { name: "All Styles", value: formatTime(game.allStylesTime, game.allStylesCount), inline: true },
        ];

        if (game.coopTime) fields.push({ name: "Co-op", value: formatTime(game.coopTime, game.coopCount), inline: true });
        if (game.multiplayerTime) fields.push({ name: "Multiplayer", value: formatTime(game.multiplayerTime, game.multiplayerCount), inline: true });

        const footerParts: string[] = [`Source: howlongtobeat.com`];
        if (game.releaseYear) footerParts.push(`Released: ${game.releaseYear}`);
        if (game.platforms.length > 0) footerParts.push(game.platforms.slice(0, 5).join(", "));

        const embed = new EmbedBuilder()
            .setTitle(`How Long To Beat: ${game.name}`)
            .setColor(Colors.DarkAqua)
            .addFields(fields)
            .setURL(`https://howlongtobeat.com/game.php?id=${game.id}`)
            .setTimestamp()
            .setFooter({ text: footerParts.join(" | ") });

        if (game.imageUrl) embed.setThumbnail(game.imageUrl);

        if (target instanceof ChatInputCommandInteraction) {
            await target.editReply({ embeds: [embed] });
        } else {
            await target.reply({ embeds: [embed] });
        }
    }

    private formatHours(hours: number): string {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }

    private formatNumber(n?: number): string {
        if (!n) return "0";
        return n.toLocaleString();
    }
}
