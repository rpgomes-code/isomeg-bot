import type { ApplicationCommandRegistry } from "@sapphire/framework";
import { Command } from "@sapphire/framework";
import { ChatInputCommandInteraction, Message, MessageFlags } from "discord.js";
import { QueueRepeatMode } from "discord-player";
import { getPlayer } from "../../music/player";
import { createCommandLog } from "../../lib/logger";
import { CommandType } from "../../enums/commands/general";
import { getInteractionQueueContext, getMessageQueueContext, repeatModeName } from "../../lib/musicGuards";

const MODES: Record<string, QueueRepeatMode> = {
    off: QueueRepeatMode.OFF,
    track: QueueRepeatMode.TRACK,
    queue: QueueRepeatMode.QUEUE,
    autoplay: QueueRepeatMode.AUTOPLAY,
};

export class RepeatCommand extends Command {
    constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: "repeat",
            description: "Set music repeat or autoplay mode.",
            aliases: ["loop", "autoplay"],
        });
    }

    public override registerApplicationCommands(registry: ApplicationCommandRegistry) {
        registry.registerChatInputCommand(
            (builder) =>
                builder
                    .setName("repeat")
                    .setDescription("Set music repeat or autoplay mode.")
                    .addStringOption((option) =>
                        option
                            .setName("mode")
                            .setDescription("Repeat mode.")
                            .setRequired(true)
                            .addChoices(
                                { name: "Off", value: "off" },
                                { name: "Track", value: "track" },
                                { name: "Queue", value: "queue" },
                                { name: "Autoplay", value: "autoplay" }
                            )
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

        const context = await getInteractionQueueContext(interaction, getPlayer());
        if (!context) return;

        const modeName = interaction.options.getString("mode", true);
        const mode = MODES[modeName] ?? QueueRepeatMode.OFF;
        context.queue.setRepeatMode(mode);

        await interaction.reply({
            content: `Repeat mode set to **${repeatModeName(mode)}**.`,
            flags: [MessageFlags.Ephemeral],
        });
    }

    public override async messageRun(message: Message, args: any): Promise<void> {
        const context = await getMessageQueueContext(message, getPlayer());
        if (!context) return;

        const rawMode = ((await args.single("string").catch(() => "off")) as string).toLowerCase();
        const mode = MODES[rawMode];
        if (mode === undefined) {
            await message.reply("Choose one of: off, track, queue, autoplay.");
            return;
        }

        context.queue.setRepeatMode(mode);
        await message.reply(`Repeat mode set to ${repeatModeName(mode)}.`);
    }
}
