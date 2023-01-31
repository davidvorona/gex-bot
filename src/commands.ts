import { SlashCommandBuilder } from "discord.js";

export default [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with pong!"),
    new SlashCommandBuilder()
        .setName("gex")
        .setDescription("Do what gex does best!")
        .addStringOption(option =>
            option
                .setName("text")
                .setDescription("text")
        )
];
