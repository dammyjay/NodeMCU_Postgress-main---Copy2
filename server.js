const WebSocket = require("ws");
const express = require("express");
const path = require("path");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const crypto = require('crypto');
require('dotenv').config(); // Load .env variables

const connectionString = process.env.DATABASE_URL;
const passwordResetTokens = new Map(); // In-memory store for demo. Use DB for production.


const app = express();


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

app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, 'welcome.html'));
});

app.get('/splash', (req, res) => {
  res.sendFile(path.join(__dirname, 'splash.html'));
});


app.get("/dashboard", (req, res) => {
    // if (!req.session.user) return res.redirect("/login.html");
    res.sendFile(path.join(__dirname, "index.html"));
    // res.render("dashboard", { user: req.session.user });
  });

// (Optional) Redirect root URL to login
app.get('/', (req, res) => {
    // res.redirect('/login');
    // res.redirect('/welcome');
    res.redirect('/splash');
});

app.get("/getUserData", async (req, res) => {
    const { device_ip } = req.query;
    const userId = req.session.user.id;
    const data = await pool.query("SELECT * FROM nodemcu_data WHERE user_id = $1 AND device_ip = $2", [userId, device_ip]);
    res.json(data.rows);
  });


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
    // alert("Verification successful. You can now login.");
    // res.redirect("/login");
  });
  
  app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'forgot-password.html'));
  });
  
  // Handle forgot password form
  app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.send("No account with that email found.");
  
    const token = crypto.randomBytes(20).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour
  
    // Save token and expiry
    passwordResetTokens.set(token, { email, expires });
  
    const resetLink = `http://${req.headers.host}/reset-password/${token}`;
    // const resetLink = `https://calicareapp.onrender.com//reset-password/${token}`;
    
  
    await transporter.sendMail({
      to: email,
      subject: "Password Reset",
      text: `Click the link to reset your password: ${resetLink}`,
    });
  
    res.send("Reset link sent to your email.");
  });

  app.get('/reset-password/:token', (req, res) => {
    const tokenData = passwordResetTokens.get(req.params.token);
  
    if (!tokenData || tokenData.expires < Date.now()) {
      return res.send("Reset token is invalid or has expired.");
    }
  
    // You can dynamically render the form with the token
    // res.send(`
    //   <form action="/reset-password/${req.params.token}" method="POST">
    //     <input type="text" name="password" placeholder="Enter new password" required />
    //     <button type="submit">Reset Password</button>
    //   </form>
    // `);

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Reset Password</title>
          <style>
            body {
              font-family: "Segoe UI", sans-serif;
              background-color: #f0f2f5;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
        
            .container {
              background: #fff;
              padding: 40px 30px;
              border-radius: 10px;
              box-shadow: 0 8px 20px rgba(0,0,0,0.1);
              text-align: center;
              width: 100%;
              max-width: 400px;
            }
        
            h2 {
              margin-bottom: 20px;
              color: #333;
            }
        
            input[type="text"] {
                  width: 100%;
                padding: 10px;
                margin: 10px 0 20px;
                border: 1px solid #ccc;
                border-radius: 5px;
            }
        
            button {
              padding: 12px 20px;
              width: 100%;
              background-color: #28a745;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 16px;
              cursor: pointer;
              transition: background-color 0.3s ease;
            }
        
            button:hover {
              background-color: #1e7e34;
            }
        
            a {
              display: inline-block;
              margin-top: 20px;
              color: #007bff;
              text-decoration: none;
            }
        
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Set New Password</h2>
            <form action="/reset-password/${req.params.token}" method="POST">
              <input type="text" name="password" placeholder="Enter new password" required />
              <button type="submit">Reset Password</button>
            </form>
            <a href="/login">Back to Login</a>
          </div>
        </body>
        </html>
        `);
        

    
  });
  
  app.post('/reset-password/:token', async (req, res) => {
    const tokenData = passwordResetTokens.get(req.params.token);
    if (!tokenData || tokenData.expires < Date.now()) {
      return res.send("Reset token is invalid or has expired.");
    }
  
    const { password } = req.body;
    await pool.query("UPDATE users SET password = $1 WHERE email = $2", [password, tokenData.email]);
  
    passwordResetTokens.delete(req.params.token);
    res.send("Password successfully updated. You can now <a href='/login'>login</a>.");
  });
  

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


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));