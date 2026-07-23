import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { getUserData, calculateLevel } from "../../lib/xp";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class LevelCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "level",
            description: "Check your level and XP.",
            aliases: ["rank", "xp"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('level')
                    .setDescription("Check your level and XP.")
                    .addUserOption((option) =>
                        option.setName("user").setDescription("User to check").setRequired(false)
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

        const target = interaction.options.getUser("user") ?? interaction.user;
        const data = await getUserData(interaction.guild.id, target.id);

        if (!data) {
            await interaction.reply({
                content: `${target.tag} has no XP yet. Start chatting to earn XP!`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const levelInfo = calculateLevel(data.xp);
        const progress = data.xp > 0 ? (levelInfo.xpInLevel / (levelInfo.xpInLevel + levelInfo.xpToNext)) * 100 : 0;
        const bar = this.getProgressBar(progress);

        const embed = new EmbedBuilder()
            .setTitle(`Level for ${target.displayName}`)
            .setColor(Colors.DarkAqua)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields([
                { name: "Level", value: `**${data.level}**`, inline: true },
                { name: "Total XP", value: `**${data.xp}**`, inline: true },
                { name: "Progress", value: `${bar} ${levelInfo.xpInLevel}/${levelInfo.xpInLevel + levelInfo.xpToNext}`, inline: false },
            ])
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }

    public override async messageRun(message: Message, _args: any): Promise<void> {
        if (!message.guild) return;

        createCommandLog({
            command: this.name,
            guild: message.guild.name,
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const target = message.mentions.users.first() ?? message.author;
        const data = await getUserData(message.guild.id, target.id);

        if (!data) {
            await message.reply(`${target.tag} has no XP yet. Start chatting to earn XP!`);
            return;
        }

        const levelInfo = calculateLevel(data.xp);
        await message.reply(`Level ${data.level} | ${data.xp} XP`);
    }

    private getProgressBar(progress: number): string {
        const totalBars = 10;
        const filledBars = Math.round((progress / 100) * totalBars);
        return "▓".repeat(filledBars) + "░".repeat(totalBars - filledBars);
    }
}
