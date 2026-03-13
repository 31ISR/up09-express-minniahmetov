# 🚀 Памятка: Backend на Express.js

Краткое руководство по написанию REST API на Node.js + Express.

---

## 1. Инициализация проекта

```bash
mkdir my-service && cd my-service
npm init -y
npm install express better-sqlite3 bcryptjs jsonwebtoken
```

Структура файлов:
```
my-service/
├── server.js    # главный файл с роутами
├── db.js        # подключение к базе данных
└── package.json
```

---

## 2. Подключение к базе данных — `db.js`

Используем `better-sqlite3` — синхронная библиотека для SQLite. Не нужен `async/await` для запросов к БД.

```js
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
```

В `server.js` подключаем базу:
```js
const db = require('./db')
```

---

## 3. Базовая структура `server.js`

```js
const express = require('express')
const db = require('./db')
const jwt = require('jsonwebtoken')
const bcr = require('bcryptjs')

const app = express()
const SECRET = process.env.SECRET || 'my-secret-key'

app.use(express.json()) // разбираем JSON из тела запроса

// --- Роуты ---
app.get('/api/hello', (req, res) => {
    return res.status(200).json({ message: 'Hello, World!' })
})

app.listen(3000, () => {
    console.log('Server is running on port 3000')
})
```

---

## 4. Работа с базой данных (SQLite, синхронный стиль)

`better-sqlite3` работает **синхронно** — не нужен `async/await`. Роуты тоже пишутся без `async`.

### Основные методы

```js
// .get() — получить одну запись (или undefined если не найдено)
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)

// .all() — получить все записи (массив)
const users = db.prepare('SELECT * FROM users').all()

// .run() — INSERT, UPDATE, DELETE (возвращает метаданные)
const info = db.prepare('INSERT INTO users (name) VALUES (?)').run('Alice')
console.log(info.lastInsertRowid) // ID созданной записи
console.log(info.changes)         // количество затронутых строк

// .exec() — выполнить несколько SQL-запросов без параметров
db.exec('CREATE TABLE IF NOT EXISTS ...')
```

### Примеры запросов

```js
// Поиск по одному полю
const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)

// Поиск по нескольким полям (OR)
const user = db.prepare(
    'SELECT * FROM users WHERE username = ? OR email = ?'
).get(username, email)

// Вставка и получение созданной записи
const info = db.prepare(
    'INSERT INTO items (title, createdBy) VALUES (?, ?)'
).run(title, userId)
const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid)

// Динамическое обновление (только изменённые поля)
const columns = []
const values = []
if (req.body.title)  { columns.push('title = ?');  values.push(req.body.title) }
if (req.body.author) { columns.push('author = ?'); values.push(req.body.author) }

db.prepare(`UPDATE items SET ${columns.join(', ')} WHERE id = ?`).run(...values, id)
```

---

## 5. HTTP методы и роуты

### Анатомия роута

```js
app.METHOD('/path', handler)
//  ^^^^^^   ^^^^^   ^^^^^^^
//  метод    путь    функция-обработчик
```

### Основные методы

| Метод  | Назначение      | Пример пути      |
|--------|-----------------|------------------|
| GET    | Получить данные | `/api/items`     |
| POST   | Создать ресурс  | `/api/items`     |
| PUT    | Обновить ресурс | `/api/items/:id` |
| DELETE | Удалить ресурс  | `/api/items/:id` |

### Параметры в пути — `req.params`

```js
app.get('/api/items/:id', (req, res) => {
    const { id } = req.params
    // id — всегда строка, но SQLite сам приведёт тип при сравнении
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)
    return res.status(200).json(item)
})
```

### Query-параметры — `req.query`

```js
// GET /api/items?genre=fiction&author=Толстой
app.get('/api/items', (req, res) => {
    let query = 'SELECT * FROM items '
    let param

    if (req.query.genre && req.query.genre !== '') {
        query += 'WHERE genre = ?'
        param = req.query.genre
    } else if (req.query.author && req.query.author !== '') {
        query += 'WHERE author = ?'
        param = req.query.author
    }

    const data = param
        ? db.prepare(query).all(param)
        : db.prepare(query).all()

    return res.status(200).json(data)
})
```

