import {
    SlashCommandFile,
    Leaderboard,
    equipableItemTypesLimit,
    formattedEquipableItemTypes,
    EquipableItem,
    SkillPoints,
    Weapon,
    RPGUserDataJSON,
} from "../../@types";
import {
    Message,
    APIEmbed,
    InteractionResponse,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    AttachmentBuilder,
} from "discord.js";
import CommandInteractionContext from "../../structures/CommandInteractionContext";
import * as Functions from "../../utils/Functions";
import { makeChapterTitle } from "./Chapter";
import * as Chapters from "../../rpg/Chapters/Chapters";
import * as ChapterParts from "../../rpg/Chapters/ChapterParts";
import DungeonHandler from "../../structures/DungeonHandler";
import { cloneDeep } from "lodash";
import { dungeonLogsWebhook } from "../../utils/Webhooks";
import { Image, createCanvas, loadImage } from "canvas";

const timeFn = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return {
        hours: hours % 24,
        minutes: minutes % 60,
        seconds: seconds % 60,
    };
};
const msInMessage =
    // ex: 1 hour, 3 minutes and 2 seconds
    (ms: number) => {
        const time = timeFn(ms);
        return `${time.hours ? `${time.hours} hour${time.hours > 1 ? "s" : ""}, ` : ""}${
            time.minutes ? `${time.minutes} minute${time.minutes > 1 ? "s" : ""} and ` : ""
        }${time.seconds} second${time.seconds > 1 ? "s" : ""}`;
    };

const rewards = [
    {
        id: "stand_arrow",
        percent: 70,
    },
    {
        id: "rare_stand_arrow",
        percent: 35,
    },
    {
        id: "broken_arrow",
        percent: 100,
    },
    {
        id: "bloody_knife",
        percent: 0.5,
    },
    {
        id: "gauntlets_of_the_berserker",
        percent: 0.3,
    },
    {
        id: "dios_knives",
        percent: 0.2,
    },
    {
        id: "megumins_wand",
        percent: 0.2,
    },
];

