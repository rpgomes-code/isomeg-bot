import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { getUserData } from "../../lib/xp";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class BalanceCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "balance",
            description: "Check your coin balance.",
            aliases: ["bal", "coins"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('balance')
                    .setDescription("Check your coin balance.")
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

        const coins = data?.coins ?? 0;

        const embed = new EmbedBuilder()
            .setTitle(`Balance for ${target.displayName}`)
            .setColor(Colors.Gold)
            .setDescription(`You have **${coins}** coins.`)
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
        const coins = data?.coins ?? 0;

        await message.reply(`${target.displayName} has ${coins} coins.`);
    }
}
