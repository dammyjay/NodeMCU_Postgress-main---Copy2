const WebSocket = require("ws");
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
require('dotenv').config(); // Load .env variables

const connectionString = process.env.DATABASE_URL;

const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });

// PostgreSQL Connection
// const pool = new Pool({
//     connectionString: connectionString,
//     ssl: { rejectUnauthorized: false }
// });



// const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ,
  ssl: {
    rejectUnauthorized: false,
  },

});

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, JS)
app.use(express.static('public'));

// Route for login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Route for signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

// After login success, show dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// (Optional) Redirect root URL to login
app.get('/', (req, res) => {
    res.redirect('/login');
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

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // 🔥 Here you would normally check in your database

    if (username === 'admin' && password === '1234') {
        res.redirect('/dashboard'); // login success
    } else {
        res.send('Invalid credentials! <a href="/login">Try again</a>');
    }
});

app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    // 🔥 Here you would normally save to your database
    res.send('Signup successful! <a href="/login">Login now</a>');
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
