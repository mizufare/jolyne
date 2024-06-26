import { SlashCommandFile, ClaimXQuest } from "../../@types";
import {
    Message,
    APIEmbed,
    ButtonBuilder,
    ButtonStyle,
    InteractionResponse,
    MessageComponentInteraction,
} from "discord.js";
import CommandInteractionContext from "../../structures/CommandInteractionContext";
import * as Functions from "../../utils/Functions";
import { FightableNPCS } from "../../rpg/NPCs";
import { ApplicationCommandOptionType } from "discord-api-types/v10";
import { StandArrow } from "../../rpg/Items/SpecialItems";
import { getQuestsStats } from "./Chapter";
import { cloneDeep } from "lodash";

const dailyQuestResetPrice = {
    undefined: 1000,
    null: 1000,
    0: 1000,
    1: 10000,
    2: 25000,
    3: 50000,
    4: 100000,
    5: 500000,
    6: 1000000,
    7: 2500000,
    8: 5000000,
    9: 10000000,
    10: 50000000,
    11: 100000000,
    12: 500000000,
    13: 1000000000,
    14: 5000000000,
    15: 10000000000,
    16: 50000000000,
    17: 100000000000,
    18: 500000000000,
    19: 1000000000000,
    20: 5000000000000,
    21: 10000000000000,
    22: 50000000000000,
    23: 100000000000000,
    24: 500000000000000,
    25: 1000000000000000,
};

