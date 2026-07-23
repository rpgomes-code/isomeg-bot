import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { addWarn, logModAction, checkModPermissions, getModPermissionFailure } from '../../lib/moderation';

export class WarnCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "warn",
            description: "Warn a user.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('warn')
                    .setDescription("Warn a user.")
                    .addUserOption((option) =>
                        option.setName("user").setDescription("User to warn").setRequired(true)
                    )
                    .addStringOption((option) =>
                        option.setName("reason").setDescription("Reason for the warn").setRequired(true)
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
        const reason = interaction.options.getString("reason", true);
        const bot = await interaction.guild.members.fetchMe();
        const moderator = await interaction.guild.members.fetch(interaction.user.id);

        const check = checkModPermissions(moderator, target, bot);
        const failure = getModPermissionFailure(check, "warn");
        if (failure) {
            await interaction.reply({
                content: failure,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const warn = await addWarn(interaction.guild.id, target.id, interaction.user.id, reason);
        await logModAction(interaction.guild, "Warn", target, moderator, reason);

        await interaction.reply({
            content: `${target.user.tag} has been warned. (ID: ${warn.id})`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const target = await args.pick('user').catch(() => null);
        if (!target) {
            await message.reply("Please mention a user to warn! e.g. `$warn @User Reason`");
            return;
        }
        const reason = await args.rest('string').catch(() => null) || "No reason provided";
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

        try {
            const member = await message.guild.members.fetch(target.id);
            const bot = await message.guild.members.fetchMe();
            const moderator = await message.guild.members.fetch(message.author.id);
            const check = checkModPermissions(moderator, member, bot);
            const failure = getModPermissionFailure(check, "warn");
            if (failure) {
                await message.reply(failure);
                return;
            }
            const warning = await addWarn(message.guild.id, target.id, message.author.id, reason);
            await logModAction(message.guild, "Warn", member, moderator, reason);
            await message.reply(`${target.tag} has been warned. (ID: ${warning.id})`);
        } catch (error) {
            this.container.logger.error(error);
            await message.reply(`Failed to warn ${target.tag}.`);
        }
    }
}