### Тело запроса — `req.body`

```js
app.post('/api/items', (req, res) => {
    const { title, description } = req.body
    return res.status(200).json({ title, description })
})
```

---

## 6. Ответы сервера

### Коды статуса

| Код | Значение                               |
|-----|----------------------------------------|
| 200 | Успех (OK)                             |
| 201 | Создан (Created)                       |
| 400 | Ошибка клиента (Bad Request)           |
| 401 | Не авторизован (Unauthorized)          |
| 403 | Доступ запрещён (Forbidden)            |
| 404 | Не найдено (Not Found)                 |
| 500 | Ошибка сервера (Internal Server Error) |

### Отправка ответа

```js
return res.status(200).json({ message: 'OK' })
return res.status(201).json({ message: 'Created', item: newItem })
return res.status(400).json({ error: 'Bad request' })
return res.status(404).json({ error: 'Not found' })
```

> ⚠️ Всегда пиши `return` перед `res.json()` — иначе функция продолжит выполнение и возникнет ошибка "headers already sent".

---

## 7. Аутентификация — JWT + bcryptjs

### Хэширование пароля при регистрации

```js
const bcr = require('bcryptjs')

const salt = bcr.genSaltSync(10)
const hash = bcr.hashSync(password, salt)
// сохраняй hash в базу, никогда не храни пароль в открытом виде
```

### Проверка пароля при входе

```js
const valid = bcr.compareSync(plainPassword, hashedPassword)
// возвращает true/false
```

### Создание JWT токена

```js
const jwt = require('jsonwebtoken')
const SECRET = process.env.SECRET || 'my-secret-key'

// Кладём весь объект пользователя в токен (без пароля!)
const { password, ...userWithoutPassword } = user
const token = jwt.sign({ ...userWithoutPassword }, SECRET, { expiresIn: '24h' })
```

> ⚠️ Никогда не клади в токен пароль — исключай его деструктуризацией перед `jwt.sign()`.

### Middleware для проверки токена

```js
const auth = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No token given' })

    const token = authHeader.split(' ')[1] // "Bearer TOKEN" → "TOKEN"
    if (!token) return res.status(401).json({ error: 'Invalid token format' })

    try {
        const decoded = jwt.verify(token, SECRET)
        req.user = decoded // данные из токена теперь доступны в роуте как req.user
        next()
    } catch (error) {
        console.error(error)
        return res.status(500).json({ error: 'Token error occured' })
    }
}
```

### Использование middleware на роуте

```js
// Защищённый роут — передай auth вторым аргументом
app.get('/api/profile', auth, (req, res) => {
    const { password, exp, iat, ...resp } = req.user // убираем пароль и поля JWT
    return res.status(200).json(resp)
})
```

---

## 8. Роли пользователей

Роль хранится в таблице `users` и попадает в JWT токен. Проверяй её в роутах через `req.user.role`:

```js
// Только для администратора
app.get('/api/admin/users', auth, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not allowed' })
    }

    const users = db.prepare('SELECT * FROM users').all()
    return res.status(200).json(users)
})

// Для владельца ресурса ИЛИ администратора
app.delete('/api/items/:id', auth, (req, res) => {
    const { id } = req.params
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id)

    if (!item) return res.status(404).json({ error: 'Not found' })

    if (req.user.role !== 'admin' && item.createdBy !== req.user.id) {
        return res.status(403).json({ error: 'Not allowed' })
    }

    db.prepare('DELETE FROM items WHERE id = ?').run(id)
    return res.status(200).json({ message: 'Deleted successfully' })
})
```

При регистрации роль `'user'` задаётся вручную в коде — новые пользователи никогда не получают `'admin'` автоматически:

```js
const role = 'user'
db.prepare(
    'INSERT INTO users (username, email, password, role) VALUES (?,?,?,?)'
).run(username, email, hash, role)
```

---

## 9. Middleware

Middleware — функция между запросом и ответом. Принимает три аргумента: `req`, `res`, `next`.

