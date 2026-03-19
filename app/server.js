const express = require('express')
const db = require('./db')
const jwt = require('jsonwebtoken')
const bcr = require('bcryptjs')

const app = express()
const SECRET = process.env.SECRET || 'my-secret-key'

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

app.use(express.json()) // разбираем JSON из тела запроса

app.post('/users', (req, res) => {
    try {
        // 1. Извлекаем данные из тела запроса
        const { login, password } = req.body

        // 2. Валидируем обязательные поля
        if (!login || !password) {
            return res.status(400).json({ error: 'Not all necessary data provided' })
        }

        // 3. Вставляем в базу
        const info = db.prepare(
            'INSERT INTO users (login, password) VALUES (?, ?)'
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

app.get('/users/all', (req, res) => {
    try {
        // 1. Извлекаем данные из тела запроса
        const { login, password } = req.body

        // 2. Валидируем обязательные поля
        if (!login || !password) {
            return res.status(400).json({ error: 'Not all necessary data provided' })
        }

        // 3. Получаем
        const users = db.prepare(
            'SELECT * FROM users'
        ).all() // все пользователи

        // 5. Возвращаем ответ
        return res.status(201).json(users)

    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Unexpected error occured' })
    }
})

app.delete('/users', (req, res) => {
    try {
        // 1. Извлекаем данные из тела запроса
        const { id } = req.params.id

        // 2. Валидируем обязательные поля
        if (!id) {
            return res.status(400).json({ error: 'Not all necessary data provided' })
        }

        // 3. Вставляем в базу
        const query = db.prepare(
            'DELETE FROM users WHERE id=?'
        ).run(id) // req.user.id берётся из токена

        return res.status(201).json(query)

    } catch (err) {
        console.error(err)
        return res.status(500).json({ error: 'Unexpected error occured' })
    }
})

app.put('/users', (req, res) => {
    try {
        // 1. Извлекаем данные из тела запроса
        const { login, password } = req.body

        // 2. Валидируем обязательные поля
        if (!login || !password) {
            return res.status(400).json({ error: 'Not all necessary data provided' })
        }

        // 3. Вставляем в базу
        const info = db.prepare(
            'INSERT INTO users (login, password) VALUES (?, ?)'
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

app.listen(3000, () => {
    console.log('Server is running on port 3000')
})

// const statusMessages = {
//     // 1xx Informational
//     100: 'Continue - Client should continue request',
//     101: 'Switching Protocols - Server switching protocol',
    
//     // 2xx Success
//     200: 'OK - Request successful',
//     201: 'Created - Resource created successfully',
//     202: 'Accepted - Request accepted for processing',
//     204: 'No Content - Success, no response body',
    
//     // 3xx Redirection
//     301: 'Moved Permanently - Resource permanently moved',
//     302: 'Found - Resource temporarily moved',
//     304: 'Not Modified - Resource not changed',
    
//     // 4xx Client Error
//     400: 'Bad Request - Invalid request syntax',
//     401: 'Unauthorized - Authentication required',
//     403: 'Forbidden - Access denied',
//     404: 'Not Found - Resource not found',
//     405: 'Method Not Allowed - HTTP method not supported',
//     409: 'Conflict - Request conflicts with state',
//     422: 'Unprocessable Entity - Validation failed',
    
//     // 5xx Server Error
//     500: 'Internal Server Error - Server failed to process',
//     502: 'Bad Gateway - Invalid upstream response',
//     503: 'Service Unavailable - Server temporarily down',
//     504: 'Gateway Timeout - Upstream timeout'
// };

// const createMessage = (req) => {
//     req.code = createCode(req)
//     const message = {
//         code:`Code is ${req.code}`,
//         method:`Method is ${req.method}`,
//         desc: `Description ${statusMessages[req.code] || "idk"}`,
//         params:`Other params ${req.query}`,
//     } 
//     return message
// }

// const createCode = (req) => {
//     let code = parseInt(req.query.code) || 200
//     return code
// }

// const middleWareFun = (req, res, next) => {
//     try {
//        req.code = createCode(req)
//        console.log(req.code);
       
//        req.message = createMessage(req)
//        next()
//     } catch (error) {
//         console.log("fuck! " + error);
//         console.log(typeof req.query);
        
//     }
// }

// app.use(express.json())
// app.use(middleWareFun)
// app.all('/', middleWareFun, (req, res) => {
//     return res.status(req.code).json(req.message)
// })