import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { RPSChoice } from "../../enums/commands/rps";
import { choices, winningCombos } from "../../constants/commands/rps";

export class RPSCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "rps",
            description: "Play rock, paper, scissors with the bot!",
            aliases: ["rockpaperscissors", "roshambo"]
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('rps')
                    .setDescription("Play rock, paper, scissors with the bot!")
                    .addStringOption((option) =>
                        option
                            .setName("choice")
                            .setDescription("Choose your weapon!")
                            .setRequired(true)
                            .addChoices(
                                { name: "Rock", value: RPSChoice.Rock },
                                { name: "Paper", value: RPSChoice.Paper },
                                { name: "Scissors", value: RPSChoice.Scissors }
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
            user: {
                username: interaction.user.username,
                displayName: interaction.user.displayName
            },
            createdAt: interaction.createdAt
        });

        const userChoice = interaction.options.getString("choice") as RPSChoice;
        const botChoice = this.getRandomChoice();

        let result: string;
        let color: number;

        if (userChoice === botChoice) {
            result = "It's a tie!";
            color = Colors.Yellow;
        } else if (winningCombos[userChoice] === botChoice) {
            result = "You win!";
            color = Colors.Green;
        } else {
            result = "I win!";
            color = Colors.Red;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle("Rock Paper Scissors")
            .addFields([
                {
                    name: "Your Choice",
                    value: this.capitalizeFirst(userChoice),
                    inline: true,
                },
                {
                    name: "My Choice",
                    value: this.capitalizeFirst(botChoice),
                    inline: true,
                },
                {
                    name: "Result",
                    value: result,
                    inline: false,
                }
            ])
            .setTimestamp()
            .setFooter({
                text: `Played by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await interaction.reply({ embeds: [embed] });
    }

    private getRandomChoice(): RPSChoice {
        return choices[Math.floor(Math.random() * choices.length)];
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const userChoice = (await args.single('string').catch(() => null))?.toLowerCase() as RPSChoice;
        if (!choices.includes(userChoice)) {
            await message.reply("Please choose rock, paper, or scissors! e.g. `$rps rock`");
            return;
        }

        createCommandLog({
            command: this.name,
            guild: message.guild?.name ?? "DM",
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const botChoice = this.getRandomChoice();
        let result: string;
        if (userChoice === botChoice) { result = "It's a tie!"; }
        else if (winningCombos[userChoice] === botChoice) { result = "You win!"; }
        else { result = "I win!"; }
        await message.reply(`${this.capitalizeFirst(userChoice)} vs ${this.capitalizeFirst(botChoice)} - ${result}`);
    }
}
