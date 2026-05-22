const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8008;

// ==================== НАСТРОЙКА ====================
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// ==================== БАЗА ДАННЫХ ====================
const db = new sqlite3.Database('./vanilka.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Подключено к SQLite базе данных');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER,
            category TEXT,
            image_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            total INTEGER NOT NULL,
            status TEXT DEFAULT 'new',
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            orders_count INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            first_order TIMESTAMP,
            last_order TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Создаём дефолтного админа если нет
        db.get("SELECT * FROM admins WHERE username = 'admin'", (err, row) => {
            if (!row) {
                // Пароль берём из переменной окружения или дефолтный
                const adminPass = process.env.ADMIN_PASSWORD || 'vanilka2024';
                db.run("INSERT INTO admins (username, password) VALUES ('admin', ?)", [adminPass]);
                console.log('👑 Создан администратор: admin / ' + adminPass);
            }
        });

        // Тестовые товары если таблица пуста
        db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
            if (row && row.count === 0) {
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
                const stmt = db.prepare("INSERT INTO products (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)");
                products.forEach(p => stmt.run(p));
                stmt.finalize();
                console.log('🛒 Добавлены тестовые товары');
            }
        });

        console.log('✅ База данных инициализирована');
    });
}

// ==================== API ====================

// 1. Товары
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products ORDER BY id", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Создать заказ
app.post('/api/orders', (req, res) => {
    const { customer_name, customer_phone, customer_email, total, message } = req.body;

    if (!customer_name || !customer_phone || !customer_email) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const orderId = 'VAN-' + Date.now();
    const createdAt = new Date().toISOString();

    db.run(
        `INSERT INTO orders (id, customer_name, customer_phone, customer_email, total, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, customer_name, customer_phone, customer_email, total || 0, message, createdAt],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });

            // Обновляем/создаём клиента
            db.get("SELECT * FROM customers WHERE email = ?", [customer_email], (err, customer) => {
                if (customer) {
                    db.run(
                        `UPDATE customers SET orders_count = orders_count + 1,
                         total_spent = total_spent + ?, last_order = ? WHERE email = ?`,
                        [total || 0, createdAt, customer_email]
                    );
                } else {
                    db.run(
                        `INSERT INTO customers (name, phone, email, orders_count, total_spent, first_order, last_order)
                         VALUES (?, ?, ?, 1, ?, ?, ?)`,
                        [customer_name, customer_phone, customer_email, total || 0, createdAt, createdAt]
                    );
                }
            });

            res.json({ success: true, orderId });
        }
    );
});

// 3. Все заказы
app.get('/api/orders', (req, res) => {
    const { status } = req.query;
    let query = "SELECT * FROM orders";
    const params = [];

    if (status && status !== 'all') {
        query += " WHERE status = ?";
        params.push(status);
    }
    query += " ORDER BY created_at DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 4. Обновить статус заказа
app.put('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['new', 'processing', 'completed', 'cancelled'];

    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус' });
    }

    db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Заказ не найден' });
        res.json({ success: true });
    });
});

// 5. Все клиенты
app.get('/api/customers', (req, res) => {
    db.all("SELECT * FROM customers ORDER BY last_order DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 6. Авторизация
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM admins WHERE username = ? AND password = ?", [username, password], (err, admin) => {
        if (err) return res.status(500).json({ error: err.message });
        if (admin) {
            res.json({ success: true, user: { username: admin.username } });
        } else {
            res.status(401).json({ error: 'Неверные логин или пароль' });
        }
    });
});

// 7. Статистика
app.get('/api/stats', (req, res) => {
    db.get("SELECT COUNT(*) as total_orders, SUM(total) as total_revenue FROM orders", (err, orderStats) => {
        db.get("SELECT COUNT(*) as total_customers FROM customers", (err2, custStats) => {
            db.get("SELECT COUNT(*) as new_orders FROM orders WHERE status = 'new'", (err3, newOrders) => {
                res.json({
                    total_orders: orderStats.total_orders || 0,
                    total_revenue: orderStats.total_revenue || 0,
                    total_customers: custStats.total_customers || 0,
                    new_orders: newOrders.new_orders || 0
                });
            });
        });
    });
});

// 8. Экспорт CSV
app.get('/api/export/orders', (req, res) => {
    db.all("SELECT * FROM orders ORDER BY created_at DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let csv = 'ID,Имя,Телефон,Email,Сумма,Статус,Дата\n';
        rows.forEach(o => {
            csv += `"${o.id}","${o.customer_name}","${o.customer_phone}","${o.customer_email}",${o.total},"${o.status}","${o.created_at}"\n`;
        });

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.header('Content-Disposition', 'attachment; filename="orders_export.csv"');
        res.send('\uFEFF' + csv); // BOM для корректного открытия в Excel
    });
});

// ==================== СТАТИЧЕСКИЕ МАРШРУТЫ ====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ==================== ЗАПУСК ====================
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`✅ Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Сайт:    http://localhost:${PORT}/`);
    console.log(`🔧 Админка: http://localhost:${PORT}/admin.html`);
    console.log('='.repeat(50));
});