const slashCommand: SlashCommandFile = {
    data: {
        name: "daily",
        description: "Claim your daily or view your daily quests.",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "claim",
                description: "Claim your daily rewards.",
                type: 1,
            },
            {
                name: "quests",
                description: "Shows your daily quests.",
                type: 1,
            },
        ],
    },
    execute: async (
        ctx: CommandInteractionContext
    ): Promise<Message<boolean> | void | InteractionResponse<boolean>> => {
        const dateAtMidnight = new Date().setUTCHours(0, 0, 0, 0);
        const nextDate = dateAtMidnight + 86400000;
        switch (ctx.interaction.options.getSubcommand()) {
            case "claim": {
                if (
                    ctx.userData.daily.lastClaimed &&
                    ctx.userData.daily.lastClaimed >= dateAtMidnight &&
                    ctx.userData.daily.lastClaimed < nextDate
                ) {
                    return ctx.sendTranslated("daily:ALREADY_CLAIMED", {
                        time: Functions.generateDiscordTimestamp(
                            Date.now() + (nextDate - Date.now()),
                            "FROM_NOW"
                        ),
                    });
                }
                const rewards = Functions.getRewards(ctx.userData.level);

                Functions.addCoins(ctx.userData, rewards.coins);
                Functions.addXp(ctx.userData, rewards.xp);

                if (ctx.userData.daily.lastClaimed !== dateAtMidnight - 86400000) {
                    ctx.userData.daily.claimStreak = 0;
                }

                ctx.userData.daily.claimStreak++;
                ctx.userData.daily.lastClaimed = dateAtMidnight;

                let nextGoal = ctx.userData.daily.claimStreak + 1;
                while (nextGoal % 7 !== 0) {
                    nextGoal++;
                }

                let embed_description = ctx.translate<string>("daily:CLAIMED_EMBED_DESCRIPTION", {
                    coins: rewards.coins.toLocaleString("en-US"),
                    xp: rewards.xp.toLocaleString("en-US"),
                });

                if (ctx.client.patreons.find((r) => r.id === ctx.userData.id)) {
                    const xpRewards = Math.round(
                        rewards.xp *
                            (ctx.client.patreons.find((r) => r.id === ctx.userData.id).level / 7 +
                                0.25)
                    );
                    const moneyRewards = Math.round(
                        rewards.coins *
                            (ctx.client.patreons.find((r) => r.id === ctx.userData.id).level / 7 +
                                0.25)
                    );
                    embed_description +=
                        "\n" +
                        ctx.translate("daily:CLAIMED_EMBED_DESCRIPTION_PREMIUM", {
                            coins: moneyRewards.toLocaleString("en-US"),
                            xp: xpRewards.toLocaleString("en-US"),
                            tier: ctx.client.patreons.find((r) => r.id === ctx.userData.id).level,
                        });
                    Functions.addCoins(ctx.userData, moneyRewards);
                    Functions.addXp(ctx.userData, xpRewards);
                }
                if (ctx.client.boosters.find((r) => r === ctx.userData.id)) {
                    Functions.addCoins(ctx.userData, 1000);
                    Functions.addXp(ctx.userData, 1000);
                    embed_description +=
                        "\n" +
                        ctx.translate("daily:CLAIMED_EMBED_DESCRIPTION_BOOSTER", {
                            coins: (1000).toLocaleString("en-US"),
                            xp: (1000).toLocaleString("en-US"),
                        });
                }

                const embed: APIEmbed = {
                    author: {
                        name: ctx.user.username,
                        icon_url: ctx.user.displayAvatarURL(),
                    },
                    description: embed_description,
                    color: 0x70926c,
                    footer: {
                        text:
                            ctx.translate("daily:CLAIMED_EMBED_FOOTER") +
                            ` ${ctx.userData.daily.claimStreak}/${nextGoal}`,
                    },
                    fields: [
                        {
                            name: ctx.translate("daily:WANT_MORE_HEADER"),
                            value: "[..]",
                        },
                    ],
                };

                if (
                    ctx.client.patreons.find((r) => r.id === ctx.userData.id) &&
                    ctx.client.boosters.find((r) => r === ctx.userData.id)
                ) {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_PREMIUM_BOOSTER"
                    );
                } else if (ctx.client.patreons.find((r) => r.id === ctx.userData.id)) {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_PREMIUM_NON_BOOSTER"
                    );
                } else if (ctx.client.boosters.find((r) => r === ctx.userData.id)) {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_NON_PREMIUM_BOOSTER"
                    );
                } else {
                    embed.fields[0].value = ctx.translate(
                        "daily:WANT_MORE_DESCRIPTION_NON_PREMIUM_NON_BOOSTER"
                    );
                }

                if (ctx.userData.daily.claimStreak % 7 == 0) {
                    let arrows = 0;
                    for (let i = ctx.userData.daily.claimStreak; i > 0; i -= 7) {
                        arrows++;
                    }
                    arrows *= 1.5;
                    arrows = Math.round(arrows);

                    if (arrows > 25) arrows = 25;

                    for (let i = 0; i < arrows; i++) {
                        Functions.addItem(ctx.userData, StandArrow);
                    }
                    embed.fields.push({
                        name: "Streak Bonus",
                        value: `\`x${arrows} ${StandArrow.name}\` ${StandArrow.emoji}`,
                    });
                }

                for (const quests of [
                    ctx.userData.daily.quests,
                    ctx.userData.chapter.quests,
                    ...ctx.userData.sideQuests.map((v) => v.quests),
                ]) {
                    for (const quest of quests.filter(
                        (r) => Functions.isClaimXQuest(r) && r.x === "daily"
                    )) {
                        (quest as ClaimXQuest).amount++;
                    }
                }

                if (
                    Functions.dailyClaimRewardsChristmas(ctx.userData.level)[
                        Functions.getCurrentDate() as keyof typeof Functions.dailyClaimRewardsChristmas
                    ]
                ) {
                    const rewards = Functions.dailyClaimRewardsChristmas(ctx.userData.level)[
                        Functions.getCurrentDate() as keyof typeof Functions.dailyClaimRewardsChristmas
                    ];

                    const coins = rewards.coins;
                    const xp = rewards.xp;
                    const items = rewards.items;

                    const oldData = cloneDeep(ctx.userData);
                    if (coins) Functions.addCoins(ctx.userData, coins);
                    if (xp) Functions.addXp(ctx.userData, xp);
                    if (items) {
                        for (const item of Object.keys(items)) {
                            Functions.addItem(ctx.userData, Functions.findItem(item), items[item]);
                        }
                    }

                    embed.fields.push({
                        name: "Christmas Event",
                        value: `You got the following rewards for claiming today: ${Functions.getRewardsCompareData(
                            oldData,
                            ctx.userData
                        )} `,
                    });
                }

                await ctx.client.database.saveUserData(ctx.userData);

                await ctx.makeMessage({
                    embeds: [embed],
                });

                break;
            }
            case "quests": {
                const status = getQuestsStats(ctx.userData.daily.quests, ctx);

                let coinReward = 0;
                let xpReward = 2500;

                for (const quest of ctx.userData.daily.quests) {
                    if (Functions.isClaimItemQuest(quest) || Functions.isClaimXQuest(quest)) {
                        coinReward += quest.goal / 5;
                        xpReward += quest.goal / 15;
                        continue;
                    }

                    if (Functions.isFightNPCQuest(quest)) {
                        const npc = Object.values(FightableNPCS).find((r) => r.id === quest.npc);
                        if (!npc) continue;

                        coinReward += (npc.level + 1) * 100;
                        xpReward += (npc.level + 1) * 10;
                        continue;
                    }

                    coinReward += 100;
                    xpReward += 75;
                }
                if (coinReward > 50000) coinReward = 50000;
                xpReward = Math.round(xpReward * 1.99);

                const components: ButtonBuilder[] = [];

                if (Number(status.percent) === 100) {
                    const alreadyClaimed = await ctx.client.database.redis.get(
                        `daily-quests-${ctx.userData.id}`
                    );

                    components.push(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Success)
                            .setEmoji("⭐")
                            .setCustomId(ctx.interaction.id + "daily-quests-claim")
                            .setDisabled(alreadyClaimed === "true")
                    );

                    if (alreadyClaimed === "true") {
                        components.push(
                            // repeat button
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji("🔁")
                                .setCustomId(ctx.interaction.id + "daily-quests-reset")
                                .setLabel(
                                    `Reset for ${
                                        dailyQuestResetPrice[
                                            ctx.userData.daily
                                                .dailyQuestsReset as keyof typeof dailyQuestResetPrice
                                        ]
                                    } coins`
                                )
                        );
                    }
                }

                await ctx.makeMessage({
                    embeds: [
                        {
                            // 📜 **__Daily Quests:__** (${status.percent.toFixed(2)}%)\n
                            description: `${status.message}\n\n${ctx.translate(
                                "daily:REWARDS_MESSAGE",
                                {
                                    coins: coinReward.toLocaleString("en-US"),
                                    xp: xpReward.toLocaleString("en-US"),
                                    discordUnix: Functions.generateDiscordTimestamp(
                                        dateAtMidnight + 86400000,
                                        "FROM_NOW"
                                    ),
                                    dungeon_key: Functions.findItem("Dungeon").emoji,
                                }
                            )}`,
                            color: 0x70926c,
                            author: {
                                icon_url: ctx.user.displayAvatarURL(),
                                name: `📜 ${
                                    ctx.user.username
                                }'s Daily Quests (${status.percent.toFixed(2)}%)`,
                            },
                        },
                    ],
                    components: components.length !== 0 ? [Functions.actionRow(components)] : [],
                });

                if (components.length > 0) {
                    const filter = (i: MessageComponentInteraction) => {
                        i.deferUpdate().catch(() => {}); // eslint-disable-line @typescript-eslint/no-empty-function

                        return (
                            i.user.id === ctx.user.id &&
                            (i.customId === ctx.interaction.id + "daily-quests-claim" ||
                                i.customId === ctx.interaction.id + "daily-quests-reset")
                        );
                    };

                    const collector = ctx.channel.createMessageComponentCollector({
                        filter,
                        time: 30000,
                    });

                    collector.on("collect", async (i) => {
                        /**
                         * Priority:
                         * 1. Check if user is trying to cheat
                         * 2. Save user data
                         * 3. Set daily-quests-<id> to true
                         */
                        const currentRPGJson = JSON.stringify(ctx.userData);
                        ctx.RPGUserData = await ctx.client.database.getRPGUserData(ctx.user.id);

                        if (currentRPGJson !== JSON.stringify(ctx.userData)) {
                            collector.stop("cheater");
                            return;
                        }

                        if (i.customId === ctx.interaction.id + "daily-quests-reset") {
                            const price =
                                dailyQuestResetPrice[
                                    ctx.userData.daily
                                        .dailyQuestsReset as keyof typeof dailyQuestResetPrice
                                ];
                            if (ctx.userData.coins < price) {
                                await i.followUp({
                                    content: `You don't have enough coins to reset your daily quests. You need ${price.toLocaleString(
                                        "en-US"
                                    )} coins to reset your daily quests.`,
                                });
                                return;
                            }

                            ctx.userData.coins -= price;
                            ctx.userData.daily.quests = Functions.generateDailyQuests(
                                ctx.userData.level
                            );
                            await ctx.client.database.redis.del(`daily-quests-${ctx.userData.id}`);
                            if (!ctx.userData.daily.dailyQuestsReset) {
                                ctx.userData.daily.dailyQuestsReset = 0;
                            }
                            ctx.userData.daily.dailyQuestsReset++;
                            await ctx.client.database.saveUserData(ctx.userData);
                            i.followUp({
                                content: ctx.translate("daily:RESET_SUCCESS", {
                                    price: price.toLocaleString("en-US"),
                                }),
                            });
                            return;
                        }

                        Functions.addCoins(ctx.userData, coinReward);
                        Functions.addXp(ctx.userData, xpReward);
                        Functions.addItem(ctx.userData, Functions.findItem("Stand Arrow"));
                        Functions.addItem(ctx.userData, Functions.findItem("Dungeon"));

                        await ctx.client.database.saveUserData(ctx.userData);
                        await ctx.client.database.redis.set(
                            `daily-quests-${ctx.userData.id}`,
                            "true"
                        );

                        await ctx.makeMessage({
                            components: [Functions.actionRow([components[0].setDisabled(true)])],
                        });

                        await ctx.followUp({
                            content: ctx.translate("daily:REWARDS_CLAIM_MESSAGE", {
                                coins: coinReward.toLocaleString("en-US"),
                                xp: xpReward.toLocaleString("en-US"),
                                dungeon_key: Functions.findItem("Dungeon").emoji,
                            }),
                        });
                    });
                }
                break;
            }
        }
    },
};

export default slashCommand;
