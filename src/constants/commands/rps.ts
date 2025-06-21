import {RPSChoice} from "../../enums/commands/rps";

export const choices: RPSChoice[] = [
    RPSChoice.Rock,
    RPSChoice.Paper,
    RPSChoice.Scissors,
];

export const emojis = {
    [RPSChoice.Rock]: "🪨",
    [RPSChoice.Paper]: "📄",
    [RPSChoice.Scissors]: "✂️",
};

export const winningCombos = {
    [RPSChoice.Rock]: RPSChoice.Scissors,
    [RPSChoice.Paper]: RPSChoice.Rock,
    [RPSChoice.Scissors]: RPSChoice.Paper,
};