const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('steps.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_steps (
    user_id TEXT,
    date TEXT,
    steps INTEGER,
    PRIMARY KEY(user_id, date)
  )`);
});

// Add user on registration
function registerUser(userId, callback) {
  db.run(`INSERT OR IGNORE INTO users (user_id) VALUES (?)`, [userId], callback);
}

// Check if user is registered
function isRegistered(userId, callback) {
  db.get(`SELECT 1 FROM users WHERE user_id = ?`, [userId], (err, row) => {
    if (err) return callback(err);
    callback(null, !!row);
  });
}

function logSteps(userId, dateStr, steps, callback) {
  db.run(`
    INSERT INTO user_steps (user_id, date, steps) VALUES (?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET steps = excluded.steps
  `, [userId, dateStr, steps], callback);
}

function getUserStats(userId, callback) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  db.all(`
    SELECT date, steps FROM user_steps WHERE user_id = ?
  `, [userId], (err, rows) => {
    if (err) return callback(err);
    let daily = 0, weekly = 0, monthly = 0, total = 0, activeDays = rows.length;
    rows.forEach(r => {
      total += r.steps;
      if (r.date === today) daily = r.steps;
      if (r.date >= weekStartStr) weekly += r.steps;
      if (r.date >= monthStartStr) monthly += r.steps;
    });
    const avgDaily = activeDays ? Math.round(total / activeDays) : 0;
    callback(null, { daily, weekly, monthly, total, avgDaily, activeDays });
  });
}

function getLeaderboard(period, callback) {
  const sql = {
    daily: `date = date('now')`,
    weekly: `date >= date('now','weekday 1','-6 days')`,
    monthly: `date >= date('now','start of month')`
  }[period];

  db.all(`
    SELECT user_id, SUM(steps) AS sum_steps
    FROM user_steps WHERE ${sql}
    GROUP BY user_id
    ORDER BY sum_steps DESC LIMIT 10
  `, [], callback);
}

function resetSteps(userId, dateStr, callback) {
  db.run(`
    INSERT INTO user_steps (user_id, date, steps) VALUES (?, ?, 0)
    ON CONFLICT(user_id, date) DO UPDATE SET steps = 0
  `, [userId, dateStr], callback);
}

function deleteUser(userId, callback) {
  db.serialize(() => {
    db.run(`DELETE FROM user_steps WHERE user_id = ?`, [userId]);
    db.run(`DELETE FROM users WHERE user_id = ?`, [userId], callback);
  });
}

module.exports = {
  registerUser,
  isRegistered,
  logSteps,
  getUserStats,
  getLeaderboard,
  resetSteps,
  deleteUser
};
