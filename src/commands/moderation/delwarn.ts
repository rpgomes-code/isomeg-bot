import type { ApplicationCommandRegistry } from '@sapphire/framework';
import { Command } from '@sapphire/framework';
import { ChatInputCommandInteraction, MessageFlags, Message } from 'discord.js';
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { deleteUserWarn, hasModeratorPermission } from '../../lib/moderation';

export class DelWarnCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "delwarn",
            description: "Remove a warning from a user.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName('delwarn')
                    .setDescription("Remove a warning from a user.")
                    .addStringOption((option) =>
                        option.setName("warn-id").setDescription("ID of the warn to remove").setRequired(true)
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
            await interaction.reply({ content: "You don't have permission to delete warnings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const warnId = interaction.options.getString("warn-id", true);
        const deleted = await deleteUserWarn(warnId);
        if (!deleted) {
            await interaction.reply({ content: `No active warning found with ID \`${warnId}\`.`, flags: [MessageFlags.Ephemeral] });
            return;
        }

        await interaction.reply({
            content: `Warning \`${warnId}\` has been removed.`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const moderator = await message.guild.members.fetch(message.author.id);
        if (!hasModeratorPermission(moderator)) {
            await message.reply("You don't have permission to delete warnings.");
            return;
        }

        const warnId = await args.single('string').catch(() => null);
        if (!warnId) {
            await message.reply("Please provide the warn ID to remove. e.g. `$delwarn <id>`");
            return;
        }
        const deleted = await deleteUserWarn(warnId);
        if (!deleted) {
            await message.reply(`No active warning found with ID \`${warnId}\`.`);
            return;
        }
        await message.reply(`Warning \`${warnId}\` has been removed.`);
    }
}
