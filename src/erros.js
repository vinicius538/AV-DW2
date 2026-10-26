class AppError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
  }
}

function parseId(valor, nomeCampo = 'id') {
  const texto = String(valor ?? '').trim();
  if (!/^\d+$/.test(texto) || Number(texto) <= 0) {
    throw new AppError(400, `${nomeCampo} deve ser um número inteiro positivo`);
  }
  return Number(texto);
}

function parseNumero(valor, nomeCampo) {
  if (valor === undefined || valor === null || valor === '' || typeof valor === 'boolean') {
    throw new AppError(400, `${nomeCampo} é obrigatório`);
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw new AppError(400, `${nomeCampo} deve ser um número válido`);
  }
  return numero;
}

function relancar(contexto, erro) {
  if (!(erro instanceof AppError)) {
    console.error(`Erro ao ${contexto}:`, erro.message);
  }
  throw erro;
}

module.exports = { AppError, parseId, parseNumero, relancar };
