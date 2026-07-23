import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags, PermissionFlagsBits } from "discord.js";
import { CommandType } from "../../enums/commands/general";
import { createCommandLog } from "../../lib/logger";
import { ensureGuildSettings, normalizePrefix, updateGuildSettings } from "../../lib/guildSettings";
import { hasModeratorPermission } from "../../lib/moderation";

export class SetPrefixCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "setprefix",
            description: "Set the server prefix for message commands.",
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("setprefix")
                    .setDescription("Set the server prefix for message commands.")
                    .addStringOption((option) =>
                        option
                            .setName("prefix")
                            .setDescription("New prefix, 1-5 characters with no spaces.")
                            .setRequired(true)
                            .setMinLength(1)
                            .setMaxLength(5)
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
            createdAt: interaction.createdAt,
        });

        if (!interaction.guild) {
            await interaction.reply({ content: "This command can only be used in a server.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        const moderator = await interaction.guild.members.fetch(interaction.user.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You don't have permission to update server settings.", flags: [MessageFlags.Ephemeral] });
            return;
        }

        await ensureGuildSettings(interaction.guild.id, interaction.guild.name);
        const prefix = normalizePrefix(interaction.options.getString("prefix", true));
        await updateGuildSettings(interaction.guild.id, { prefix });

        await interaction.reply({ content: `Prefix updated to \`${prefix}\`.`, flags: [MessageFlags.Ephemeral] });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        if (!message.guild) {
            await message.reply("This command can only be used in a server.");
            return;
        }

        const moderator = await message.guild.members.fetch(message.author.id);
        if (!hasModeratorPermission(moderator, PermissionFlagsBits.ManageGuild)) {
            await message.reply("You don't have permission to update server settings.");
            return;
        }

        const rawPrefix = await args.single("string").catch(() => null);
        if (!rawPrefix) {
            await message.reply("Usage: `setprefix <prefix>`");
            return;
        }

        const prefix = normalizePrefix(rawPrefix);
        await ensureGuildSettings(message.guild.id, message.guild.name);
        await updateGuildSettings(message.guild.id, { prefix });
        await message.reply(`Prefix updated to \`${prefix}\`.`);
    }
}
