import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction } from "discord.js";
import { getBingoCard, updateBingoCard } from "./bingo";
import { bingoCardPayload, bingoEditModal } from "./bingoPresentation";
import { assertCardEditable, assertCardOwner, assertCardRevision, BingoError } from "./bingoRules";

export async function handleBingoInteraction(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
    try {
        if (!interaction.guildId) throw new BingoError("Bingo cards can only be used in their server.");
        const match = /^bingo:(edit|mark|save):([\da-f-]{36}):(\d+):(\d+)(?::(1|5))?$/.exec(interaction.customId);
        if (!match) throw new BingoError("That bingo control is invalid. Open /bingo card again.");
        const [, action, cardId, rawRevision, rawIndex, rawCount] = match;
        const revision = Number(rawRevision);
        const index = Number(rawIndex);
        if (!Number.isSafeInteger(revision) || !Number.isInteger(index) || index < 0 || index >= 25) {
            throw new BingoError("That bingo control is invalid.");
        }

        if (interaction.isButton() && action === "edit" && !rawCount) {
            const { event, card } = await getBingoCard(cardId, interaction.guildId);
            assertCardOwner(card, interaction.user.id);
            assertCardEditable(event, card);
            assertCardRevision(card, revision);
            await interaction.showModal(bingoEditModal(card, index, 1));
            return;
        }
        if (interaction.isButton() && action === "mark" && !rawCount) {
            await interaction.deferUpdate();
            const view = await updateBingoCard(cardId, interaction.guildId, interaction.user.id, { type: "mark", revision, index });
            await interaction.editReply(bingoCardPayload(view));
            return;
        }
        if (interaction.isModalSubmit() && action === "save" && rawCount) {
            if (interaction.isFromMessage()) await interaction.deferUpdate();
            else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const count = Number(rawCount);
            if (index + count > 25) throw new BingoError("That row is invalid.");
            const values = Array.from({ length: count }, (_, offset) => interaction.fields.getTextInputValue(`square-${index + offset}`));
            const view = await updateBingoCard(cardId, interaction.guildId, interaction.user.id, { type: "edit", revision, start: index, values });
            await interaction.editReply({ content: "Predictions saved.", ...bingoCardPayload(view) });
            return;
        }
        throw new BingoError("That bingo control is invalid.");
    } catch (error) {
        const content = error instanceof BingoError ? error.message : "Could not update the bingo card. Open /bingo card to check its current state.";
        if (!(error instanceof BingoError)) console.error("[Bingo interaction]", error);
        if (interaction.deferred || interaction.replied) {
            if (interaction.isModalSubmit() && !interaction.isFromMessage()) await interaction.editReply({ content });
            else await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
    }
}
