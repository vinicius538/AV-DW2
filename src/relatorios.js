// Relatório gerencial de performance comercial.
const { pool } = require('./db');
const { AppError, relancar } = require('./erros');

function validarData(valor, nomeCampo) {
  const texto = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    throw new AppError(400, `${nomeCampo} é obrigatório no formato YYYY-MM-DD`);
  }
  const data = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
    throw new AppError(400, `${nomeCampo} não é uma data válida`);
  }
  return texto;
}

const arred = (n) => Math.round(Number(n || 0) * 100) / 100;


async function gerarRelatorioPerformance(inicio, fim) {
  try {
    const dataInicio = validarData(inicio, 'inicio');
    const dataFim = validarData(fim, 'fim');
    if (dataInicio > dataFim) {
      throw new AppError(400, 'inicio não pode ser posterior a fim');
    }
    const mesReferencia = dataInicio.slice(0, 7);
    const primeiroDiaMes = `${mesReferencia}-01`;

    const FILTRO = 'v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 DAY)';
    const params = [dataInicio, dataFim];

    const [[geral]] = await pool.execute(
      `SELECT COUNT(*) AS total_vendas,
              COALESCE(SUM(v.valor_venda), 0)    AS valor_total_vendido,
              COALESCE(SUM(v.valor_comissao), 0) AS comissao_total,
              COALESCE(ROUND(AVG(v.valor_comissao), 2), 0) AS comissao_media_geral
       FROM vendas v
       WHERE ${FILTRO}`,
      params
    );

    const [porRegiao] = await pool.execute(
      `SELECT r.id_regiao, r.nome_regiao,
              COUNT(v.id_venda) AS quantidade_vendas,
              COALESCE(SUM(v.valor_venda), 0) AS total_vendido,
              COALESCE(ROUND(AVG(v.valor_comissao), 2), 0) AS comissao_media
       FROM regioes r
       LEFT JOIN vendas v
              ON v.id_regiao = r.id_regiao
             AND v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY r.id_regiao, r.nome_regiao
       ORDER BY r.id_regiao`,
      params
    );

    const [porTipo] = await pool.execute(
      `SELECT v.tipo_cliente, COUNT(*) AS quantidade_vendas, SUM(v.valor_venda) AS total_vendido
       FROM vendas v
       WHERE ${FILTRO}
       GROUP BY v.tipo_cliente`,
      params
    );

    const [melhor] = await pool.execute(
      `SELECT ve.id_vendedor, ve.nome, SUM(v.valor_venda) AS total_vendido, COUNT(*) AS quantidade_vendas
       FROM vendas v
       JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
       WHERE ${FILTRO}
       GROUP BY ve.id_vendedor, ve.nome
       ORDER BY total_vendido DESC, ve.id_vendedor
       LIMIT 1`,
      params
    );

    const [maiorComissao] = await pool.execute(
      `SELECT ve.id_vendedor, ve.nome, SUM(v.valor_comissao) AS comissao_acumulada
       FROM vendas v
       JOIN vendedores ve ON ve.id_vendedor = v.id_vendedor
       WHERE ${FILTRO}
       GROUP BY ve.id_vendedor, ve.nome
       ORDER BY comissao_acumulada DESC, ve.id_vendedor
       LIMIT 1`,
      params
    );

    const [metas] = await pool.execute(
      `SELECT ve.id_vendedor, ve.nome, ve.meta_mensal,
              COALESCE(SUM(v.valor_venda), 0) AS total_vendido_no_mes
       FROM vendedores ve
       LEFT JOIN vendas v
              ON v.id_vendedor = ve.id_vendedor
             AND v.data_venda >= ? AND v.data_venda < DATE_ADD(?, INTERVAL 1 MONTH)
       WHERE ve.ativo = 1
       GROUP BY ve.id_vendedor, ve.nome, ve.meta_mensal
       ORDER BY ve.nome`,
      [primeiroDiaMes, primeiroDiaMes]
    );

    const vendedoresMeta = metas.map((m) => ({
      id_vendedor: m.id_vendedor,
      nome: m.nome,
      meta_mensal: m.meta_mensal,
      total_vendido_no_mes: arred(m.total_vendido_no_mes),
      percentual_atingido: m.meta_mensal > 0 ? arred((m.total_vendido_no_mes / m.meta_mensal) * 100) : null,
      meta_atingida: m.total_vendido_no_mes >= m.meta_mensal,
    }));

    const tipos = { PF: { quantidade_vendas: 0, total_vendido: 0 }, PJ: { quantidade_vendas: 0, total_vendido: 0 } };
    for (const t of porTipo) {
      tipos[t.tipo_cliente] = { quantidade_vendas: t.quantidade_vendas, total_vendido: arred(t.total_vendido) };
    }

    return {
      periodo: { inicio: dataInicio, fim: dataFim },
      mes_referencia_metas: mesReferencia,
      total_vendas: geral.total_vendas,
      valor_total_vendido: arred(geral.valor_total_vendido),
      comissao_total: arred(geral.comissao_total),
      comissao_media_geral: arred(geral.comissao_media_geral),
      vendas_por_regiao: porRegiao.map((r) => ({
        id_regiao: r.id_regiao,
        regiao: r.nome_regiao,
        quantidade_vendas: r.quantidade_vendas,
        total_vendido: arred(r.total_vendido),
      })),
      comissao_media_por_regiao: porRegiao.map((r) => ({
        id_regiao: r.id_regiao,
        regiao: r.nome_regiao,
        comissao_media: arred(r.comissao_media),
      })),
      vendas_por_tipo_cliente: tipos,
      melhor_vendedor: melhor[0]
        ? { ...melhor[0], total_vendido: arred(melhor[0].total_vendido) }
        : null,
      maior_comissao: maiorComissao[0]
        ? { ...maiorComissao[0], comissao_acumulada: arred(maiorComissao[0].comissao_acumulada) }
        : null,
      metas: {
        quantidade_metas_atingidas: vendedoresMeta.filter((v) => v.meta_atingida).length,
        total_vendedores_ativos: vendedoresMeta.length,
        vendedores: vendedoresMeta,
      },
    };
  } catch (erro) {
    relancar('gerar relatório de performance', erro);
  }
}

module.exports = { gerarRelatorioPerformance };
