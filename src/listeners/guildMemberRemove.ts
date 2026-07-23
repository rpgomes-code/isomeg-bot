import { Events, Listener } from "@sapphire/framework";
import type { GuildMember, PartialGuildMember } from "discord.js";
import { sendConfiguredMemberMessage } from "../lib/welcome";

export class GuildMemberRemoveListener extends Listener<typeof Events.GuildMemberRemove> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.GuildMemberRemove,
        });
    }

    public async run(member: GuildMember | PartialGuildMember): Promise<void> {
        await sendConfiguredMemberMessage(member.guild, member, "goodbye");
    }
}
