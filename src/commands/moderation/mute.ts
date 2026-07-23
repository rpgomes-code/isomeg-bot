import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { logModAction, checkModPermissions, getModPermissionFailure } from '../../lib/moderation';

export class MuteCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "mute",
            description: "Timeout a user.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('mute')
                    .setDescription("Timeout a user.")
                    .addUserOption((option) =>
                        option.setName("user").setDescription("User to mute").setRequired(true)
                    )
                    .addIntegerOption((option) =>
                        option.setName("minutes").setDescription("Duration in minutes (max 40320)").setRequired(true).setMinValue(1).setMaxValue(40320)
                    )
                    .addStringOption((option) =>
                        option.setName("reason").setDescription("Reason for the mute").setRequired(false)
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
        const minutes = interaction.options.getInteger("minutes", true);
        const reason = interaction.options.getString("reason") ?? "No reason provided";
        const bot = await interaction.guild.members.fetchMe();
        const moderator = await interaction.guild.members.fetch(interaction.user.id);

        const check = checkModPermissions(moderator, target, bot);
        const failure = getModPermissionFailure(check, "mute");
        if (failure) {
            await interaction.reply({
                content: failure,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        await target.timeout(minutes * 60 * 1000, reason);
        await logModAction(interaction.guild, "Mute", target, moderator, `${reason} (${minutes}m)`);

        await interaction.reply({
            content: `${target.user.tag} has been muted for ${minutes} minutes.`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const target = await args.pick('user').catch(() => null);
        if (!target || !message.guild) {
            await message.reply("Usage: `$mute @User <minutes> [reason]`");
            return;
        }
        const minutes = parseInt(await args.single('string').catch(() => null) ?? '');
        if (!minutes || minutes < 1 || minutes > 40320) {
            await message.reply("Please provide a valid duration in minutes (1-40320).");
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
            const check = checkModPermissions(moderator, member, bot);
            const failure = getModPermissionFailure(check, "mute");
            if (failure) {
                await message.reply(failure);
                return;
            }
            await member.timeout(minutes * 60 * 1000, reason);
            await logModAction(message.guild, "Mute", member, moderator, `${reason} (${minutes}m)`);
            await message.reply(`${target.tag} has been muted for ${minutes} minutes.`);
        } catch (error) {
            await message.reply(`Failed to mute ${target.tag}.`);
        }
    }
}
