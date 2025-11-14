// config/config.db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "furefac",
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
});

module.exports = { pool };
