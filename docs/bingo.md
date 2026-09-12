# Event Bingo

Bingo is designed for game showcases and similar live events. Each player writes
25 predictions on a personal 5x5 card before the event, then marks the predictions
that happen. There is no free centre square. A full row, column, or either diagonal
counts as a line (12 possible lines on a completely marked card).

## Event Flow

1. The host runs `/bingo create title:Game Showcase` and shares the event ID.
2. Players run `/bingo join event-id:<id>` to create their own cards. Joining again
   reopens the same card; there is one card per player per event.
3. Click a square to edit its prediction, or run `/bingo edit card-id:<id> row:1`
   to fill five predictions at once. Repeat for rows 2-5.
4. Run `/bingo submit card-id:<id>` when all 25 distinct predictions are ready.
   `/bingo unlock card-id:<id>` allows changes before the event starts, but the
   card must then be submitted again.
5. The host runs `/bingo start event-id:<id>`. This locks predictions and closes
   submissions. Unsubmitted cards cannot participate in live marking.
6. Open `/bingo card card-id:<id>` for the live controls. Click a square to mark
   or unmark it. Every click saves immediately and recalculates completed lines.
7. Use `/bingo results event-id:<id>` for standings, with the optional `page`
   parameter for more results. Submitted cards rank by lines, then marked squares.
8. The host runs `/bingo end event-id:<id>` to freeze the final cards and results.

`/bingo events` lists the ten most recent events in the server. Cards are shown
privately by default; `/bingo card card-id:<id> public:true` shares a card in the
channel. The buttons show abbreviated predictions; the embed shows the full text.

## Ownership and Persistence

Only a card's creator can edit, submit, unlock, mark, or unmark it. The event host
and server administrators have no override for another person's card. They can
view cards in the same server, just like other members. Only the event creator
can start and end an event. These transitions cannot be reversed.

All state is stored in Postgres and survives bot restarts. Each edit and mark
checks the actual Discord user, the server, event phase, and card revision.
Old forms and conflicting simultaneous clicks are rejected rather than
overwriting newer changes. Reopen `/bingo card` after changing event phase or
when another copy of a card is out of date.

Marks are self-reported by each card owner. The bot checks completed lines; it
does not verify announcements or award economy currency.

## Deployment and Verification

Migration `0003_event_bingo.sql` adds the event and card tables. The existing
startup migration runner applies it automatically. No additional environment
variables or Discord intents are required for bingo.

Run `pnpm build` and `pnpm test:run`. To include database tests, migrate an isolated
Postgres database, set `DATABASE_URL` to it and set `RUN_DB_TESTS=true`, then run the
test suite. CI already includes Postgres and runs these checks.

Before release, test in Discord with two accounts: create a card as one user,
share it publicly, and attempt edits and marks as the other user. Also verify
row editing, submission, start, marking/unmarking a line, results, and end.
