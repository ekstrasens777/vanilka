const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8008;

// ==================== НАСТРОЙКА ====================
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ==================== БАЗА ДАННЫХ (PostgreSQL / Supabase) ====================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price INTEGER,
                category TEXT,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                total INTEGER NOT NULL,
                status TEXT DEFAULT 'new',
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                orders_count INTEGER DEFAULT 0,
                total_spent INTEGER DEFAULT 0,
                first_order TIMESTAMP,
                last_order TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Создаём дефолтного админа если нет
        const adminExists = await client.query("SELECT * FROM admins WHERE username = 'admin'");
        if (adminExists.rows.length === 0) {
            const adminPass = process.env.ADMIN_PASSWORD || 'vanilka2024';
            await client.query("INSERT INTO admins (username, password) VALUES ('admin', $1)", [adminPass]);
            console.log('👑 Создан администратор: admin / ' + adminPass);
        }

        // Тестовые товары если таблица пуста
        const countResult = await client.query("SELECT COUNT(*) as count FROM products");
        if (parseInt(countResult.rows[0].count) === 0) {
            const products = [
                ['Торт "Клубничная нежность"', 'Нежный ванильный бисквит с клубничным кремом', 2400, 'cake', 'tort_klubnichny.jpg'],
                ['Торт "Шоколадный рай"', 'Шоколадный бисквит с трюфельной начинкой', 2800, 'cake', 'tort_shokoladny.jpg'],
                ['Торт "Медовик"', 'Классический медовый торт со сметанным кремом', 2200, 'cake', 'tort_medovy.jpg'],
                ['Торт "Карандаш"', 'Оригинальный торт необычной формы', 3200, 'cake', 'tort_karandash.jpg'],
                ['Макаруны ассорти', 'Хрустящие миндальные пирожные', 180, 'macaron', 'makarun_assorti.jpg'],
                ['Макаруны фисташка', 'Нежные фисташковые макаруны', 200, 'macaron', 'makarun_fistashka.jpg'],
                ['Макаруны шоколад', 'Шоколадные макаруны с ганашем', 200, 'macaron', 'makarun_shokolad.jpg'],
                ['Макаруны ягоды', 'Ягодные макаруны с фруктовым кремом', 190, 'macaron', 'makarun_yagody.jpg'],
                ['Капкейк ванильный', 'Воздушные капкейки с ванильным кремом', 420, 'cupcake', 'kapkeik_vanil.jpg'],
                ['Капкейк шоколадный', 'Шоколадные капкейки с кремом', 450, 'cupcake', 'kapkeik_shokolad.jpg'],
                ['Капкейк красный бархат', 'Красный бархат с сырным кремом', 480, 'cupcake', 'kapkeik_krasny.jpg'],
                ['Капкейк кокос', 'Кокосовые капкейки с кремом', 430, 'cupcake', 'kapkeik_kokos.jpg'],
                ['Эклер шоколадный', 'Заварное пирожное с бельгийским шоколадом', 320, 'eclair', 'ekler_shokolad.jpg'],
                ['Эклер ванильный', 'Эклер с ванильным кремом', 290, 'eclair', 'ekler_vanil.jpg'],
                ['Эклер кофейный', 'Эклер с кофейным кремом', 330, 'eclair', 'ekler_kofe.jpg'],
                ['Эклер ягодный', 'Эклер с ягодным кремом', 310, 'eclair', 'ekler_yagoda.jpg'],
                ['Чизкейк Нью-Йорк', 'Классический чизкейк с ягодным соусом', 2100, 'cheesecake', 'chizkeik_nyu_york.jpg'],
                ['Чизкейк шоколадный', 'Шоколадный чизкейк', 2300, 'cheesecake', 'chizkeik_shokolad.jpg'],
                ['Чизкейк карамельный', 'Чизкейк с карамельным топпингом', 2200, 'cheesecake', 'chizkeik_karamel.jpg'],
                ['Чизкейк ягодный', 'Чизкейк с ягодным соусом', 2150, 'cheesecake', 'chizkeik_yagodny.jpg'],
            ];
            for (const p of products) {
                await client.query(
                    "INSERT INTO products (name, description, price, category, image_url) VALUES ($1, $2, $3, $4, $5)",
                    p
                );
            }
            console.log('🛒 Добавлены тестовые товары');
        }

        console.log('✅ База данных инициализирована');
    } finally {
        client.release();
    }
}

