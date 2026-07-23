import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Colors, EmbedBuilder, Message, User } from "discord.js";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

const VIBES = [
    { min: 0, label: "needs a reset", color: Colors.Red },
    { min: 25, label: "questionable but recoverable", color: Colors.Orange },
    { min: 50, label: "solid", color: Colors.Yellow },
    { min: 75, label: "immaculate", color: Colors.Green },
    { min: 95, label: "legendary", color: Colors.Gold },
];

export class VibeCheckCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "vibecheck",
            description: "Run a deeply unserious vibe check.",
            aliases: ["vibe"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("vibecheck")
                .setDescription("Run a deeply unserious vibe check.")
                .addUserOption((option) => option.setName("target").setDescription("User to check.").setRequired(false)),
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

        const target = interaction.options.getUser("target") ?? interaction.user;
        await interaction.reply({ embeds: [this.createVibeEmbed(target, interaction.user)] });
    }

    public override async messageRun(message: Message): Promise<void> {
        const target = message.mentions.users.first() ?? message.author;
        await message.reply({ embeds: [this.createVibeEmbed(target, message.author)] });
    }

    private createVibeEmbed(target: User, requester: User): EmbedBuilder {
        const score = Math.floor(Math.random() * 101);
        const vibe = [...VIBES].reverse().find((entry) => score >= entry.min)!;

        return new EmbedBuilder()
            .setTitle(`Vibe Check: ${target.displayName}`)
            .setColor(vibe.color)
            .setDescription(`${target} is **${score}%** ${vibe.label}.`)
            .setFooter({ text: `Requested by ${requester.tag}` })
            .setTimestamp();
    }
}
