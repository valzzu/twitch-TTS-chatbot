import { RefreshingAuthProvider } from "@twurple/auth";
import { Bot, createBotCommand } from "@twurple/easy-bot";
import { promises as fs } from "fs";
import { Server } from "socket.io";
import express from "express";
import http from "http";
import say from "say";
import bodyParser from "body-parser";
import CharacterAI from "node_characterai";

const characterAI = new CharacterAI();
const token = "character ai token";
let chat;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
const server = http.createServer(app);
const io = new Server(server);

let isSpeaking = false;
let currentlySpokenMessage = "";
const messageQueue = [];

// Swear word filter array
let swearWords = [];

let pplToAddress = ["foxbot_ai", "iris_the_elf", "simple_", "tiadragon"];

// Variable to track TTS status
let isTTSEnabled = true;

// Variable to track filtering status
let isFilterEnabled = true;

let lastAddedMessage = "";

let toggleState = "option1";

let voiceSelected = "Microsoft Hazel Desktop";

const clientId = "";
const clientSecret = "";
const tokenData = JSON.parse(
  await fs.readFile("./tokens/tokens.160080244.json", "UTF-8")
);
const authProvider = new RefreshingAuthProvider({
  clientId,
  clientSecret,
});

authProvider.onRefresh(
  async (userId, newTokenData) =>
    await fs.writeFile(
      `./tokens/tokens.${userId}.json`,
      JSON.stringify(newTokenData, null, 4),
      "UTF-8"
    )
);

await authProvider.addUserForToken(tokenData, ["chat"]);

(async () => {
  // Authenticating as a guest (use `.authenticateWithToken()` to use an account)
  await characterAI.authenticateWithToken(token);

  // Place your character's id here
  const characterId = "ql8RTLD8EmJNH4cDJr2n91RohXLo5_Aw0GMMCaZQeNg";

  chat = await characterAI.createOrContinueChat(characterId);

  console.log("connected to characet.ai");
})();

const bot = new Bot({
  authProvider,
  channels: ["iris_the_elf", "simplei_", "moonlit_viper"],
  commands: [
    createBotCommand("dice", (params, { reply }) => {
      const diceRoll = Math.floor(Math.random() * 6) + 1;
      reply(`You rolled a ${diceRoll}`);
    }),
    createBotCommand("slap", (params, { userName, say }) => {
      say(
        `${userName} slaps ${params.join(" ")} around a bit with a large trout`
      );
    }),
    createBotCommand("Q", (params, { userName, reply }) => {
      if (params.length == 0) return;
      GPT(params.join(" "), userName, reply);
    }),

    createBotCommand("wled", (params, { reply }) => {
      switch (params[0]) {
        case "help":
          reply(
            "Commands: on, off, effects list, effects random, effects set <id>, colors list, colors random, colors set <id>"
          );
          break;
        case "on":
          reply("Turning on the lights");
          WLEDApiCall({ seg: [{ id: 0, on: true }] });
          break;
        case "off":
          reply("Turning off the lights");
          WLEDApiCall({ seg: [{ id: 0, on: false }] });
          break;
        case "effects":
          if (params[1] == "list") {
            reply(
              "https://github.com/Aircoookie/WLED/wiki/List-of-effects-and-palettes#effects"
            );
          } else if (params[1] == "random") {
            reply("Setting random effect");
            WLEDApiCall({ seg: [{ id: 0, fx: "r" }] });
          } else if (params[1] == "set") {
            reply("Setting effect as ID: " + params[2]);
            WLEDApiCall({ seg: [{ id: 0, fx: params[2] }] });
          } else {
            reply("Unknown command, do !wled help for commands");
          }
          break;
        case "colors":
          if (params[1] == "list") {
            reply(
              "https://github.com/Aircoookie/WLED/wiki/List-of-effects-and-palettes#palettes"
            );
          } else if (params[1] == "random") {
            reply("Setting random color");
            WLEDApiCall({ seg: [{ id: 0, pal: "r" }] });
          } else if (params[1] == "set") {
            reply("Setting color as ID: " + params[2]);
            WLEDApiCall({ seg: [{ id: 0, pal: params[2] }] });
          } else {
            reply("Unknown command, do !wled help for commands");
          }
          break;
        default:
          reply("Unknown command, do !wled help for commands");
          break;
      }
    }),
  ],
});

bot.onConnect(() => {
  console.log("Bot running!");
});

