import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { DEFAULT_PREFIX } from "../../constants/defaults";
import { ensureGuildSettings } from "../../lib/guildSettings";

interface CommandInfo {
    name: string;
    description: string;
    aliases: string[];
}

export class HelpCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "help",
            description: "Show all available commands.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('help')
                    .setDescription("Show all available commands.")
                    .addStringOption((option) =>
                        option.setName("category")
                            .setDescription("Filter by category name")
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
            createdAt: interaction.createdAt
        });

        const category = interaction.options.getString("category");
        const prefix = await this.getPrefix(interaction.guild?.id, interaction.guild?.name);
        const commands = this.getCommandsByCategory();

        const embed = new EmbedBuilder()
            .setTitle("Help")
            .setColor(Colors.DarkAqua)
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        if (category) {
            const match = this.findCategory(commands, category);
            if (!match) {
                await interaction.reply({ content: "Unknown category.", flags: [MessageFlags.Ephemeral] });
                return;
            }

            embed
                .setTitle(`Help: ${match}`)
                .setDescription(commands[match].map(command => this.formatCommand(command, prefix)).join("\n"));
        } else {
            let total = "";
            for (const [cat, cmds] of Object.entries(commands)) {
                total += `**${cat}** (${cmds.length} commands)\n`;
            }
            embed.setDescription(
                total + `\nUse \`${prefix}help <category>\` or \`/help category:<category>\` for a specific category.\n` +
                `Prefix: \`${prefix}\``
            );
        }

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const rawCategory = await args.remainder('string').catch(() => null);
        const prefix = await this.getPrefix(message.guild?.id, message.guild?.name);
        const commands = this.getCommandsByCategory();
        const category = rawCategory ? this.findCategory(commands, rawCategory) : undefined;

        if (category) {
            const description = commands[category].map(command => this.formatCommand(command, prefix)).join("\n");
            await message.reply(description);
        } else {
            let description = "";
            for (const [cat, cmds] of Object.entries(commands)) {
                description += `**${cat}** (${cmds.length} commands)\n`;
            }
            description += `\nUse \`${prefix}help <category>\` to see commands for a specific category.`;
            await message.reply(description);
        }
    }

    private getCommandsByCategory(): Record<string, CommandInfo[]> {
        const commandStore = this.container.stores.get("commands");
        const categories: Record<string, CommandInfo[]> = {};

        for (const command of commandStore.values()) {
            const commandAny = command as Command & { fullCategory?: string[]; category?: string | null; aliases?: string[] };
            const category = this.formatCategory(commandAny.fullCategory?.[0] ?? commandAny.category ?? "Other");
            categories[category] ??= [];
            categories[category].push({
                name: command.name,
                description: command.description,
                aliases: commandAny.aliases ?? [],
            });
        }

        const sortedEntries = Object.entries(categories)
            .map(([category, commands]): [string, CommandInfo[]] => [
                category,
                commands.sort((a, b) => a.name.localeCompare(b.name)),
            ])
            .sort(([a], [b]) => a.localeCompare(b));

        return Object.fromEntries(sortedEntries);
    }

    private findCategory(commands: Record<string, CommandInfo[]>, category: string): string | null {
        const normalized = category.trim().toLowerCase();
        return Object.keys(commands).find((name) => name.toLowerCase() === normalized) ?? null;
    }

    private formatCategory(category: string): string {
        return category
            .split(/[\\/_-]/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ") || "Other";
    }

    private formatCommand(command: CommandInfo, prefix: string): string {
        const aliases = command.aliases.length > 0 ? ` (aliases: ${command.aliases.map(alias => `\`${prefix}${alias}\``).join(", ")})` : "";
        return `\`/${command.name}\` \`${prefix}${command.name}\` - ${command.description}${aliases}`;
    }

    private async getPrefix(guildId?: string, guildName?: string): Promise<string> {
        if (!guildId || !guildName) return DEFAULT_PREFIX;
        const settings = await ensureGuildSettings(guildId, guildName);
        return settings.prefix;
    }
}
