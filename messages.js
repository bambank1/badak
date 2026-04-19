const MESSAGES = [
"Halo kak 😊",
"Hai kak 🙏",
"Halo kak ✨",
"Hai kak 😄",
"Halo kak 💬",
"Halo kak 👋"
];

function randomMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

module.exports = { randomMessage };
