import { RPGUserDataJSON, SlashCommandFile, Leaderboard } from "../../@types";
import { Message, APIEmbed, ButtonBuilder, ButtonStyle } from "discord.js";
import CommandInteractionContext from "../../structures/CommandInteractionContext";
import * as Functions from "../../utils/Functions";
import { ApplicationCommandOptionType } from "discord-api-types/v10";

const slashCommand: SlashCommandFile = {
    data: {
        name: "leaderboard",
        description: "Shows the leaderboard",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
            {
                name: "level",
                description: "Shows the level leaderboard",
                type: 1,
            },
            {
                name: "coins",
                description: "Shows the richest players",
                type: 1,
            },
        ],
    },
    execute: async (ctx: CommandInteractionContext): Promise<Message<boolean> | void> => {
        const lastLeaderboard = (JSON.parse(
            await ctx.client.database.getString(
                `${ctx.client.user.id}_leaderboard:${ctx.interaction.options.getSubcommand()}`
            )
        ) as Leaderboard) || { lastUpdated: 0, data: [] };
        const userPos =
            lastLeaderboard.data.findIndex((user) => user.id === ctx.user.id) + 1 || "N/A";

        const embed: APIEmbed = {
            title: "Leaderboard",
            description: "Loading...",
            color: 0x70926c,
            fields: [],
        };

        let currentPage = 1;
        const previousPageButton = new ButtonBuilder()
            .setCustomId("previousPage" + ctx.interaction.id)
            .setEmoji("⬅️")
            .setStyle(ButtonStyle.Primary);
        const firstPageButton = new ButtonBuilder()
            .setCustomId("firstPage" + ctx.interaction.id)
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Primary);
        const nextPageButton = new ButtonBuilder()
            .setCustomId("nextPage" + ctx.interaction.id)
            .setEmoji("➡️")
            .setStyle(ButtonStyle.Primary);
        const lastPageButton = new ButtonBuilder()
            .setCustomId("lastPage" + ctx.interaction.id)
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Primary);
        const userPageButton = new ButtonBuilder()
            .setCustomId("userPage" + ctx.interaction.id)
            .setEmoji("📍")
            .setStyle(ButtonStyle.Secondary);

        function updateMessage(page: number) {
            currentPage = page;

            if (currentPage > Math.ceil(lastLeaderboard.data.length / 10)) {
                currentPage = Math.ceil(lastLeaderboard.data.length / 10);
            } else if (currentPage < 1) {
                currentPage = 1;
            }

            embed.footer = {
                text: `Page ${currentPage}/${Math.ceil(
                    lastLeaderboard.data.length / 10
                )} | Last updated: ${new Date(lastLeaderboard.lastUpdated).toLocaleString()}`,
            };

            switch (ctx.interaction.options.getSubcommand()) {
                case "level": {
                    embed.title = "Level Leaderboard";
                    // only users with page currentPage
                    embed.fields = lastLeaderboard.data
                        .slice((currentPage - 1) * 10, currentPage * 10)
                        .map((user, i) => ({
                            name: `${
                                lastLeaderboard.data.findIndex((x) => x.id === user.id) + 1 || "N/A"
                            } - ${user.tag}${user.id === ctx.user.id ? " 📍" : ""}`,
                            value: `${
                                ctx.client.localEmojis.a_
                            } Level **${user.level.toLocaleString(
                                "en-US"
                            )}** with  **${user.xp.toLocaleString("en-US")}** ${
                                ctx.client.localEmojis.xp
                            }`,
                            inline: false,
                        }));

                    break;
                }

                case "coins": {
                    embed.title = "Richest Players";
                    embed.fields = lastLeaderboard.data
                        .slice((currentPage - 1) * 10, currentPage * 10)
                        .map((user, i) => ({
                            name: `${
                                lastLeaderboard.data.findIndex((x) => x.id === user.id) + 1 || "N/A"
                            } - ${user.tag}${user.id === ctx.user.id ? " 📍" : ""}`,
                            value: `${ctx.client.localEmojis.a_} **${user.coins.toLocaleString(
                                "en-US"
                            )}** ${ctx.client.localEmojis.jocoins}`,
                            inline: false,
                        }));
                    break;
                }
            }

            ctx.interaction.editReply({
                embeds: [embed],
                components: [
                    Functions.actionRow([
                        firstPageButton,
                        previousPageButton,
                        userPageButton,
                        nextPageButton,
                        lastPageButton,
                    ]),
                ],
            });
        }

        await ctx.interaction
            .reply({ embeds: [embed] }) // eslint-disable-next-line @typescript-eslint/no-empty-function
            .catch(() => {})
            .then(() => {
                embed.description = `${ctx.client.localEmojis.replyEnd} 📍 Your position: \`${userPos}\`/\`${lastLeaderboard.data.length}\``;
                updateMessage(currentPage);
            });

        const collector = ctx.interaction.channel.createMessageComponentCollector({
            filter: (interaction) =>
                interaction.user.id === ctx.user.id &&
                interaction.customId.includes(ctx.interaction.id),
        });

        collector.on("collect", (interaction) => {
            if (!interaction.isButton()) return;
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            interaction.deferUpdate().catch(() => {});

            switch (interaction.customId.replace(ctx.interaction.id, "")) {
                case "previousPage":
                    currentPage--;
                    break;
                case "firstPage":
                    currentPage = 1;
                    break;
                case "nextPage":
                    currentPage++;
                    break;
                case "lastPage":
                    currentPage = Math.ceil(lastLeaderboard.data.length / 10);
                    break;
                case "userPage":
                    currentPage = Math.ceil(userPos !== "N/A" ? userPos : 1 / 10);
                    break;
            }

            updateMessage(currentPage);
        });

        if (lastLeaderboard.lastUpdated + 1000 * 5 < Date.now()) {
            let query;
            switch (ctx.interaction.options.getSubcommand()) {
                case "level":
                    query = `SELECT id, tag, level, xp
                             FROM "RPGUsers"
                             ORDER BY level DESC, xp DESC`;
                    break;
                case "coins":
                    query = `SELECT id, tag, coins
                             FROM "RPGUsers"
                             ORDER BY coins DESC`;
                    break;
                default:
                    query = `SELECT *
                             FROM "RPGUsers"
                             ORDER BY level DESC, xp DESC`;
            }
            const data = await ctx.client.database.postgresql
                .query(query)
                .then((res) => res.rows)
                .catch((err) => {
                    console.error(err);
                    return [];
                });
            ctx.client.database.setString(
                `${ctx.client.user.id}_leaderboard:${ctx.interaction.options.getSubcommand()}`,
                JSON.stringify({
                    lastUpdated: Date.now(),
                    data: data,
                })
            );
        }
    },
};

export default slashCommand;