const slashCommand: SlashCommandFile = {
    data: {
        name: "dungeon",
        description: "Start a dungeon.",
        options: [],
    },
    checkRPGCooldown: "dungeon",
    execute: async (
        ctx: CommandInteractionContext
    ): Promise<Message<boolean> | void | InteractionResponse> => {
        const dungeonDoneToday = await ctx.client.database.getString(
            `dungeonDone:${ctx.user.id}:${Functions.getTodayString()}`
        );
        const dungeonDoneTodayCount = dungeonDoneToday ? parseInt(dungeonDoneToday) : 0;
        const dateAtMidnight = new Date().setHours(0, 0, 0, 0);
        const nextDate = dateAtMidnight + 86400000;

        if (
            dungeonDoneTodayCount >= 4 &&
            !ctx.client.user.username.includes("Beta") &&
            !ctx.client.user.username.includes("Alpha")
        ) {
            const timeLeft = nextDate - Date.now();
            return ctx.makeMessage({
                content: `<:kars:1057261454421676092> **Kars:** You've already done 4 dungeons today. Come back ${Functions.generateDiscordTimestamp(
                    Date.now() + timeLeft,
                    "FROM_NOW"
                )}.`,
                embeds: [],
                components: [],
            });
        }
        if (await ctx.client.database.getString(`tempCache_${ctx.user.id}:dungeon`)) {
            /*ctx.client.users.fetch("239739781238620160").then((c) => {
                c.send(
                    `**${ctx.userData.tag}** (${
                        ctx.userData.id
                    }) has tried to start.`
                );
            });*/
            return ctx.makeMessage({
                content: "<:kars:1057261454421676092> **Kars:** Are you trying to scam me?",
                embeds: [],
                components: [],
            });
        }
        try {
            await ctx.channel.sendTyping();
        } catch (e) {
            return void ctx.makeMessage({
                content: "I don't have permission to send messages in this channel.",
                embeds: [],
                components: [],
            });
        }
        if ((ctx.userData.inventory["dungeon_key"] ?? 0) < 1) {
            return ctx.makeMessage({
                content:
                    "<:kars:1057261454421676092> **Kars:** HA! Where's your key? You can't enter without it!",
                embeds: [],
                components: [],
            });
        }

        const joinButton = new ButtonBuilder()
            .setCustomId("join_dungeon" + ctx.interaction.id)
            .setLabel("Join")
            .setStyle(ButtonStyle.Primary);
        const startButton = new ButtonBuilder()
            .setCustomId("start_dungeon" + ctx.interaction.id)
            .setLabel("Start")
            .setStyle(ButtonStyle.Success);
        const cancelButton = new ButtonBuilder()
            .setCustomId("cancel_dungeon" + ctx.interaction.id)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Danger);
        const totalPlayers = [ctx.userData];

        await ctx.makeMessage({
            content: `<:kars:1057261454421676092> **Kars:** ${ctx.userData.tag} is hosting a dungeon! (1/2)`,
            embeds: [],
            components: [Functions.actionRow([joinButton, startButton, cancelButton])],
        });
        const collector = ctx.channel.createMessageComponentCollector({
            time: 60000,
            filter: (i) => i.customId.includes(ctx.interaction.id),
        });

        collector.on("collect", async (i) => {
            if (i.customId === "join_dungeon" + ctx.interaction.id) {
                if (totalPlayers.length >= 2) {
                    return void i.reply({
                        content: "This dungeon is full.",
                        ephemeral: true,
                    });
                }

                // check if has done 5 dungeons today
                const dungeonDoneToday = await ctx.client.database.getString(
                    `dungeonDone:${i.user.id}:${Functions.getTodayString()}`
                );
                const dungeonDoneTodayCount = dungeonDoneToday ? parseInt(dungeonDoneToday) : 0;
                const dateAtMidnight = new Date().setHours(0, 0, 0, 0);
                const nextDate = dateAtMidnight + 86400000;

                if (dungeonDoneTodayCount >= 4) {
                    const timeLeft = nextDate - Date.now();
                    return void i.reply({
                        content: `You've already done 4 dungeons today. Come back ${Functions.generateDiscordTimestamp(
                            Date.now() + timeLeft,
                            "FROM_NOW"
                        )}.`,
                        ephemeral: true,
                    });
                }

                if (totalPlayers.find((f) => f.id === i.user.id)) {
                    return void i.reply({
                        content: "You're already in this dungeon.",
                        ephemeral: true,
                    });
                }
                const data = await ctx.client.database.getRPGUserData(i.user.id);
                if (!data) return;
                totalPlayers.push(data);
                i.reply({
                    content: "You've joined the dungeon.",
                    ephemeral: true,
                });
                await ctx.makeMessage({
                    content: `<:kars:1057261454421676092> **Kars:** ${data.tag} has joined the dungeon! (${totalPlayers.length}/2)`,
                    embeds: [],
                    components: [Functions.actionRow([startButton, cancelButton])],
                });
            } else if (i.customId === "start_dungeon" + ctx.interaction.id) {
                for (const player of totalPlayers) {
                    if (await ctx.client.database.getString(`tempCache_${player.id}:dungeon`)) {
                        /*ctx.client.users.fetch("239739781238620160").then((c) => {
                            c.send(
                                `**${ctx.userData.tag}** (${
                                    ctx.userData.id
                                }) has tried to start.`
                            );
                        });*/
                        ctx.makeMessage({
                            content: `<:kars:1057261454421676092> **Kars:** Are you trying to scam me? <@${player.id}>`,
                            embeds: [],
                            components: [],
                        });
                        collector.stop("scam");
                        return;
                    }
                }
                const message = await ctx.interaction.channel.send(`Initializing dungeon...`);
                ctx.makeMessage({
                    content: `<:kars:1057261454421676092> **Kars:** The dungeon has started! ${Functions.generateMessageLink(
                        message
                    )}`,
                    embeds: [],
                    components: [],
                });

                const dungeon = new DungeonHandler(ctx, totalPlayers, message);
                for (const player of totalPlayers) {
                    await ctx.client.database.setString(`tempCache_${player.id}:dungeon`, "true");
                }

                dungeon.on("unexpectedEnd", async (reason: string) => {
                    for (const player of totalPlayers) {
                        await ctx.client.database.redis.del(`tempCache_${player.id}:dungeon`);
                    }
                    if (reason === "maintenance" || ctx.client.maintenanceReason) {
                        dungeon.message.reply({
                            content: `The dungeon has ended due to maintenance: \`${ctx.client.maintenanceReason}\`. The host has been refunded a dungeon key but you still get the rewards.`,
                        });
                    }
                });

                dungeon.on("end", async (reason: string) => {
                    for (const player of totalPlayers) {
                        await ctx.client.database.redis.del(`tempCache_${player.id}:dungeon`);
                    }
                    if (reason === "maintenance" || ctx.client.maintenanceReason) {
                        dungeon.message.reply({
                            content: `The dungeon has ended due to maintenance: \`${ctx.client.maintenanceReason}\`. The host has been refunded a dungeon key but you still get the rewards.`,
                        });
                    } else {
                        for (const player of totalPlayers) {
                            await ctx.client.database.setRPGCooldown(
                                player.id,
                                "dungeon",
                                1000 * 60 * 15
                            );
                            // incr dungeon done today
                            const dungeonDoneToday = await ctx.client.database.getString(
                                `dungeonDone:${player.id}:${Functions.getTodayString()}`
                            );
                            const dungeonDoneTodayCount = dungeonDoneToday
                                ? parseInt(dungeonDoneToday)
                                : 0;
                            await ctx.client.database.redis.set(
                                `dungeonDone:${player.id}:${Functions.getTodayString()}`,
                                (dungeonDoneTodayCount + 1).toString()
                            );
                        }
                    }

                    let xpRewards = 60000;
                    let coinRewards = 0;

                    for (const enemy of dungeon.beatenEnemies) {
                        xpRewards += enemy.level * 1000;
                        coinRewards += enemy.level * 100;
                        if (enemy.rewards) {
                            if (enemy.rewards.xp) xpRewards += enemy.rewards.xp;
                            if (enemy.rewards.coins) coinRewards += enemy.rewards.coins;
                        }
                    }

                    xpRewards += dungeon.stage * 1000;
                    coinRewards += dungeon.stage * 100;
                    xpRewards = Math.round(xpRewards / 3.5);

                    const players: RPGUserDataJSON[] = [];
                    for (const player of dungeon.players) {
                        const data = await ctx.client.database.getRPGUserData(player.id);
                        if (!data) continue;
                        players.push(data);
                    }
                    const newPlayers = cloneDeep(players);
                    const userData = players.find((f) => f.id === ctx.userData.id);
                    if ((userData.inventory["dungeon_key"] ?? 0) < 1) {
                        ctx.client.users.fetch("239739781238620160").then((c) => {
                            c.send(
                                `**${ctx.userData.tag}** (${
                                    ctx.userData.id
                                }) with players (${newPlayers
                                    .map((x) => x.id)
                                    .join(", ")}) has tried to scam the dungeon system.`
                            );
                        });
                        return ctx.makeMessage({
                            content:
                                "<:kars:1057261454421676092> **Kars:** Wait, where's your key? Did you just scam me? [ANTICHEAT ERROR]",
                            embeds: [],
                            components: [],
                        });
                    }
                    const totalDamage = Object.values(dungeon.damageDealt).reduce(
                        (a, b) => a + b,
                        0
                    );

                    for (const player of newPlayers) {
                        for (let i = 0; i < Math.round(dungeon.stage / 3); i++) {
                            for (const item of rewards) {
                                const percent =
                                    (dungeon.damageDealt[player.id] / totalDamage) * item.percent;
                                if (Functions.percent(percent)) {
                                    Functions.addItem(player, item.id, 1);
                                }
                            }
                        }

                        const playerDiffPercent =
                            players.length === 1
                                ? 0
                                : Math.abs(
                                      (players[0].level - players[1].level) /
                                          Math.max(players[0].level, players[1].level)
                                  );
                        Functions.addXp(
                            player,
                            Math.round(
                                (dungeon.damageDealt[player.id] / totalDamage) *
                                    xpRewards *
                                    (players.length === 2
                                        ? playerDiffPercent <= 0.5
                                            ? 1.2
                                            : Math.max(players[0].level, players[1].level) < 60
                                            ? 1.2
                                            : 1
                                        : 1)
                            )
                        );
                        player.coins += coinRewards;
                        player.health = 0;
                        player.stamina = 0;

                        if (player.id === ctx.userData.id && !ctx.client.maintenanceReason)
                            Functions.removeItem(player, "dungeon_key", 1);

                        ctx.client.database.saveUserData(player);
                    }
                    dungeon.message.edit({
                        content: `<:kars:1057261454421676092> **Kars:** well done, you've survived **${dungeon.getRoom()}** waves and beaten **${
                            dungeon.beatenEnemies.length
                        }** enemies (total damage: ${totalDamage.toLocaleString(
                            "en-US"
                        )}).\n\n${Object.keys(dungeon.damageDealt)
                            .map((x) => {
                                return `- **${dungeon.players.find((f) => f.id === x).tag}**: ${(
                                    dungeon.damageDealt[x] ?? 0
                                ).toLocaleString(
                                    "en-US"
                                )} damages dealt\n- - ${Functions.getRewardsCompareData(
                                    players.find((f) => f.id === x),
                                    newPlayers.find((f) => f.id === x)
                                ).join("\n- - ")}`;
                            })
                            .join("\n\n")}`,
                        embeds: [],
                        components: [],
                    });
                    const canvas =
                        players.length === 2 ? createCanvas(1024, 512) : createCanvas(512, 512);
                    const ctxCanvas = canvas.getContext("2d");

                    const images: Image[] = [];
                    for (const player of players) {
                        const playerUser = await ctx.client.users.fetch(player.id);
                        const image = await loadImage(
                            playerUser.displayAvatarURL({ size: 512, extension: "png" })
                        );
                        images.push(image);
                    }

                    if (players.length === 2) {
                        ctxCanvas.drawImage(images[0], 0, 0, 512, 512);
                        ctxCanvas.drawImage(images[1], 512, 0, 512, 512);
                    } else {
                        ctxCanvas.drawImage(images[0], 0, 0, 512, 512);
                    }

                    const attachment = new AttachmentBuilder(canvas.toBuffer(), {
                        name: "dungeon.png",
                    });

                    dungeonLogsWebhook.send({
                        embeds: [
                            {
                                title: `Dungeon`,
                                description: `cleared **${dungeon.getRoom()}** waves and beaten **${
                                    dungeon.beatenEnemies.length
                                }** enemies (total stage = ${dungeon.stage})`,
                                color: 0x70926c,
                                fields: [
                                    {
                                        name: "Host",
                                        value: ctx.userData.tag,
                                        inline: true,
                                    },
                                    {
                                        name: "Time taken",
                                        value: `${msInMessage(
                                            Date.now() - dungeon.startedAt
                                        )} (started: ${Functions.generateDiscordTimestamp(
                                            dungeon.startedAt,
                                            "FULL_DATE"
                                        )})`,
                                        inline: true,
                                    },
                                    {
                                        name: "Guild info",
                                        value: `${ctx.guild.name} (${ctx.guild.id})`,
                                        inline: true,
                                    },
                                    {
                                        name: "Total damages",
                                        value: Object.keys(dungeon.damageDealt)
                                            .sort(
                                                (a, b) =>
                                                    dungeon.damageDealt[b] - dungeon.damageDealt[a]
                                            )
                                            .map(
                                                (r) =>
                                                    `- ${
                                                        dungeon.players.find((f) => f.id === r).tag
                                                    } (${r}): **${dungeon.damageDealt[
                                                        r
                                                    ].toLocaleString("en-US")}**`
                                            )
                                            .join("\n"),
                                    },
                                    {
                                        name: "Last enemy of the current wave",
                                        value: dungeon.enemies[dungeon.enemies.length - 1]
                                            ? `${
                                                  dungeon.enemies[dungeon.enemies.length - 1].emoji
                                              } | ${
                                                  dungeon.enemies[dungeon.enemies.length - 1].name
                                              } (level ${
                                                  dungeon.enemies[dungeon.enemies.length - 1].level
                                              })`
                                            : "none, too bad",
                                        inline: true,
                                    },
                                    {
                                        name: "Rewards",
                                        value: Object.keys(dungeon.damageDealt)
                                            .map((r) => {
                                                const player = players.find((f) => f.id === r);
                                                const newPlayer = newPlayers.find(
                                                    (f) => f.id === r
                                                );
                                                return `- **${
                                                    player.tag
                                                }**: \n${Functions.getRewardsCompareData(
                                                    player,
                                                    newPlayer
                                                ).join("\n")}`;
                                            })
                                            .join("\n\n"),
                                    },
                                ],
                                image: {
                                    url: "attachment://dungeon.png",
                                },
                                thumbnail: {
                                    url: ctx.guild.iconURL(),
                                },
                                timestamp: new Date().toISOString(),
                            },
                        ],
                        files: [attachment],
                    });
                });
                collector.stop("start");
            } else if (i.customId === "cancel_dungeon" + ctx.interaction.id) {
                ctx.interaction.deleteReply();
                collector.stop("cancel");
            }
        });
    },
};

export default slashCommand;
