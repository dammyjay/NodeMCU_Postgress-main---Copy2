const WebSocket = require("ws");
const express = require("express");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
require('dotenv').config(); // Load .env variables

const connectionString = process.env.DATABASE_URL;

const app = express();
// app.use(session({
//     name: 'sid',
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       httpOnly: true,
//       secure: false,           // set to true when you have HTTPS
//       maxAge: 2 * 60 * 60 * 1000
//     }
// }));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL ,
    ssl: {
      rejectUnauthorized: false,
    },
  
  });
app.use(session({
    store: new PgSession({
      pool: pool,                // your pg `Pool` instance
      tableName: 'session',      // you can name this whatever you like
      createTableIfMissing: true // auto-create the table on startup
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    }
  }));

const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

// PostgreSQL Connection
// const pool = new Pool({
//     connectionString: connectionString,
//     ssl: { rejectUnauthorized: false }
// });



// const { Pool } = require('pg');
console.log('🔗 Connecting to Postgres with:', {
    host:   process.env.DB_HOST,
    port:   process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:   process.env.DB_USER,
    databaseurl: process.env.DATABASE_URL,
  });




const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS },
});

// const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.SMTP_EMAIL,
//     pass: process.env.SMTP_PASS
//   }
// });

app.use(express.json());

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS)
app.use(express.static('public'));

// Route for login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
  
    if (result.rows.length === 0) return res.send("Invalid credentials");
  
    req.session.user = result.rows[0];
    res.redirect("/dashboard");
  });

// Route for signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// After login success, show dashboard
// app.get('/dashboard', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/login.html");
    res.sendFile(path.join(__dirname, "index.html"));
  });

// (Optional) Redirect root URL to login
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get("/getUserData", async (req, res) => {
    const { device_ip } = req.query;
    const userId = req.session.user.id;
    const data = await pool.query("SELECT * FROM nodemcu_data WHERE user_id = $1 AND device_ip = $2", [userId, device_ip]);
    res.json(data.rows);
  });

//   app.post('/signup', async (req, res) => {
//     console.log('>>> req.body =', req.body);
//     // …
//   });  

//   app.post('/signup', (req, res) => {
//     const { username, password } = req.body;
//     // 🔥 Here you would normally save to your database
//     res.send('Signup successful! <a href="/login">Login now</a>');
// });


