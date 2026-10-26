require('dotenv').config();
const express = require('express');
const { testarConexao } = require('./db');
const { AppError } = require('./erros');
const vendedores = require('./vendedores');
const vendas = require('./vendas');
const { gerarRelatorioPerformance } = require('./relatorios');

const app = express();
app.use(express.json());

const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/', (req, res) => res.json({ api: 'Sistema de Vendas', status: 'online' }));


app.post('/vendedores', rota(async (req, res) => {
  res.status(201).json(await vendedores.cadastrarVendedor(req.body));
}));

app.get('/vendedores', rota(async (req, res) => {
  res.status(200).json(await vendedores.listarVendedores(req.query.ativo === '1' || req.query.ativo === 'true'));
}));

app.get('/vendedores/:id', rota(async (req, res) => {
  res.status(200).json(await vendedores.consultarVendedorPorId(req.params.id));
}));

app.put('/vendedores/:id', rota(async (req, res) => {
  res.status(200).json(await vendedores.atualizarVendedor(req.params.id, req.body));
}));

app.patch('/vendedores/:id/desativar', rota(async (req, res) => {
  res.status(200).json({
    mensagem: 'Vendedor desativado. O histórico de vendas foi preservado.',
    vendedor: await vendedores.desativarVendedor(req.params.id),
  });
}));


app.post('/vendas', rota(async (req, res) => {
  res.status(201).json(await vendas.registrarVenda(req.body));
}));

app.get('/vendas', rota(async (req, res) => {
  res.status(200).json(await vendas.listarVendas());
}));

app.get('/vendas/vendedor/:id', rota(async (req, res) => {
  res.status(200).json(await vendas.consultarVendasPorVendedor(req.params.id));
}));

app.get('/vendas/regiao/:id', rota(async (req, res) => {
  res.status(200).json(await vendas.consultarVendasPorRegiao(req.params.id));
}));

app.delete('/vendas/:id', rota(async (req, res) => {
  res.status(200).json({
    mensagem: 'Venda excluída com sucesso',
    venda: await vendas.excluirVenda(req.params.id),
  });
}));

app.get('/relatorios/performance', rota(async (req, res) => {
  res.status(200).json(await gerarRelatorioPerformance(req.query.inicio, req.query.fim));
}));


app.use((req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

const ERROS_DE_CONEXAO = [
  'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_NO_DB_ERROR', 'ECONNRESET',
];


app.use((erro, req, res, next) => {
  if (erro instanceof AppError) {
    return res.status(erro.status).json({ erro: erro.message });
  }
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição' });
  }
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Registro duplicado (código já existente)' });
  }
  if (ERROS_DE_CONEXAO.includes(erro.code)) {
    return res.status(500).json({ erro: 'Falha na comunicação com o banco de dados' });
  }
  console.error('Erro não tratado:', erro);
  return res.status(500).json({ erro: 'Erro interno do servidor' });
});

module.exports = app;

if (require.main === module) {
  const porta = Number(process.env.PORT) || 3000;
  app.listen(porta, async () => {
    console.log(`API rodando em http://localhost:${porta}`);
    try {
      await testarConexao();
      console.log('Conexão com o MySQL estabelecida.');
    } catch {
      console.warn('Atenção: sem conexão com o MySQL. Verifique o .env e se o servidor está ativo.');
    }
  });
}
