import { Events, Listener } from "@sapphire/framework";
import { MessageFlags } from "discord.js";

export class ChatInputCommandErrorListener extends Listener<typeof Events.ChatInputCommandError> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.ChatInputCommandError,
        });
    }

    public async run(error: unknown, payload: any): Promise<void> {
        const interaction = payload.interaction;
        const commandName = payload.command?.name ?? "unknown";
        this.container.logger.error(`[Command:${commandName}] ${error instanceof Error ? error.stack ?? error.message : error}`);

        if (!interaction?.isRepliable?.()) return;

        const content = "Something went wrong while running this command. The error was logged.";
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content, flags: [MessageFlags.Ephemeral] }).catch(() => null);
        } else {
            await interaction.reply({ content, flags: [MessageFlags.Ephemeral] }).catch(() => null);
        }
    }
}