app.post("/signup", async (req, res) => {
    console.log('Inserted into pending_users (or nodemcu_table) for:', /* email or temperature, humidity */);
    // console.log('>>> SIGNUP BODY:', req.body);
    console.log('>>> req.body =', req.body);
    const { email, username, phone, gender, password } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
    await pool.query(`
      INSERT INTO pending_users (email, username, phone, gender, password, otp)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET otp = $6, created_at = CURRENT_TIMESTAMP
    `, [email, username, phone, gender, password, otp]);

    // await pool.query(
    //     `INSERT INTO pending_users
    //       (email, username, phone, gender, password, otp)
    //      VALUES
    //       ($1,     $2,       $3,    $4,     $5,       $6)`,
    //     [email, username, phone, gender, password, otp]
    //   );
  
    await transporter.sendMail({
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}`,
    });
  
    res.sendStatus(200);
  });
  

app.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    const result = await pool.query("SELECT * FROM pending_users WHERE email = $1 AND otp = $2", [email, otp]);
  
    if (result.rows.length === 0) return res.send("Invalid OTP");
  
    const user = result.rows[0];
    await pool.query("INSERT INTO users (email, username, phone, gender, password) VALUES ($1, $2, $3, $4, $5)", 
      [user.email, user.username, user.phone, user.gender, user.password]);
  
    await pool.query("DELETE FROM pending_users WHERE email = $1", [email]);
  
    res.send("Verification successful. You can now login.");
  });
  

//------------------------------------------------
// Signup
// app.post('/signup', async (req, res) => {
//     const { username, password } = req.body;
  
//     try {
//       const result = await pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *', [username, password]);
//       res.send('Signup successful! <a href="/login">Login now</a>');
//     } catch (err) {
//       console.error(err);
//       res.send('Username already exists or error occurred. <a href="/signup">Try again</a>');
//     }
//   });
  
//   // Login
//   app.post('/login', async (req, res) => {
//     const { username, password } = req.body;
  
//     try {
//       const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
  
//       if (result.rows.length > 0) {
//         res.redirect('/dashboard');
//       } else {
//         res.send('Invalid credentials. <a href="/login">Try again</a>');
//       }
//     } catch (err) {
//       console.error(err);
//       res.send('Error during login. <a href="/login">Try again</a>');
//     }
//   });
  
//-------------------------------------------------------


// app.post('/login', (req, res) => {-------
// app.post('/login', (req, res) => {
//     const { username, password } = req.body;
//     // 🔥 Here you would normally check in your database

//     if (username === 'admin' && password === '1234') {
//         res.redirect('/dashboard'); // login success
//     } else {
//         res.send('Invalid credentials! <a href="/login">Try again</a>');
//     }
// });


// Ensure table exists
async function createTableIfNotExists() {
    const query = `
        CREATE TABLE IF NOT EXISTS nodemcu_table (
            id SERIAL PRIMARY KEY,
            temperature FLOAT NOT NULL,
            humidity FLOAT NOT NULL,
            date DATE NOT NULL,
            time TIME NOT NULL
        );
    `;
    try {
        const client = await pool.connect();
        await client.query(query);
        client.release();
        console.log("Table ensured to exist.");
    } catch (error) {
        console.error("Error creating table:", error);
    }
}
createTableIfNotExists();

// Serve static files
app.use(express.static(path.join(__dirname)));

const clients = new Set();
wss.on("connection", (ws) => {
    console.log("Client connected");
    clients.add(ws);

    ws.on("close", () => {
        clients.delete(ws);
        console.log("Client disconnected");
    });
});

// Insert data into PostgreSQL
app.post("/postData", express.urlencoded({ extended: true }), async (req, res) => {
    console.log("Received data:", req.body);
    console.log('Inserted into pending_users (or nodemcu_table) for:', /* email or temperature, humidity */);

    const { temperature, humidity } = req.body;
    const date = new Date().toISOString().split("T")[0];
    const time = new Date().toISOString().split("T")[1].split(".")[0];

    try {
        const result = await pool.query(
            "INSERT INTO nodemcu_table (temperature, humidity, date, time) VALUES ($1, $2, $3, $4) RETURNING *",
            [temperature, humidity, date, time]
        );

        console.log("Inserted data:", result.rows[0]);

        // Notify WebSocket clients
        const newData = JSON.stringify(result.rows[0]);
        clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(newData);
            }
        });

        res.json({ message: "Data inserted successfully", data: result.rows[0] });
    } catch (error) {
        console.error("Error inserting data:", error);
        res.status(500).json({ error: "Database insertion failed" });
    }
});

// Retrieve all data in descending order
app.get("/getAllData", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM nodemcu_table ORDER BY id DESC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ error: "Database fetch failed" });
    }
});

app.get("/getDataByDate", async (req, res) => {
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ error: "Missing start or end date" });
    }

    try {
        const result = await pool.query(
            // "SELECT * FROM nodemcu_table WHERE date BETWEEN $1 AND $2 ORDER BY id DESC",
            `SELECT * FROM nodemcu_table 
             WHERE (date + time) BETWEEN $1::timestamp AND $2::timestamp 
             ORDER BY id DESC`,
            [start, end]
        );
        res.json(result.rows);
    } catch (error) {
        console.error("Error filtering data:", error);
        res.status(500).json({ error: "Database filter failed" });
    }
});
// app.get("/getDataByDateAndTime", async (req, res) => {
//     const { startDate, endDate, startTime, endTime } = req.query;

//     if (!startDate || !endDate || !startTime || !endTime) {
//         return res.status(400).json({ error: "Missing date or time parameters" });
//     }

//     try {
//         const result = await pool.query(
//             "SELECT * FROM nodemcu_table WHERE (date BETWEEN $1 AND $2) AND (time BETWEEN $3 AND $4) ORDER BY id DESC",
//             [startDate, endDate, startTime, endTime]
//         );
//         res.json(result.rows);
//     } catch (error) {
//         console.error("Error filtering data:", error);
//         res.status(500).json({ error: "Database filter failed" });
//     }
// });


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
