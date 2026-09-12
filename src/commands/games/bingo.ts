import { Command, RegisterBehavior, type ApplicationCommandRegistry, type Args } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags } from "discord.js";
import { createBingoCard, listBingoCards } from "../../lib/bingo";
import { bingoCardPayload, bingoCardPicker } from "../../lib/bingoPresentation";
import { BingoError } from "../../lib/bingoRules";
import { ensureGuildSettings } from "../../lib/guildSettings";

export class BingoCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, { ...options, name: "bingo", description: "Create a bingo card, or open one of your saved cards." });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(builder => builder.setName("bingo").setDescription(this.description)
            .addStringOption(option => option.setName("name").setDescription("Name for your new bingo card.")
                .setMaxLength(100)), {
            registerCommandIfMissing: true,
            behaviorWhenNotIdentical: RegisterBehavior.Overwrite,
        });
    }

    public override async chatInputRun(interaction: ChatInputCommandInteraction): Promise<void> {
        if (!interaction.guild) {
            await interaction.reply({ content: "Bingo cards can only be used in a server.", flags: MessageFlags.Ephemeral });
            return;
        }
        const name = interaction.options.getString("name");
        await interaction.deferReply(name ? {} : { flags: MessageFlags.Ephemeral });
        try {
            if (!name) {
                await interaction.editReply(bingoCardPicker(interaction.user.id, await listBingoCards(interaction.guild.id, interaction.user.id)));
                return;
            }
            await ensureGuildSettings(interaction.guild.id, interaction.guild.name);
            const card = await createBingoCard(interaction.guild.id, interaction.user.id, name);
            await interaction.editReply(bingoCardPayload(card));
        } catch (error) {
            if (!(error instanceof BingoError)) throw error;
            await interaction.editReply({ content: error.message });
        }
    }

    public override async messageRun(message: Message, args: Args): Promise<void> {
        if (!message.guild) {
            await message.reply("Bingo cards can only be used in a server.");
            return;
        }
        const name = await args.rest("string").catch(() => null);
        if (!name) {
            await message.reply(bingoCardPicker(message.author.id, await listBingoCards(message.guild.id, message.author.id)));
            return;
        }
        try {
            await ensureGuildSettings(message.guild.id, message.guild.name);
            const card = await createBingoCard(message.guild.id, message.author.id, name);
            await message.reply(bingoCardPayload(card));
        } catch (error) {
            if (!(error instanceof BingoError)) throw error;
            await message.reply(error.message);
        }
    }
}
