const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'broadcasts'
    `);
    console.log('Columns in broadcasts table:');
    console.log(res.rows);

    const broadcasts = await client.query(`
      SELECT id, title, image_url IS NOT NULL as has_image, substring(image_url from 1 for 50) as image_prefix 
      FROM broadcasts 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    console.log('\nLast 3 broadcasts:');
    console.log(broadcasts.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