// ==================== API ====================

// 1. Товары
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM products ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Создать заказ
app.post('/api/orders', async (req, res) => {
    const { customer_name, customer_phone, customer_email, total, message } = req.body;

    if (!customer_name || !customer_phone || !customer_email) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const orderId = 'VAN-' + Date.now();
    const createdAt = new Date().toISOString();

    try {
        await pool.query(
            `INSERT INTO orders (id, customer_name, customer_phone, customer_email, total, message, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [orderId, customer_name, customer_phone, customer_email, total || 0, message, createdAt]
        );

        // Обновляем/создаём клиента
        const existing = await pool.query("SELECT * FROM customers WHERE email = $1", [customer_email]);
        if (existing.rows.length > 0) {
            await pool.query(
                `UPDATE customers SET orders_count = orders_count + 1,
                 total_spent = total_spent + $1, last_order = $2 WHERE email = $3`,
                [total || 0, createdAt, customer_email]
            );
        } else {
            await pool.query(
                `INSERT INTO customers (name, phone, email, orders_count, total_spent, first_order, last_order)
                 VALUES ($1, $2, $3, 1, $4, $5, $6)`,
                [customer_name, customer_phone, customer_email, total || 0, createdAt, createdAt]
            );
        }

        res.json({ success: true, orderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Все заказы
app.get('/api/orders', async (req, res) => {
    const { status } = req.query;
    try {
        let result;
        if (status && status !== 'all') {
            result = await pool.query("SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC", [status]);
        } else {
            result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
        }
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Обновить статус заказа
app.put('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['new', 'processing', 'completed', 'cancelled'];

    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
    }

    try {
        const result = await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Заказ не найден' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Все клиенты
app.get('/api/customers', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM customers ORDER BY last_order DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Авторизация
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM admins WHERE username = $1 AND password = $2",
            [username, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: { username: result.rows[0].username } });
        } else {
            res.status(401).json({ error: 'Неверные логин или пароль' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Статистика
app.get('/api/stats', async (req, res) => {
    try {
        const orderStats = await pool.query("SELECT COUNT(*) as total_orders, SUM(total) as total_revenue FROM orders");
        const custStats = await pool.query("SELECT COUNT(*) as total_customers FROM customers");
        const newOrders = await pool.query("SELECT COUNT(*) as new_orders FROM orders WHERE status = 'new'");
        res.json({
            total_orders: parseInt(orderStats.rows[0].total_orders) || 0,
            total_revenue: parseInt(orderStats.rows[0].total_revenue) || 0,
            total_customers: parseInt(custStats.rows[0].total_customers) || 0,
            new_orders: parseInt(newOrders.rows[0].new_orders) || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Экспорт CSV
app.get('/api/export/orders', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders ORDER BY created_at DESC");
        let csv = 'ID,Имя,Телефон,Email,Сумма,Статус,Дата\n';
        result.rows.forEach(o => {
            csv += `"${o.id}","${o.customer_name}","${o.customer_phone}","${o.customer_email}",${o.total},"${o.status}","${o.created_at}"\n`;
        });
        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.header('Content-Disposition', 'attachment; filename="orders_export.csv"');
        res.send('\uFEFF' + csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== СТАТИЧЕСКИЕ МАРШРУТЫ ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== ЗАПУСК ====================
initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log(`✅ Сервер запущен на порту ${PORT}`);
            console.log(`🌐 Сайт:    http://localhost:${PORT}/`);
            console.log(`🔧 Админка: http://localhost:${PORT}/admin.html`);
            console.log('='.repeat(50));
        });
    })
    .catch(err => {
        console.error('❌ Ошибка инициализации БД:', err.message);
        process.exit(1);
    });
