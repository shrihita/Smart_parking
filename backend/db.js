const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',       // your pg username
  host: 'localhost',
  database: 'parkingdb',  // create this in pgAdmin
  password: '1234',
  port: 5432,
});

module.exports = pool;