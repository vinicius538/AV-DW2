const { pool } = require('./db');
const { AppError, parseId, parseNumero, relancar } = require('./erros');

function validarMeta(valor) {
  const meta = parseNumero(valor, 'meta_mensal');
  if (meta < 0) throw new AppError(400, 'meta_mensal não pode ser negativa');
  return Math.round(meta * 100) / 100;
}

function validarPercentualBase(valor) {
  const pct = parseNumero(valor, 'percentual_base');
  if (pct < 0 || pct > 100) throw new AppError(400, 'percentual_base deve estar entre 0 e 100');
  return Math.round(pct * 100) / 100;
}

async function cadastrarVendedor(dados) {
  try {
    const { nome, meta_mensal, percentual_base } = dados || {};
    if (typeof nome !== 'string' || nome.trim() === '') {
      throw new AppError(400, 'nome é obrigatório');
    }
    if (nome.trim().length > 100) {
      throw new AppError(400, 'nome deve ter no máximo 100 caracteres');
    }
    const meta = validarMeta(meta_mensal);
    const base = validarPercentualBase(percentual_base);

    const [resultado] = await pool.execute(
      'INSERT INTO vendedores (nome, meta_mensal, percentual_base, ativo) VALUES (?, ?, ?, 1)',
      [nome.trim(), meta, base]
    );
    return await consultarVendedorPorId(resultado.insertId);
  } catch (erro) {
    relancar('cadastrar vendedor', erro);
  }
}

async function listarVendedores(apenasAtivos = false) {
  try {
    const sql = apenasAtivos
      ? 'SELECT * FROM vendedores WHERE ativo = ? ORDER BY nome'
      : 'SELECT * FROM vendedores ORDER BY nome';
    const [resultados] = await pool.execute(sql, apenasAtivos ? [1] : []);
    return resultados;
  } catch (erro) {
    relancar('consultar vendedores', erro);
  }
}

async function consultarVendedorPorId(id) {
  try {
    const idVendedor = parseId(id, 'id do vendedor');
    const [linhas] = await pool.execute(
      'SELECT * FROM vendedores WHERE id_vendedor = ?',
      [idVendedor]
    );
    if (linhas.length === 0) throw new AppError(404, 'Vendedor não encontrado');
    return linhas[0];
  } catch (erro) {
    relancar('consultar vendedor', erro);
  }
}

async function atualizarVendedor(id, dados) {
  try {
    const idVendedor = parseId(id, 'id do vendedor');
    const { meta_mensal, percentual_base } = dados || {};
    if (meta_mensal === undefined && percentual_base === undefined) {
      throw new AppError(400, 'Informe meta_mensal e/ou percentual_base');
    }

    await consultarVendedorPorId(idVendedor); 

    const campos = [];
    const valores = [];
    if (meta_mensal !== undefined) {
      campos.push('meta_mensal = ?');
      valores.push(validarMeta(meta_mensal));
    }
    if (percentual_base !== undefined) {
      campos.push('percentual_base = ?');
      valores.push(validarPercentualBase(percentual_base));
    }
    valores.push(idVendedor);

    await pool.execute(
      `UPDATE vendedores SET ${campos.join(', ')} WHERE id_vendedor = ?`,
      valores
    );
    return await consultarVendedorPorId(idVendedor);
  } catch (erro) {
    relancar('atualizar vendedor', erro);
  }
}

async function desativarVendedor(id) {
  try {
    const vendedor = await consultarVendedorPorId(id);
    if (!vendedor.ativo) {
      throw new AppError(400, 'Vendedor já está desativado');
    }
    await pool.execute('UPDATE vendedores SET ativo = ? WHERE id_vendedor = ?', [
      0,
      vendedor.id_vendedor,
    ]);
    return await consultarVendedorPorId(vendedor.id_vendedor);
  } catch (erro) {
    relancar('desativar vendedor', erro);
  }
}

module.exports = {
  cadastrarVendedor,
  listarVendedores,
  consultarVendedorPorId,
  atualizarVendedor,
  desativarVendedor,
};
