import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, User } from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class AvatarCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "avatar",
            description: "Get the avatar URL of a user.",
            aliases: ["av", "pfp", "profilepic"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('avatar')
                    .setDescription("Get the avatar URL of a user.")
                    .addUserOption((option) =>
                        option
                            .setName("target")
                            .setDescription("The user's avatar to show")
                            .setRequired(false)
                    ),
            {
                guildIds: [...config.guilds.map(guild => guild.id)],
                registerCommandIfMissing: true,
            }
        );
    }

    // Handle slash command
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

        const target: User = interaction.options.getUser("target") ?? interaction.user;
        const member = interaction.guild?.members.cache.get(target.id);

        // Get both global and server avatar URLs
        const globalAvatarURL = target.avatarURL({ size: 1024 });
        const serverAvatarURL = member?.avatarURL({ size: 1024 });

        // Determine which avatar to show (server avatar takes priority if different)
        const displayAvatarURL = serverAvatarURL || globalAvatarURL || target.defaultAvatarURL;
        const isServerAvatar = serverAvatarURL && serverAvatarURL !== globalAvatarURL;

        const embed = new EmbedBuilder()
            .setTitle(`🖼️ ${target.displayName}'s Avatar`)
            .setColor(Colors.DarkAqua)
            .setImage(displayAvatarURL)
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Build description with an avatar type and links
        let description: string;

        if (!globalAvatarURL) {
            description = "*Using default Discord avatar*\n\n";
            description += `[🔗 View Original](${displayAvatarURL})`;
        } else if (isServerAvatar) {
            description = "*Showing server-specific avatar*\n\n";
            description += `[🔗 View Original](${displayAvatarURL}) • [🌍 Global Avatar](${globalAvatarURL})`;
        } else {
            description = "*Showing global avatar*\n\n";
            description += `[🔗 View Original](${displayAvatarURL})`;

            // Add a server avatar link if it exists and is different
            if (serverAvatarURL) {
                description += ` • [🏠 Server Avatar](${serverAvatarURL})`;
            }
        }

        embed.setDescription(description);

        await interaction.reply({
            embeds: [embed]
        });
    }
}