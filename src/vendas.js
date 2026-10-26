const { pool } = require('./db');
const { calcularComissao } = require('./comissao');
const { AppError, parseId, parseNumero, relancar } = require('./erros');

const SELECT_VENDAS = `
  SELECT v.id_venda, v.id_vendedor, ve.nome AS nome_vendedor,
         v.id_regiao, r.nome_regiao,
         v.data_venda, v.valor_venda, v.tipo_cliente, v.valor_comissao
  FROM vendas v
  JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
  JOIN regioes    r  ON r.id_regiao    = v.id_regiao`;

function normalizarDataHora(valor) {
  if (valor === undefined || valor === null || valor === '') {
    const agora = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())} ` +
           `${p(agora.getHours())}:${p(agora.getMinutes())}:${p(agora.getSeconds())}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(valor).trim());
  if (!m) {
    throw new AppError(400, 'data_venda inválida. Use o formato YYYY-MM-DD HH:mm:ss');
  }
  const [, a, mes, d, h = '00', mi = '00', s = '00'] = m;
  const teste = new Date(Date.UTC(+a, +mes - 1, +d, +h, +mi, +s));
  if (
    teste.getUTCFullYear() !== +a || teste.getUTCMonth() !== +mes - 1 ||
    teste.getUTCDate() !== +d || +h > 23 || +mi > 59 || +s > 59
  ) {
    throw new AppError(400, 'data_venda inválida');
  }
  return `${a}-${mes}-${d} ${h}:${mi}:${s}`;
}

async function consultarVendaPorId(id) {
  const [linhas] = await pool.execute(`${SELECT_VENDAS} WHERE v.id_venda = ?`, [id]);
  return linhas[0] || null;
}

async function registrarVenda(dados) {
  try {
    const { id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente } = dados || {};

    const idVendedor = parseId(id_vendedor, 'id_vendedor');
    const idRegiao = parseId(id_regiao, 'id_regiao');
    const valor = Math.round(parseNumero(valor_venda, 'valor_venda') * 100) / 100;
    if (valor <= 0) throw new AppError(400, 'valor_venda deve ser maior que zero');
    if (!['PF', 'PJ'].includes(tipo_cliente)) {
      throw new AppError(400, "tipo_cliente deve ser 'PF' ou 'PJ'");
    }
    const idVenda =
      id_venda === undefined || id_venda === null || id_venda === ''
        ? null
        : parseId(id_venda, 'id_venda');
    const dataFormatada = normalizarDataHora(data_venda);

    const [vendedores] = await pool.execute(
      'SELECT id_vendedor, percentual_base, ativo FROM vendedores WHERE id_vendedor = ?',
      [idVendedor]
    );
    if (vendedores.length === 0) throw new AppError(404, 'Vendedor não encontrado');
    if (!vendedores[0].ativo) throw new AppError(400, 'Vendedor inativo não pode registrar vendas');

    const [regioes] = await pool.execute(
      'SELECT id_regiao, percentual_bonus FROM regioes WHERE id_regiao = ?',
      [idRegiao]
    );
    if (regioes.length === 0) throw new AppError(404, 'Região não encontrada');

    if (idVenda !== null) {
      const [existentes] = await pool.execute('SELECT id_venda FROM vendas WHERE id_venda = ?', [idVenda]);
      if (existentes.length > 0) throw new AppError(409, `Já existe uma venda com o código ${idVenda}`);
    }

    const comissao = await calcularComissao(
      valor,
      vendedores[0].percentual_base,
      tipo_cliente,
      regioes[0].percentual_bonus
    );

    const [resultado] = await pool.execute(
      `INSERT INTO vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [idVenda, idVendedor, idRegiao, dataFormatada, valor, tipo_cliente, comissao.valor_comissao]
    );

    const venda = await consultarVendaPorId(resultado.insertId);
    return { ...venda, detalhamento_comissao: comissao };
  } catch (erro) {
    relancar('registrar venda', erro);
  }
}

async function listarVendas() {
  try {
    const [resultados] = await pool.execute(`${SELECT_VENDAS} ORDER BY v.data_venda DESC, v.id_venda DESC`);
    return resultados;
  } catch (erro) {
    relancar('consultar vendas', erro);
  }
}

async function consultarVendasPorVendedor(id) {
  try {
    const idVendedor = parseId(id, 'id do vendedor');
    const [vendedores] = await pool.execute('SELECT id_vendedor FROM vendedores WHERE id_vendedor = ?', [idVendedor]);
    if (vendedores.length === 0) throw new AppError(404, 'Vendedor não encontrado');

    const [resultados] = await pool.execute(
      `${SELECT_VENDAS} WHERE v.id_vendedor = ? ORDER BY v.data_venda DESC`,
      [idVendedor]
    );
    return resultados;
  } catch (erro) {
    relancar('consultar vendas por vendedor', erro);
  }
}

async function consultarVendasPorRegiao(id) {
  try {
    const idRegiao = parseId(id, 'id da região');
    const [regioes] = await pool.execute('SELECT id_regiao FROM regioes WHERE id_regiao = ?', [idRegiao]);
    if (regioes.length === 0) throw new AppError(404, 'Região não encontrada');

    const [resultados] = await pool.execute(
      `${SELECT_VENDAS} WHERE v.id_regiao = ? ORDER BY v.data_venda DESC`,
      [idRegiao]
    );
    return resultados;
  } catch (erro) {
    relancar('consultar vendas por região', erro);
  }
}

async function excluirVenda(id) {
  try {
    const idVenda = parseId(id, 'id da venda');
    const venda = await consultarVendaPorId(idVenda);
    if (!venda) throw new AppError(404, 'Venda não encontrada');

    await pool.execute('DELETE FROM vendas WHERE id_venda = ?', [idVenda]);
    return venda;
  } catch (erro) {
    relancar('excluir venda', erro);
  }
}

module.exports = {
  registrarVenda,
  listarVendas,
  consultarVendasPorVendedor,
  consultarVendasPorRegiao,
  excluirVenda,
};
