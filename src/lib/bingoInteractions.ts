import { MessageFlags, type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction } from "discord.js";
import { getBingoCard, listBingoCards, updateBingoCard } from "./bingo";
import { bingoCardPicker, bingoCardUpdate, bingoChoicesEmbed, bingoEditModal, bingoResultText } from "./bingoPresentation";
import { assertCardEditable, assertCardOwner, assertCardRevision, BingoError, BingoStaleCardError } from "./bingoRules";

type BingoInteraction = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

export async function handleBingoInteraction(interaction: BingoInteraction): Promise<void> {
    let cardId: string | undefined;
    let privateReply = false;
    try {
        if (!interaction.guildId) throw new BingoError("Bingo cards can only be used in their server.");
        if (interaction.isStringSelectMenu() && /^bingo:open:\d+$/.test(interaction.customId)) {
            if (interaction.customId !== `bingo:open:${interaction.user.id}`) throw new BingoError("This card list belongs to someone else.");
            await interaction.deferUpdate();
            const card = await getBingoCard(interaction.values[0], interaction.guildId);
            assertCardOwner(card, interaction.user.id);
            await interaction.editReply(bingoCardUpdate(card));
            return;
        }
        const pageMatch = /^bingo:cards:(\d+):(\d+)$/.exec(interaction.customId);
        if (interaction.isButton() && pageMatch) {
            if (pageMatch[1] !== interaction.user.id) throw new BingoError("This card list belongs to someone else.");
            await interaction.deferUpdate();
            await interaction.editReply(bingoCardPicker(interaction.user.id,
                await listBingoCards(interaction.guildId, interaction.user.id, Number(pageMatch[2]))));
            return;
        }
        const match = /^bingo:(square|edit|mark|save|confirm|check|choices):([\da-f-]{36}):(\d+)(?::(\d+))?(?::(1|5))?$/.exec(interaction.customId);
        if (!match) throw new BingoError("That bingo control is no longer available. Open your saved cards with /bingo.");
        const [, action, matchedId, rawRevision, rawIndex, rawCount] = match;
        cardId = matchedId;
        const revision = Number(rawRevision);
        const index = rawIndex === undefined ? undefined : Number(rawIndex);
        const needsIndex = ["square", "edit", "mark", "save"].includes(action);
        if (!Number.isSafeInteger(revision) ||
            (needsIndex && (!Number.isInteger(index) || index < 0 || index >= 25)) ||
            (!needsIndex && (rawIndex !== undefined || rawCount !== undefined)) ||
            (action !== "save" && rawCount !== undefined)) {
            throw new BingoError("That bingo control is invalid.");
        }

        if (interaction.isModalSubmit() && action === "save" && rawCount) {
            if (interaction.isFromMessage()) await interaction.deferUpdate();
            else {
                privateReply = true;
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }
            const count = Number(rawCount);
            if (index + count > 25) throw new BingoError("That row is invalid.");
            const values = Array.from({ length: count }, (_, offset) => interaction.fields.getTextInputValue(`square-${index + offset}`));
            const card = await updateBingoCard(cardId, interaction.guildId, interaction.user.id, { type: "edit", revision, start: index, values });
            await interaction.editReply(bingoCardUpdate(card));
            return;
        }
        if (!interaction.isButton() || action === "save") throw new BingoError("That bingo control is invalid.");

        if (action === "choices") {
            privateReply = true;
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const card = await getBingoCard(cardId, interaction.guildId);
            await interaction.editReply({ embeds: [bingoChoicesEmbed(card)], allowedMentions: { parse: [] } });
            return;
        }
        if (action === "check" || action === "confirm") {
            await interaction.deferUpdate();
            const card = action === "confirm"
                ? await updateBingoCard(cardId, interaction.guildId, interaction.user.id, { type: "confirm", revision })
                : await getBingoCard(cardId, interaction.guildId);
            assertCardOwner(card, interaction.user.id);
            await interaction.editReply(bingoCardUpdate(card));
            if (action === "check") {
                await interaction.followUp({ content: bingoResultText(card), flags: MessageFlags.Ephemeral });
            }
            return;
        }

        const card = await getBingoCard(cardId, interaction.guildId);
        assertCardOwner(card, interaction.user.id);
        assertCardRevision(card, revision);
        if (!card.submittedAt) {
            assertCardEditable(card);
            await interaction.showModal(bingoEditModal(card, index));
        } else {
            await interaction.deferUpdate();
            const updated = await updateBingoCard(cardId, interaction.guildId, interaction.user.id, { type: "mark", revision, index });
            await interaction.editReply(bingoCardUpdate(updated));
        }
    } catch (error) {
        let refreshed = false;
        if (error instanceof BingoStaleCardError && cardId && interaction.guildId) {
            try {
                const latest = await getBingoCard(cardId, interaction.guildId);
                assertCardOwner(latest, interaction.user.id);
                if (interaction.deferred || interaction.replied) await interaction.editReply(bingoCardUpdate(latest));
                else if (interaction.isButton() || (interaction.isModalSubmit() && interaction.isFromMessage())) {
                    await interaction.update(bingoCardUpdate(latest));
                } else {
                    await interaction.reply({ ...bingoCardUpdate(latest), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
                }
                refreshed = true;
            } catch (refreshError) {
                console.error("[Bingo refresh]", refreshError);
            }
        }
        const content = refreshed ? "This card has changed. It has been refreshed; please try again."
            : error instanceof BingoError ? error.message : "Could not update the bingo card. Please try again.";
        if (!(error instanceof BingoError)) console.error("[Bingo interaction]", error);
        if (interaction.deferred || interaction.replied) {
            if (privateReply && !refreshed) {
                await interaction.editReply({ content });
            } else {
                await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
            }
        } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
        }
    }
}
