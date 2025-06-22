import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import {ChatInputCommandInteraction, EmbedBuilder, Colors, Guild, MessageFlags} from 'discord.js';
import { config } from "../../constants/config";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";

export class ServerCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "server",
            description: "Display information about the server.",
            aliases: ["serverinfo", "guildinfo", "guild"]
        });
    }

    // Register the slash command
    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('server')
                    .setDescription("Display information about the server."),
            {
                guildIds: [...config.guilds.map(guild => guild.id)],
                registerCommandIfMissing: true,
            }
        );
    }

    // Handle slash command
    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({
                content: "❌ This command can only be used in a server!",
                flags: [MessageFlags.Ephemeral],
            });
            return;
        }

        createCommandLog({
            command: this.name,
            guild: interaction.guild.name,
            type: CommandType.Slash,
            user: {
                username: interaction.user.username,
                displayName: interaction.user.displayName
            },
            createdAt: interaction.createdAt
        });

        const guild: Guild = interaction.guild;

        // Fetch additional guild information
        await guild.fetch();

        const embed = new EmbedBuilder()
            .setColor(Colors.DarkOrange)
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }) || null)
            .addFields([
                {
                    name: "📊 Members",
                    value: `**Total:** ${guild.memberCount.toLocaleString()}\n**Online:** ${guild.approximatePresenceCount?.toLocaleString() || 'Unknown'}`,
                    inline: true,
                },
                {
                    name: "📅 Created",
                    value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
                    inline: true,
                },
                {
                    name: "🆔 Server ID",
                    value: `\`${guild.id}\``,
                    inline: true,
                },
                {
                    name: "👑 Owner",
                    value: `<@${guild.ownerId}>`,
                    inline: true,
                },
                {
                    name: "🌟 Nitro Boost",
                    value: `**Level:** ${guild.premiumTier}/3\n**Boosts:** ${guild.premiumSubscriptionCount || 0}`,
                    inline: true,
                },
                {
                    name: "🔧 Verification",
                    value: this.getVerificationLevel(guild.verificationLevel),
                    inline: true,
                }
            ])
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        // Add channels and roles information
        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const roles = guild.roles.cache.size - 1; // Exclude @everyone

        embed.addFields([
            {
                name: "📺 Channels",
                value: `**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categories}`,
                inline: true,
            },
            {
                name: "🎭 Roles",
                value: `**Total:** ${roles}`,
                inline: true,
            },
            {
                name: "🌍 Region",
                value: guild.preferredLocale || "Unknown",
                inline: true,
            }
        ]);

        // Add server features/perks
        const features = this.getServerFeatures(guild);
        if (features.length > 0) {
            embed.addFields({
                name: "✨ Server Features",
                value: features.join('\n'),
                inline: false
            });
        }

        // Add server banner if available
        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 })!);
        }

        await interaction.reply({ embeds: [embed] });
    }

    private getVerificationLevel(level: number): string {
        const levels = {
            0: "None",
            1: "Low",
            2: "Medium",
            3: "High",
            4: "Very High"
        };
        return levels[level as keyof typeof levels] || "Unknown";
    }

    private getServerFeatures(guild: Guild): string[] {
        const features: string[] = [];

        if (guild.features.includes('PARTNERED')) {
            features.push('🤝 Discord Partner');
        }
        if (guild.features.includes('VERIFIED')) {
            features.push('✅ Verified Server');
        }
        if (guild.features.includes('COMMUNITY')) {
            features.push('🏘️ Community Server');
        }
        if (guild.features.includes('DISCOVERABLE')) {
            features.push('🔍 Server Discovery');
        }
        if (guild.features.includes('FEATURABLE')) {
            features.push('⭐ Featurable');
        }
        if (guild.features.includes('VANITY_URL')) {
            features.push('🔗 Custom Invite URL');
        }
        if (guild.features.includes('BANNER')) {
            features.push('🖼️ Server Banner');
        }
        if (guild.features.includes('ANIMATED_ICON')) {
            features.push('🎬 Animated Icon');
        }
        if (guild.features.includes('NEWS')) {
            features.push('📰 News Channels');
        }
        if (guild.features.includes('WELCOME_SCREEN_ENABLED')) {
            features.push('👋 Welcome Screen');
        }

        return features;
    }
}