```js
function myMiddleware(req, res, next) {
    // что-то делаем...
    next() // обязательно! иначе запрос зависнет навсегда
}

// Глобальное — применяется ко всем роутам (пиши ДО роутов)
app.use(myMiddleware)

// Для конкретного роута — передай как аргумент
app.get('/api/items', myMiddleware, (req, res) => { ... })
```

---

## 10. Обработка ошибок

Оборачивай роуты в `try/catch`. Так как запросы к БД синхронные, `try/catch` ловит и ошибки SQLite:

```js
app.post('/api/items', auth, (req, res) => {
    try {
        const { title } = req.body
        if (!title) return res.status(400).json({ error: 'Title is required' })

        const info = db.prepare('INSERT INTO items (title) VALUES (?)').run(title)
        const newItem = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid)

        return res.status(201).json({ message: 'Item created successfully', item: newItem })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Unexpected error occured' })
    }
})
```

---

## 11. Исключение полей из ответа

Никогда не возвращай пароль или служебные поля JWT. Используй деструктуризацию:

```js
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)

// Исключаем пароль из ответа клиенту
const { password, ...safeUser } = user
return res.status(200).json(safeUser)

// Исключаем пароль и поля JWT (exp — срок, iat — время выдачи) из req.user
const { password, exp, iat, ...resp } = req.user
return res.status(200).json(resp)
```

---

## 12. Полный пример роута (создание ресурса)

```js
app.post('/api/items', auth, (req, res) => {
    try {
        // 1. Извлекаем данные из тела запроса
        const { title, description } = req.body

        // 2. Валидируем обязательные поля
        if (!title || !description) {
            return res.status(400).json({ error: 'Not all necessary data provided' })
        }

        // 3. Вставляем в базу
        const info = db.prepare(
            'INSERT INTO items (title, description, createdBy) VALUES (?, ?, ?)'
        ).run(title, description, req.user.id) // req.user.id берётся из токена

        // 4. Получаем созданную запись по lastInsertRowid
        const newItem = db.prepare(
            'SELECT * FROM items WHERE id = ?'
        ).get(info.lastInsertRowid)

        // 5. Возвращаем ответ
        return res.status(201).json({ message: 'Item created successfully', item: newItem })

    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Unexpected error occured' })
    }
})
```

---

## 13. Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Cannot GET /api/items` | Роут не зарегистрирован | Проверь написание пути и HTTP метод |
| `req.body` is `undefined` | Нет `app.use(express.json())` | Добавь middleware до роутов |
| Сервер висит без ответа | Забыл `next()` в middleware | Всегда вызывай `next()` или `res.json()` |
| `headers already sent` | Нет `return` перед `res.json()` | Пиши `return res.status(...).json(...)` |
| Пароль хранится в открытом виде | Забыл хэшировать | Используй `bcr.hashSync()` перед сохранением |
| Пароль попал в ответ | Не исключил из объекта | `const { password, ...rest } = user` |
| Токен не работает | Разные `SECRET` при подписи и проверке | Храни секрет в одной константе или `.env` |
| Ошибка уникальности SQLite | Вставка дубликата | Проверяй через `.get()` перед вставкой |

---

## 14. Переменные окружения

Секретный ключ не хардкодится в коде — берётся из окружения, с фолбэком на дефолтное значение:

```js
const SECRET = process.env.SECRET || 'fallback-secret'
```

Создай файл `.env` в корне проекта:
```
SECRET=my-super-secret-key
PORT=3000
```

Для загрузки `.env` установи и подключи `dotenv`:
```bash
npm install dotenv
```
```js
require('dotenv').config() // первая строка в server.js
```

---

## 15. Запуск и тестирование

```bash
# Запуск сервера
node server.js

# Или с автоперезапуском при изменениях
npm install -g nodemon
nodemon server.js
```

### Тестирование через curl

```bash
# GET запрос
curl http://localhost:3000/api/items

# POST с телом
curl -X POST http://localhost:3000/api/items \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "description": "Hello"}'

# Запрос с токеном
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Или используй **Postman** / **Insomnia** — графические инструменты для тестирования API.
