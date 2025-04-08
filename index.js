// index.js (всё в одном файле)
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const cron = require("node-cron");

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const userChatIds = new Set();

const AQI_LEVELS = [
    { max: 50, emoji: "🟢", status: "Хорошо" },
    { max: 100, emoji: "🟡", status: "Удовлетворительно" },
    { max: 150, emoji: "🟠", status: "Вредно для чувствительных" },
    { max: 200, emoji: "🔴", status: "Вредно" },
    { max: 300, emoji: "🟣", status: "Очень вредно" },
    { max: 500, emoji: "🟤", status: "Опасно" },
];

async function getAirQualityMessage() {
    try {
        const response = await axios.get("https://api.airvisual.com/v2/city", {
            params: {
                city: "Almaty",
                state: "Almaty Qalasy",
                country: "Kazakhstan",
                key: process.env.IQAIR_API_KEY,
            },
        });

        const aqi = response.data.data.current.pollution.aqius;
        const level = AQI_LEVELS.find((l) => aqi <= l.max);

        return `🌫 AQI в Алматы: ${aqi}\n${level.emoji} ${level.status}\n${getAdvice(aqi)}`;
    } catch (error) {
        if (error.response) {
            console.error("Ошибка от API:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Ошибка при получении AQI:", error.message);
        }
        return "❌ Не удалось получить данные о воздухе.";
    }
}

function getAdvice(aqi) {
    if (aqi <= 50) return "Воздух чистый, гуляй спокойно.";
    if (aqi <= 100) return "Можно гулять, но лучше избегать интенсивных нагрузок.";
    if (aqi <= 150) return "Ограничь активность на улице, особенно детям и астматикам.";
    if (aqi <= 200) return "Лучше остаться в помещении. Используй маску, если выходишь.";
    return "⚠️ Очень вредный воздух. Не выходи без необходимости.";
}

const aqiKeyboard = {
    reply_markup: {
        inline_keyboard: [[
            { text: "📍 Узнать качество воздуха сейчас", callback_data: "get_aqi_now" }
        ]],
    },
};

bot.onText(/\/start/, async (msg) => {
    userChatIds.add(msg.chat.id);
    bot.sendMessage(
        msg.chat.id,
        "👋 Привет! Я буду присылать качество воздуха в Алматы каждый день в 08:00 и 20:00.",
        aqiKeyboard
    );
});

bot.onText(/\/aqi/, async (msg) => {
    const message = await getAirQualityMessage();
    bot.sendMessage(msg.chat.id, message, aqiKeyboard);
});

bot.on("callback_query", async (query) => {
    if (query.data === "get_aqi_now") {
        const message = await getAirQualityMessage();
        bot.sendMessage(query.message.chat.id, message, aqiKeyboard);
    }
});

cron.schedule("0 8,20 * * *", async () => {
    const message = await getAirQualityMessage();
    for (const chatId of userChatIds) {
        bot.sendMessage(chatId, message);
    }
});
