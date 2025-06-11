require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// In-memory storage
const familyMembers = new Map();
const stepsData = new Map();

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function updateWeeklyMonthlyData(userId, steps, dateStr) {
    const date = new Date(dateStr);
    const userData = stepsData.get(userId);

    const weekStart = getWeekStart(date).toDateString();
    let weekEntry = userData.weekly.find(e => e.week === weekStart);
    if (!weekEntry) {
        weekEntry = { week: weekStart, steps: 0 };
        userData.weekly.push(weekEntry);
    }

    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    let monthEntry = userData.monthly.find(e => e.month === monthKey);
    if (!monthEntry) {
        monthEntry = {
            month: monthKey,
            steps: 0,
            monthName: date.toLocaleDateString('en', { month: 'long', year: 'numeric' })
        };
        userData.monthly.push(monthEntry);
    }

    weekEntry.steps = userData.daily
        .filter(e => getWeekStart(new Date(e.date)).toDateString() === weekStart)
        .reduce((sum, e) => sum + e.steps, 0);

    monthEntry.steps = userData.daily
        .filter(e => `${new Date(e.date).getFullYear()}-${new Date(e.date).getMonth()}` === monthKey)
        .reduce((sum, e) => sum + e.steps, 0);
}

function showLeaderboard(chatId, type) {
    const today = new Date().toDateString();
    const weekStart = getWeekStart(new Date()).toDateString();
    const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;

    const rankings = [];

    for (const [userId, userData] of stepsData.entries()) {
        const member = familyMembers.get(userId);
        let entry = null;

        if (type === 'daily') {
            entry = userData.daily.find(e => e.date === today);
        } else if (type === 'weekly') {
            entry = userData.weekly.find(e => e.week === weekStart);
        } else {
            entry = userData.monthly.find(e => e.month === monthKey);
        }

        if (entry && entry.steps > 0) {
            rankings.push({ name: member.name, steps: entry.steps });
        }
    }

    rankings.sort((a, b) => b.steps - a.steps);
    let title = type === 'daily' ? 'DAILY' : type === 'weekly' ? 'WEEKLY' : 'MONTHLY';
    let msg = `🏆 *${title} LEADERBOARD* 🏆\n\n`;

    if (rankings.length === 0) {
        msg += 'No steps logged yet!';
    } else {
        rankings.forEach((e, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏃';
            msg += `${medal} *${i + 1}.* ${e.name} - ${e.steps.toLocaleString()} steps\n`;
        });
    }

    bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
}

// ==================== Commands ====================

bot.onText(/\/register/, (msg) => {
    const id = msg.from.id;
    const name = msg.from.first_name || 'User';

    familyMembers.set(id, { name, joinDate: new Date(), totalSteps: 0 });
    stepsData.set(id, { daily: [], weekly: [], monthly: [] });

    bot.sendMessage(msg.chat.id, `🎉 Welcome ${name}! You're now registered. Use /steps <number> to log steps.`);
});

bot.onText(/\/steps (\d+)/, (msg, match) => {
    const id = msg.from.id;
    const steps = parseInt(match[1]);
    const name = msg.from.first_name || 'User';

    // ✅ Check registration
    if (!familyMembers.has(id)) {
        bot.sendMessage(msg.chat.id, '❌ Please register first using /register');
        return;
    }

    const today = new Date().toDateString();
    const data = stepsData.get(id);
    const existing = data.daily.find(e => e.date === today);

    if (existing) {
        existing.steps = steps;
        bot.sendMessage(msg.chat.id, `✅ Updated your steps for today: ${steps} steps.`);
    } else {
        data.daily.push({ date: today, steps });
        bot.sendMessage(msg.chat.id, `✅ Logged ${steps} steps for today!`);
    }

    updateWeeklyMonthlyData(id, steps, today);
    familyMembers.get(id).totalSteps = data.daily.reduce((sum, e) => sum + e.steps, 0);
});

bot.onText(/\/daily/, msg => showLeaderboard(msg.chat.id, 'daily'));
bot.onText(/\/weekly/, msg => showLeaderboard(msg.chat.id, 'weekly'));
bot.onText(/\/monthly/, msg => showLeaderboard(msg.chat.id, 'monthly'));

bot.onText(/\/mystats/, msg => {
    const id = msg.from.id;
    const name = msg.from.first_name || 'User';

    if (!familyMembers.has(id)) {
        bot.sendMessage(msg.chat.id, '❌ Please register first using /register');
        return;
    }

    const data = stepsData.get(id);
    const today = new Date().toDateString();
    const weekStart = getWeekStart(new Date()).toDateString();
    const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;

    const todaySteps = data.daily.find(e => e.date === today)?.steps || 0;
    const weekSteps = data.weekly.find(e => e.week === weekStart)?.steps || 0;
    const monthSteps = data.monthly.find(e => e.month === monthKey)?.steps || 0;
    const total = familyMembers.get(id).totalSteps;
    const avg = data.daily.length > 0 ? Math.round(total / data.daily.length) : 0;

    const msgText = `📊 *Your Stats - ${name}*\n\n` +
        `👟 Today: ${todaySteps}\n` +
        `📅 This Week: ${weekSteps}\n` +
        `📆 This Month: ${monthSteps}\n` +
        `🏆 Total Steps: ${total}\n` +
        `📈 Daily Avg: ${avg} steps`;

    bot.sendMessage(msg.chat.id, msgText, { parse_mode: 'Markdown' });
});

bot.onText(/\/reset/, msg => {
    const id = msg.from.id;
    if (!familyMembers.has(id)) {
        bot.sendMessage(msg.chat.id, '❌ You are not registered.');
        return;
    }
    stepsData.set(id, { daily: [], weekly: [], monthly: [] });
    familyMembers.get(id).totalSteps = 0;
    bot.sendMessage(msg.chat.id, '✅ Your step data has been reset!');
});

bot.onText(/\/help/, msg => {
    const helpText = `🤖 *FAMILY STEPS TRACKER BOT* 🤖\n\n` +
        `*Commands:*\n` +
        `/register - Join the challenge\n` +
        `/steps <number> - Log daily steps\n` +
        `/daily - Daily rankings\n` +
        `/weekly - Weekly leaderboard\n` +
        `/monthly - Monthly leaderboard\n` +
        `/mystats - View your stats\n` +
        `/reset - Reset your data\n` +
        `/help - Show this help message`;

    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});
