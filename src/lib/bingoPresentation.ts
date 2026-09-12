import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors, ContainerBuilder, EmbedBuilder, escapeMarkdown,
    MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle,
} from "discord.js";
import type { BingoCard } from "../db/schema";
import { BINGO_PREDICTION_LENGTH, BINGO_SIZE, completedLines, isMarked, markedCount, squareName } from "./bingoRules";

export function bingoCardPayload(card: BingoCard) {
    const locked = Boolean(card.submittedAt);
    const filled = card.predictions.filter(value => value.trim()).length;
    const lines = completedLines(card.marks);
    const container = new ContainerBuilder().setAccentColor(lines.length ? Colors.Green : Colors.DarkAqua)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${escapeMarkdown(card.title)}\n<@${card.createdById}> | ${locked ? "**Choices locked**" : `**Draft** | ${filled}/25 choices`}`,
        ));

    for (let row = 0; row < BINGO_SIZE; row++) {
        const buttons = new ActionRowBuilder<ButtonBuilder>();
        for (let col = 0; col < BINGO_SIZE; col++) {
            const index = row * BINGO_SIZE + col;
            const marked = isMarked(card.marks, index);
            const prediction = Array.from(card.predictions[index]);
            const label = prediction.length ? prediction.slice(0, 20).join("") + (prediction.length > 20 ? "..." : "") : "+";
            buttons.addComponents(new ButtonBuilder()
                .setCustomId(`bingo:square:${card.id}:${card.revision}:${index}`)
                .setLabel(`${squareName(index)} ${marked ? "[X] " : ""}${label}`)
                .setStyle(marked ? ButtonStyle.Success : ButtonStyle.Secondary));
        }
        container.addActionRowComponents(buttons);
    }

    container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`bingo:${locked ? "check" : "confirm"}:${card.id}:${card.revision}`)
            .setLabel(locked ? "Check" : "Confirm Choices")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!locked && filled !== 25),
        new ButtonBuilder().setCustomId(`bingo:choices:${card.id}:${card.revision}`)
            .setLabel("View Choices").setStyle(ButtonStyle.Secondary),
    ));
    if (locked) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(bingoResultText(card)));
    }
    return { components: [container], flags: MessageFlags.IsComponentsV2 as const, allowedMentions: { parse: [] as [] } };
}

export function bingoCardUpdate(card: BingoCard) {
    // Clear legacy fields when converting an existing card or picker to Components V2.
    return { ...bingoCardPayload(card), content: null, embeds: [] };
}

export function bingoResultText(card: BingoCard): string {
    const lines = completedLines(card.marks);
    return [
        `**${markedCount(card.marks)}/25** marked | **${lines.length}** completed lines`,
        lines.length ? `**BINGO!** ${lines.join(", ")}` : "No completed lines yet.",
    ].join("\n");
}

export function bingoChoicesEmbed(card: BingoCard): EmbedBuilder {
    const embed = new EmbedBuilder().setTitle(card.title).setColor(Colors.DarkAqua);
    for (let row = 0; row < BINGO_SIZE; row++) {
        embed.addFields({
            name: `Row ${row + 1}`,
            value: card.predictions.slice(row * BINGO_SIZE, (row + 1) * BINGO_SIZE).map((prediction, col) => {
                const index = row * BINGO_SIZE + col;
                return `**${squareName(index)}${isMarked(card.marks, index) ? " [X]" : ""}** ${escapeMarkdown(prediction || "(empty)")}`;
            }).join("\n"),
        });
    }
    return embed;
}

export function bingoEditModal(card: BingoCard, start: number, count: 1 | 5 = 1): ModalBuilder {
    const modal = new ModalBuilder()
        .setCustomId(`bingo:save:${card.id}:${card.revision}:${start}:${count}`)
        .setTitle(count === 1 ? `Prediction ${squareName(start)}` : `Predictions for row ${Math.floor(start / BINGO_SIZE) + 1}`);
    for (let i = start; i < start + count; i++) {
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
            .setCustomId(`square-${i}`)
            .setLabel(`Square ${squareName(i)}`)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(BINGO_PREDICTION_LENGTH)
            .setRequired(false)
            .setValue(card.predictions[i])));
    }
    return modal;
}

export function bingoCardPicker(userId: string, listing: { cards: BingoCard[]; page: number; hasMore: boolean }) {
    const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
    if (listing.cards.length) {
        components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`bingo:open:${userId}`).setPlaceholder("Choose a card")
            .addOptions(listing.cards.map(card => ({
                label: card.title, value: card.id,
                description: `${card.submittedAt ? "Locked" : "Draft"} | ${card.createdAt.toISOString().slice(0, 10)}`,
            })))));
    }
    if (listing.page > 0 || listing.hasMore) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`bingo:cards:${userId}:${Math.max(0, listing.page - 1)}`)
                .setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(listing.page === 0),
            new ButtonBuilder().setCustomId(`bingo:cards:${userId}:${listing.page + 1}`)
                .setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(!listing.hasMore),
        ));
    }
    return { content: listing.cards.length ? `Your bingo cards | Page ${listing.page + 1}` : "No saved cards. Create one with /bingo name:<card name>.", components };
}
