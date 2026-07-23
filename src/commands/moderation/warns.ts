import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, EmbedBuilder, Colors, MessageFlags, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getUserWarns, hasModeratorPermission } from '../../lib/moderation';

export class WarnsCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "warns",
            description: "View a user's active warnings.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('warns')
                    .setDescription("View a user's active warnings.")
                    .addUserOption((option) =>
                        option.setName("user").setDescription("User to check").setRequired(true)
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

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator)) {
            await interaction.reply({ content: "You don't have permission to view warnings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const target = interaction.options.getUser("user", true);
        const warnings = await getUserWarns(interaction.guild.id, target.id);

        if (warnings.length === 0) {
            await interaction.reply({
                content: `${target.tag} has no active warnings.`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const fields = warnings.map((w) => ({
            name: `Warn ID: ${w.id}`,
            value: `**Reason:** ${w.reason}\n**Moderator:** <@${w.moderatorId}>\n**Date:** <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`,
        }));

        const embed = new EmbedBuilder()
            .setTitle(`Active Warnings for ${target.tag}`)
            .setColor(Colors.Red)
            .setDescription(`**${warnings.length}** active warning(s)`)
            .setFields(fields)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const target = message.mentions.users.first();
        if (!target) {
            await message.reply("Please mention a user to check warns for. e.g. `$warns @User`");
            return;
        }
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        createCommandLog({
            command: this.name,
            guild: message.guild.name,
            type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        const moderator = await message.guild.members.fetch(message.author.id);
        if (!hasModeratorPermission(moderator)) {
            await message.reply("You don't have permission to view warnings.");
            return;
        }

        const warnings = await getUserWarns(message.guild.id, target.id);
        await message.reply(`${target.tag} has ${warnings.length} active warning(s).`);
    }
}
