// config/config.db.js
require('dotenv').config();
const mysql = require('mysql');
const util = require('util');

const pool = mysql.createPool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  port: process.env.DBPORT ? Number(process.env.DBPORT) : 3306,
  connectionLimit: 10,
  timezone: 'Z'
});

// Promisify para usar async/await
pool.query = util.promisify(pool.query);

module.exports = { pool };
