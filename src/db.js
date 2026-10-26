
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'db_vendas',
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true, 
  dateStrings: true,    
});

async function testarConexao() {
  try {
    const conexao = await pool.getConnection();
    await conexao.ping();
    conexao.release();
    return true;
  } catch (erro) {
    console.error('Erro ao conectar ao MySQL:', erro.message);
    throw erro;
  }
}

module.exports = { pool, testarConexao };
