import { Events, Listener } from "@sapphire/framework";
import type { Interaction } from "discord.js";
import { handleBingoInteraction } from "../lib/bingoInteractions";

export class BingoInteractionListener extends Listener<typeof Events.InteractionCreate> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, { ...options, event: Events.InteractionCreate });
    }

    public async run(interaction: Interaction): Promise<void> {
        if ((interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) && interaction.customId.startsWith("bingo:")) {
            await handleBingoInteraction(interaction);
        }
    }
}
