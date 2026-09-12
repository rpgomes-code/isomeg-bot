# Bingo Cards

Create a personal 5x5 prediction card for a game showcase or any other event.
A full row, column, or either diagonal counts as a line. There is no free centre
square; a fully marked card has 12 lines.

## Card Flow

1. Run `/bingo name:Game Showcase` to create a named card in the channel.
2. Click any square. Enter its prediction in the popup and submit it; the same
   card updates immediately. Repeat for the other squares.
3. Click **Confirm Choices** when all 25 distinct predictions are ready.
   This permanently locks the predictions and enables marking.
4. Click squares as predictions happen. Clicking a marked square unmarks it.
   The card saves each click and displays completed lines automatically.
5. **Check** refreshes the card and privately reports the current lines.
   **View Choices** shows the full predictions when button labels are shortened.

Only the card's creator can edit, confirm, mark, or unmark it. Other members,
including administrators, can view the card but cannot change it. Marking is
self-reported: the bot detects lines, not whether announcements actually happened.

There are no event IDs, joining, host controls, or separate submission commands.
Multiple people can make their own cards with the same name.

## Saved Cards

Run `/bingo` without a name to open a private dropdown of your saved cards in
this server. The list has Previous/Next controls when needed. Selecting a card
opens its interactive controls, including after a bot restart.

The equivalent prefix command is `$bingo Game Showcase` (using the server's
configured prefix). Without a name it lists your cards in the channel.

All data is stored in Postgres. Ownership and server checks happen on every
mutation. Revision checks and row locks prevent an old form or simultaneous
click from overwriting newer choices. A stale control refreshes that copy of the
card and asks you to try again. Other copies refresh on their next interaction.

## Deployment and Verification

Migration `0004_named_bingo_cards.sql` copies each existing card's name and server
from its old event before making those card fields required. Existing card IDs,
owners, predictions, marks, confirmation timestamps, and revisions are preserved.
Previously submitted cards are locked and ready to mark; drafts remain editable.
The old event table and links remain for compatibility but no longer control play.
The startup migration runner applies this automatically.

The card uses Discord Components V2 so all 25 square buttons and confirmation
controls fit into one message. Editing a square opens a Discord text-input modal;
Discord does not offer inline typing directly inside a button. No additional
environment variables or Discord intents are needed.

Run `pnpm build` and `pnpm test:run`. For integration tests, set `DATABASE_URL` to
an isolated Postgres database and `RUN_DB_TESTS=true`. The migration upgrade test
also creates and removes a uniquely named temporary database, so the test role
needs CREATEDB permission. CI's Postgres test role already has this permission.

Before release, verify the rendered card in desktop and mobile Discord: fill
squares, confirm choices, mark/unmark a line, reopen a saved card, and attempt
changes from a second account. Unit and database tests do not replace a live
Discord rendering check.
