import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message, PermissionFlagsBits } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { logModAction, checkModPermissions, getModPermissionFailure } from '../../lib/moderation';

export class BanCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "ban",
            description: "Ban a user.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('ban')
                    .setDescription("Ban a user.")
                    .addUserOption((option) =>
                        option.setName("user").setDescription("User to ban").setRequired(true)
                    )
                    .addStringOption((option) =>
                        option.setName("reason").setDescription("Reason for the ban").setRequired(false)
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

        const target = await interaction.guild.members.fetch(
            interaction.options.getUser("user", true)
        );
        const reason = interaction.options.getString("reason") ?? "No reason provided";
        const bot = await interaction.guild.members.fetchMe();
        const moderator = await interaction.guild.members.fetch(interaction.user.id);

        const check = checkModPermissions(moderator, target, bot, PermissionFlagsBits.BanMembers);
        const failure = getModPermissionFailure(check, "ban");
        if (failure) {
            await interaction.reply({
                content: failure,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        await interaction.guild.members.ban(target.user, { reason });
        await logModAction(interaction.guild, "Ban", target, moderator, reason);

        await interaction.reply({
            content: `${target.user.tag} has been banned.`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const target = await args.pick('user').catch(() => null);
        if (!target || !message.guild) {
            await message.reply("Please mention a user to ban. e.g. `$ban @User [reason]`");
            return;
        }
        const reason = await args.rest('string').catch(() => null) || "No reason provided";

        createCommandLog({
            command: this.name, guild: message.guild.name, type: CommandType.Normal,
            user: { username: message.author.username, displayName: message.author.username! },
            createdAt: message.createdAt
        });

        try {
            const member = await message.guild.members.fetch(target.id);
            const bot = await message.guild.members.fetchMe();
            const moderator = await message.guild.members.fetch(message.author.id);
            const check = checkModPermissions(moderator, member, bot, PermissionFlagsBits.BanMembers);
            const failure = getModPermissionFailure(check, "ban");
            if (failure) {
                await message.reply(failure);
                return;
            }
            await message.guild.members.ban(target, { reason });
            await logModAction(message.guild, "Ban", member, moderator, reason);
            await message.reply(`${target.tag} has been banned.`);
        } catch {
            await message.reply(`Failed to ban ${target.tag}.`);
        }
    }
}
