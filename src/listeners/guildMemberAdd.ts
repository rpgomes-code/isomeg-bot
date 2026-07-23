import { Events, Listener } from "@sapphire/framework";
import type { GuildMember } from "discord.js";
import { sendConfiguredMemberMessage } from "../lib/welcome";

export class GuildMemberAddListener extends Listener<typeof Events.GuildMemberAdd> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: Events.GuildMemberAdd,
        });
    }

    public async run(member: GuildMember): Promise<void> {
        await sendConfiguredMemberMessage(member.guild, member, "welcome");
    }
}
