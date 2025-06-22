import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, User } from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class UserCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "user",
            description: "Display information about a user.",
            aliases: ["userinfo", "whois", "profile"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('user')
                    .setDescription("Display information about a user.")
                    .addUserOption((option) =>
                        option
                            .setName("target")
                            .setDescription("The user to get information about")
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

        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setTitle(`👤 User Information - ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields([
                {
                    name: "Username",
                    value: target.username,
                    inline: true
                },
                {
                    name: "Display Name",
                    value: target.displayName,
                    inline: true
                },
                {
                    name: "User ID",
                    value: `\`${target.id}\``,
                    inline: true
                },
                {
                    name: "Account Created",
                    value: `<t:${Math.floor(target.createdTimestamp / 1000)}:F>\n<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
                    inline: true,
                },
                {
                    name: "Is Bot",
                    value: target.bot ? "✅ Yes" : "❌ No",
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Add server-specific information if in a guild
        if (member && interaction.guild) {
            const joinedTimestamp = member.joinedTimestamp;
            const joinedDisplay = joinedTimestamp
                ? `<t:${Math.floor(joinedTimestamp / 1000)}:F>\n<t:${Math.floor(joinedTimestamp / 1000)}:R>`
                : "Unknown";

            // Get roles excluding @everyone
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => role.toString())
                .join(' ') || "None";

            embed.addFields([
                {
                    name: "Joined Server",
                    value: joinedDisplay,
                    inline: true,
                },
                {
                    name: "Nickname",
                    value: member.nickname || "None",
                    inline: true
                },
                {
                    name: `Roles [${member.roles.cache.size - 1}]`,
                    value: roles.length > 1024 ? "Too many roles to display" : roles,
                    inline: false
                }
            ]);

            // Add server-specific badges/status
            const badges: string[] = [];
            if (member.premiumSince) {
                badges.push("💎 Nitro Booster");
            }
            if (member.permissions.has('Administrator')) {
                badges.push("👑 Administrator");
            }
            if (member.permissions.has('ModerateMembers')) {
                badges.push("🛡️ Moderator");
            }

            if (badges.length > 0) {
                embed.addFields({
                    name: "Server Badges",
                    value: badges.join('\n'),
                    inline: false
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
}