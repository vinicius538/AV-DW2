const { AppError } = require('./erros');

const BONUS_CLIENTE = { PF: 2, PJ: 3 };

async function calcularComissao(valorVenda, percentualBase, tipoCliente, percentualRegiao) {
  const bonusCliente = BONUS_CLIENTE[tipoCliente];
  if (bonusCliente === undefined) {
    throw new AppError(400, "tipo_cliente deve ser 'PF' ou 'PJ'");
  }
  if (!(valorVenda > 0)) {
    throw new AppError(400, 'valor_venda deve ser maior que zero');
  }

  const percentualTotal = Number(percentualBase) + bonusCliente + Number(percentualRegiao);

  const valorComissao = Math.round(valorVenda * percentualTotal) / 100;

  return {
    percentual_base: Number(percentualBase),
    percentual_cliente: bonusCliente,
    percentual_regiao: Number(percentualRegiao),
    percentual_total: Math.round(percentualTotal * 100) / 100,
    valor_comissao: valorComissao,
  };
}

module.exports = { calcularComissao, BONUS_CLIENTE };
