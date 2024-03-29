import path from "path";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { Client, Guild, GatewayIntentBits, SlashCommandBuilder } from "discord.js";
import { rand, readJson } from "./util";
import defaultCommands from "./commands";
import { ConfigJson, AuthJson } from "./types";

const { TOKEN } = readJson(path.join(__dirname, "../config/auth.json")) as AuthJson;
const {
    CLIENT_ID,
    ADMIN_USER_ID
} = readJson(path.join(__dirname, "../config/config.json")) as ConfigJson;

const rest = new REST({ version: "9" }).setToken(TOKEN);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const GEX_TEXT = [
    "Note to self: Don't drink tap water at Jerry Garcia's.",
    "Note to self: Don't step on any brown mushy rocks!",
    "Note to self: Don't buy a rocket sled made by ACME.",
    "Will Cheech and/or Chong, report to the front desk!",
    "Hey! I feel like I'm trapped in Boy George's pants!",
    "And remember kids, never buy a marvolay from a guy with a top hat.",
    "This is like a luau at Mel Blanc's house!",
    "Ahh to see the world as Keith Richards does...",
    "Brought to you by up-Chuck Jones.",
    "What are you, Larry King's barber? Ha! Ha! You're alright!",
    "Carrot Top, is that you?",
    "Reminds me of Halloween at Rip Taylor's.",
    "This place is bigger than Drew Carey's bar tab.",
    "Man, Hef has let his place go.",
    "Don't take career advice from Joe Piscopo.",
    "This is what Tim Burton thinks about when he's in the tub.",
    "The real estate wizardry of Tom Vu at work.",
    "You have the swan-like grace of a young Nixon.",
    "Ladies and gentlemen, Tom Arnold's acting coach.",
    "How did I get in Bill Gates' head?",
    "This is like an all-nighter at Richard Simmons' house.",
    "All this technology so fat guys can hear Rush Limbaugh?",
    "All this technology and Shatner still can't get a good hairpiece.",
    "In a land before time, when Saturday Night Live was funny...",
    "I'll take 'Places I Can Burn To Death' for $100, Alex.",
    "The difference between this and Hades is that there's no Kathy Lee Gifford.",
    "And this is just one of the forty thousand rooms in Aaron Spelling's house!",
    "I haven't seen blasts like this since taco night at James Earl Jones' house.",
    "I'm lost in Dick Dale's colon.",
    "Hmm, reminds me of Jackie Chan's bathroom.",
    "Captain, they are a bizarre alien race that find Adam Sandler funny.",
    "Has anyone seen Fox Mulder's sister?",
    "Scotty, beam me into an Ivy League Sorority House.",
    "Welcome to the only thing more evil than IRS Headquarters.",
    "I feel like Ben Franklin's wallet.",
    "That's for 12 years of Full House!",
    "This place is weirder than 4th of July at Rick James' place.",
    "Soon, Ted Turner will have this colorized!",
    "Hope I don't make a wrong turn and end up in an old game of Asteroids.",
    "So THAT'S what happened to Richard Dawson.",
    "This place is hotter than Tom Arnold's sauna pants.",
    "Memo to Gilligan: try building a raft.",
    "Hey, look, it's Tarzan's bidét!",
    "Wow, I always thought Harrison Ford was taller.",
    "That's as much fun as being Mike Tyson's cell-mate on Valentine's Day!",
    "Yeah, this place has all the warmth of a Dick Clark special.",
    "Bob Hope has more color in his cheeks.",
    "I haven't been this scared since I was trapped in Barry Manilow's rumpus room."
];

const phraseMatchDates = new Array(GEX_TEXT.length).fill(null);

const ignoredUpperCaseWords = ["dont", "i", "can", "to", "im", "ha", "youre", "day", "thats", "hope"];
const APOSTROPHE_S = "'s";

