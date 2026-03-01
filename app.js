const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;
async function initDB() {
    db = await open({ filename: './database.db', driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT);
        CREATE TABLE IF NOT EXISTS sensors (id INTEGER PRIMARY KEY AUTOINCREMENT, temp REAL, humi REAL, time TEXT);
    `);
    const admin = await db.get('SELECT * FROM users WHERE username = "admin"');
    if (!admin) await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', '123', 'admin']);
}
initDB();

// --- API สำหรับดึงข้อมูลส่วนตัว ---
app.get('/api/me', async (req, res) => {
    const username = req.query.username;
    const user = await db.get('SELECT id, username, password FROM users WHERE username = ?', [username]);
    if (user) res.json(user);
    else res.status(404).json({ error: 'ไม่พบผู้ใช้' });
});

// --- API สำหรับแก้ไขข้อมูลตัวเอง ---
app.put('/api/users/update', async (req, res) => {
    const { oldUsername, newUsername, newPassword } = req.body;
    try {
        await db.run('UPDATE users SET username = ?, password = ? WHERE username = ?', [newUsername, newPassword, oldUsername]);
        res.json({ status: 'ok', message: 'อัปเดตข้อมูลสำเร็จ!' });
    } catch (e) {
        res.status(400).json({ status: 'error', message: 'ชื่อผู้ใช้นี้อาจถูกใช้ไปแล้ว' });
    }
});

// (API Login, Register, Sensors อื่นๆ คงเดิมตามเวอร์ชันก่อนหน้า)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (user) res.json({ status: 'ok', role: user.role, user: user.username });
    else res.status(401).json({ status: 'error' });
});

// API สำหรับแก้ไขข้อมูลตัวเอง
app.put('/api/users/update', async (req, res) => {
    const { oldUsername, newUsername, newPassword } = req.body;
    try {
        // อัปเดตข้อมูลใน Database
        await db.run('UPDATE users SET username = ?, password = ? WHERE username = ?', [newUsername, newPassword, oldUsername]);
        console.log(`✅ อัปเดต User: ${oldUsername} เป็น ${newUsername} สำเร็จ`);
        res.json({ status: 'ok' });
    } catch (e) {
        console.error('🔥 Update Error:', e);
        res.status(400).json({ status: 'error', message: 'ชื่อผู้ใช้นี้อาจมีคนใช้แล้ว' });
    }
});

// API สำหรับดึงข้อมูลเดิมมาโชว์ในช่อง Input
app.get('/api/me', async (req, res) => {
    const user = await db.get('SELECT username, password FROM users WHERE username = ?', [req.query.username]);
    if (user) res.json(user);
    else res.status(404).send();
});
app.get('/api/sensors', async (req, res) => {
    const logs = await db.all('SELECT * FROM sensors ORDER BY id DESC LIMIT 20');
    const stats = await db.get('SELECT MAX(temp) as maxT, MIN(temp) as minT, AVG(temp) as avgT FROM (SELECT temp FROM sensors ORDER BY id DESC LIMIT 20)');
    res.json({ logs, stats });
});

const PORT = process.env.PORT || 3000;

// บรรทัดนี้จะทำให้เวลาเข้าลิงก์หลัก แล้วมันจะเด้งไปหน้า login ทันที
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});