bot.onSub(({ userName }) => {
  bot.say(`Thanks to @${userName} for subscribing to the channel!`);
});
bot.onResub(({ userName, months }) => {
  bot.say(
    `Thanks to @${userName} for subscribing to the channel for a total of ${months} months!`
  );
});
bot.onSubGift(({ gifterName, userName }) => {
  bot.say(
    `Thanks to @${gifterName} for gifting a subscription to @${userName}!`
  );
});
bot.onGiftPaidUpgrade(({ userName, gifterName }) => {
  bot.say(
    `Thanks to @${userName} for continuing the gifted sub they got from @${gifterName}!`
  );
});
bot.onRaid(({ displayName, viewers }) => {
  bot.say(`Thanks to @${displayName} for the raid of ${viewers}!`);
});

bot.on("connection", (socket) => {
  socket.emit("isTTSEnabled", isTTSEnabled);
  socket.emit("isFilterEnabled", isFilterEnabled);
  socket.emit("SwearWords", swearWords);
  console.log("A user connected");
  bot.onMessage(({ userDisplayName, text }) => {
    console.log(text);
    if (text == lastAddedMessage || userDisplayName == "StreamElements") {
      return;
    }
    lastAddedMessage = text;

    console.log(`${userDisplayName}: ${text} `);
    if (isTTSEnabled) {
      // Apply swear word filter if enabled
      if (isFilterEnabled) {
        // Replace swear words in the message
        text = filterSwearWords(text);
      }
      let formattedMessage = "";
      // Display the latest Twitch message
      if (toggleState === "option1") {
        formattedMessage = text;
      } else if (toggleState === "option2") {
        formattedMessage = `${userDisplayName}: ${text}`;
      } else if (toggleState === "option3") {
        if (pplToAddress.includes(userDisplayName)) {
          formattedMessage = `${userDisplayName}: ${text}`;
        } else {
          formattedMessage = text;
        }
      }

      // Display the latest Twitch message
      io.emit("twitchMessage", { message: formattedMessage });

      // Add the message to the queue
      messageQueue.push(formattedMessage);

      // Update the message queue and emit it to clients
      io.emit("messageQueue", messageQueue);

      // Speak the messages in the queue
      speakNextMessage();
    }
  });
  // Listen for TTS cancelation
  socket.on("cancelTTS", () => {
    stopSpeaking();
  });

  // Listen for TTS request
  socket.on("speakMessage", (message) => {
    // Add the TTS message to the queue
    messageQueue.push(message);

    // Update the message queue and emit it to clients
    io.emit("messageQueue", messageQueue);

    // Speak the messages in the queue
    speakNextMessage();
  });

  // Listen for skip TTS event
  socket.on("skipTTS", () => {
    // Stop the currently spoken message
    stopSpeaking();
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  // Handle disconnect
  socket.on("clearQueue", () => {
    messageQueue.length = 0;

    // Update the message queue and emit it to clients
    io.emit("messageQueue", messageQueue);
  });
  socket.on("toggleDropdown", (data) => {
    toggleState = data;
    console.log(toggleState);
  });

  socket.on("updateSwearWords", (data) => {
    const dataString = data.toString();

    if (dataString === "") {
      swearWords = [];
      console.log("Swear words cleared");
      return;
    }

    swearWords = dataString.split(", ");

    console.log(swearWords);
  });

  socket.on("voiceSelect", (data) => {
    voiceSelected = data;
    console.log(data);
  });

  say.getInstalledVoices((err, voices) => {
    socket.emit("Voices", voices);
  });
});

function stopSpeaking() {
  say.stop();
  isSpeaking = false;
  currentlySpokenMessage = ""; // Clear the currently spoken message
  io.emit("currentlySpoken", currentlySpokenMessage); // Inform clients that there is no currently spoken message
}

let spokenMessages = new Set();

// Function to speak the next message in the queue
function speakNextMessage() {
  // Check if already speaking or if the queue is empty
  if (isSpeaking || messageQueue.length === 0) {
    return;
  }

  isSpeaking = true;

  // Check if the next message is the same as the currently spoken message or if it's already spoken
  while (
    messageQueue.length > 0 &&
    (messageQueue[0] === currentlySpokenMessage ||
      spokenMessages.has(messageQueue[0]))
  ) {
    const skippedMessage = messageQueue.shift();
    console.log("Skipped duplicate or already spoken message:", skippedMessage);
  }

  // Check if the queue is now empty
  if (messageQueue.length === 0) {
    isSpeaking = false;
    return;
  }

  // At this point, the next message in the queue is different from the currently spoken message
  const nextMessage = messageQueue.shift();

  // Add the message to the set of spoken messages
  spokenMessages.add(nextMessage);

  // Update the currently spoken text
  currentlySpokenMessage = nextMessage;
  io.emit("currentlySpoken", currentlySpokenMessage);

  // Speak the message with additional parameters
  say.speak(nextMessage, voiceSelected, 1, () => {
    // Callback when speech is finished
    isSpeaking = false;

    // Clear the currently spoken message when speech is finished
    currentlySpokenMessage = "";
    io.emit("currentlySpoken", currentlySpokenMessage);

    // Remove the message from the set of spoken messages
    spokenMessages.delete(nextMessage);

    // Update the message queue and emit it to clients
    io.emit("messageQueue", messageQueue);

    // Attempt to speak the next message
    speakNextMessage();
  });
}

// Function to replace swear words in a message
function filterSwearWords(message) {
  // swearWords.forEach((swearWord) => {
  //   const regex = new RegExp(swearWord, "ig");
  //   message = message.replace(regex, "filtered");
  // });
  for (let swearWord of swearWords) {
    let regex = new RegExp("\\b" + swearWord + "\\b", "ig");
    message = message.replace(regex, "filtered");
  }
  return message;
}

async function GPT(questionText, usernameText, reply) {
  let messageText;

  console.log(usernameText + " asks " + questionText);

  // let message = `${usernameText} asks ${questionText}`;
  let message = `(OOC: This message was sent by ${usernameText} - context is that multiple people are using you to chat in a chat room using your api, just reply with {"status":"OK"} in OOC format - if received correctly - answer the message)\n\n\n\n ${questionText}`;

  // Send a message
  const response = await chat.sendAndAwaitResponse(message, true);

  console.log(response.text);
  const match = /"message":"([^"]*)"?/.exec(response.text);
  if (match) {
    let temp = response.text
      .split('"message":')[1]
      .split("}")[0]
      .trim()
      .replace(/"/g, "");
    messageText = addNewlines(temp);
  } else {
    messageText = addNewlines(response.text);
  }

  messageQueue.push(usernameText + " asks " + questionText);
  messageQueue.push(messageText);
  io.emit("messageQueue", messageQueue);
  if (!isSpeaking) speakNextMessage();
  reply(messageText);

  // Use `response.text` to use it as a string

  // const process = spawn("python", ["./gpt.py", questionText]);

  // process.stdout.on("data", (data) => {
  //   if (data.includes("speak: ")) {
  //     messageQueue.push(usernameText + " asks " + questionText);

  //     // Find the index of "speak:"
  //     const indexSpeak = data.toString().indexOf("speak:");

  //     // Extract the text after "speak:"
  //     const textAfterSpeak = data
  //       .toString()
  //       .slice(indexSpeak + "speak:".length)
  //       .trim();
  //     console.log(textAfterSpeak);

  //     let fixedText = addNewlines(textAfterSpeak);
  //     messageQueue.push(fixedText);
  //     io.emit("messageQueue", messageQueue);
  //     if (!isSpeaking) speakNextMessage();
  //     reply(fixedText);
  //   }
  // });
}

function addNewlines(text) {
  // Replace all occurrences of '\n' with '  '
  return text.replace(/(.+)/g, "$1  ");
}

// Toggle TTS status
app.post("/toggleTTS", (req, res) => {
  // Toggle the TTS status
  isTTSEnabled = !isTTSEnabled;
  console.log(`TTS is now ${isTTSEnabled ? "enabled" : "disabled"}`);
  // Send a response back to the client with the updated status
  res.send(`TTS is now ${isTTSEnabled ? "enabled" : "disabled"}`);
});
app.post("/toggleFiltering", (req, res) => {
  // Toggle the TTS status
  isFilterEnabled = !isFilterEnabled;
  console.log(`Filtering is now ${isFilterEnabled ? "enabled" : "disabled"}`);
  // Send a response back to the client with the updated status
  res.send(`Filtering is now ${isFilterEnabled ? "enabled" : "disabled"}`);
});

// Serve static files
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  //open(`http://localhost:${PORT}`);
});

function WLEDApiCall(action) {
  console.log(action);

  const url = "http://{ur wled ip}/json";

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Request successful");
      console.log(data);
    })
    .catch((error) => {
      console.error("Request failed", error);
    });
}