function extractTokensFromGexText(textArray: string[]): string[][] {
    const tokens: string[][] = [];
    textArray.forEach((phrase) => {
        const phraseTokens: string[] = [];
        const phraseWords = phrase.split(" ").slice(1);
        phraseWords.forEach((word) => {
            if (
                word[0] === word[0].toUpperCase()
            ) {
                let IS_POSSESSIVE = false;
                const possessiveIdx = word.indexOf(APOSTROPHE_S);
                if (possessiveIdx > -1) {
                    IS_POSSESSIVE = true;
                }
                const cleanWord = word.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
                if(
                    ignoredUpperCaseWords.indexOf(cleanWord) === -1
                    && isNaN(Number(cleanWord[0]))
                ) {
                    phraseTokens.push(cleanWord);
                    if (IS_POSSESSIVE) {
                        const w = cleanWord.substring(0, possessiveIdx)
                            + cleanWord.substring(possessiveIdx + 1);
                        phraseTokens.push(w);
                    }
                }
            }
        });
        tokens.push(phraseTokens);
    });
    return tokens;
}

function isOnCooldown(idx: number) {
    const oneWeekMs = 1000 * 60 * 60 * 24 * 7;
    if (!phraseMatchDates[idx] || Date.now()
        - phraseMatchDates[idx].getTime() > oneWeekMs
    ) {
        return false;
    }
    console.info("Ignoring phrase match for index", idx);
    return true;
}

const setGuildCommands = async (guildId: string, builtCommands: SlashCommandBuilder[] = []) => {
    try {
        console.log(`Refreshing application (/) commands for guild ${guildId}`);
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, guildId),
            { body: [...defaultCommands, ...builtCommands] }
        );
    } catch (error) {
        console.error(error);
    }
};

let tokens: string[][];

client.on("ready", async () => {
    try {
        if (client.user) {
            console.info("Logged in as", client.user.tag);
            console.info("Dev mode:", process.env.DEV_MODE);
        }
        if (client.application) {
            console.info("Clearing any existing global application (/) commands");
            client.application.commands.set([]);

            await Promise.all(client.guilds.cache.map(async (guild: Guild) => {
                await setGuildCommands(guild.id);
            }));
        }
        tokens = extractTokensFromGexText(GEX_TEXT);
        console.info("Loaded tokens:", tokens);
    } catch (err) {
        console.error(err);
    }
});

client.on("guildCreate", async (guild: Guild) => {
    // Registers the default commands when the bot joins a guild
    await setGuildCommands(guild.id);
});

client.on("messageCreate", async (message) => {
    try {
        if (!client.user) {
            throw new Error("Bot client is not ready yet, abort");
        }
        if (message.author.id === client.user.id) {
            return;
        }
        const words = message.content.split(" ");
        let phraseMatch = "";
        let phraseMatchIdx = 0;
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            tokens.forEach((phraseTokens, idx) => {
                const cleanWord = word.toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
                if (phraseTokens.indexOf(cleanWord) > -1 && !isOnCooldown(idx)) {
                    phraseMatch = GEX_TEXT[idx];
                    phraseMatchIdx = idx;
                }
            });
            if (phraseMatch) {
                break;
            }
        }
        const oneInFive = rand(5) === 0;
        if (phraseMatch && oneInFive) {
            phraseMatchDates[phraseMatchIdx] = new Date();
            await message.reply(phraseMatch);
        }
    } catch (err) {
        console.error("Failed to handle messageCreate event", err);
    }
});

client.on("interactionCreate", async (interaction) => {
    try {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === "ping") {
            await interaction.reply("pong!");
        }

        if (interaction.commandName === "gex") {
            const textThruGex = interaction.options.getString("text");
            if (interaction.user.id === ADMIN_USER_ID && textThruGex) {
                await interaction.reply(`Reminds me of that time ${interaction.user} said '${textThruGex}'`);
            } else {
                await interaction.reply(GEX_TEXT[rand(GEX_TEXT.length)]);
            }
        }
    } catch (err) {
        console.error("Failed to handle slash command", err);
    }
});

client.login(TOKEN);
