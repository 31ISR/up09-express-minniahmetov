const Database = require('better-sqlite3')

const db = new Database('database.db') // создаёт файл автоматически

// Создаём таблицы при первом запуске
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        createdBy INTEGER,
        FOREIGN KEY (createdBy) REFERENCES users(id)
    );
`)

module.exports = db