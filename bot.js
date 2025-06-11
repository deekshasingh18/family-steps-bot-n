// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { logSteps, getUserStats, getLeaderboard } = require('./db');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// /register command (optional since DB doesn't need it, but gives intro message)
bot.onText(/\/register/, (msg) => {
    const name = msg.from.first_name || 'User';
    bot.sendMessage(msg.chat.id, `🎉 Welcome ${name}! You're now registered. Use /steps <number> to log your steps.`);
});

// /steps <number>
bot.onText(/\/steps (\d+)/, (msg, match) => {
    const steps = parseInt(match[1]);
    const userId = msg.from.id.toString();
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    logSteps(userId, date, steps, (err) => {
        if (err) {
            console.error(err);
            bot.sendMessage(msg.chat.id, '❌ Error saving steps.');
        } else {
            bot.sendMessage(msg.chat.id, `✅ Logged ${steps} steps for today!`);
        }
    });
});

// /mystats
bot.onText(/\/mystats/, (msg) => {
    const userId = msg.from.id.toString();
    const name = msg.from.first_name || 'User';

    getUserStats(userId, (err, stats) => {
        if (err) {
            console.error(err);
            bot.sendMessage(msg.chat.id, '❌ Could not retrieve your stats.');
            return;
        }

        const message = `📊 *Your Stats - ${name}*\n\n` +
            `👟 Today: ${stats.daily}\n` +
            `📅 This Week: ${stats.weekly}\n` +
            `📆 This Month: ${stats.monthly}\n` +
            `🏆 Total Steps: ${stats.total}\n` +
            `📈 Daily Avg: ${stats.avgDaily} steps`;

        bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    });
});

// /daily leaderboard
bot.onText(/\/daily/, (msg) => {
    getLeaderboard('daily', (err, rows) => {
        if (err) {
            console.error(err);
            bot.sendMessage(msg.chat.id, '❌ Failed to fetch leaderboard.');
            return;
        }

        let text = `🏆 *DAILY LEADERBOARD*\n\n`;
        if (rows.length === 0) {
            text += 'No data yet!';
        } else {
            rows.forEach((row, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏃';
                text += `${medal} *${i + 1}.* User ${row.user_id} - ${row.sum_steps} steps\n`;
            });
        }

        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });
});

// /weekly leaderboard
bot.onText(/\/weekly/, (msg) => {
    getLeaderboard('weekly', (err, rows) => {
        if (err) {
            console.error(err);
            bot.sendMessage(msg.chat.id, '❌ Failed to fetch leaderboard.');
            return;
        }

        let text = `🏆 *WEEKLY LEADERBOARD*\n\n`;
        if (rows.length === 0) {
            text += 'No data yet!';
        } else {
            rows.forEach((row, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏃';
                text += `${medal} *${i + 1}.* User ${row.user_id} - ${row.sum_steps} steps\n`;
            });
        }

        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });
});

// /monthly leaderboard
bot.onText(/\/monthly/, (msg) => {
    getLeaderboard('monthly', (err, rows) => {
        if (err) {
            console.error(err);
            bot.sendMessage(msg.chat.id, '❌ Failed to fetch leaderboard.');
            return;
        }

        let text = `🏆 *MONTHLY LEADERBOARD*\n\n`;
        if (rows.length === 0) {
            text += 'No data yet!';
        } else {
            rows.forEach((row, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏃';
                text += `${medal} *${i + 1}.* User ${row.user_id} - ${row.sum_steps} steps\n`;
            });
        }

        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });
});

// /help
bot.onText(/\/help/, (msg) => {
    const helpText = `🤖 *FAMILY STEPS TRACKER BOT* 🤖\n\n` +
        `*Commands:*\n` +
        `/register - Join the challenge\n` +
        `/steps <number> - Log your steps\n` +
        `/mystats - View your stats\n` +
        `/daily - Daily leaderboard\n` +
        `/weekly - Weekly leaderboard\n` +
        `/monthly - Monthly leaderboard\n` +
        `/help - Show this help message`;

    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});
