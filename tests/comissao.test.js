const assert = require('node:assert/strict');
const { calcularComissao } = require('../src/comissao');

(async () => {
  let r = await calcularComissao(2000, 5, 'PJ', 1);
  assert.equal(r.percentual_total, 9);
  assert.equal(r.valor_comissao, 180);

  r = await calcularComissao(8500, 5, 'PF', 0);
  assert.equal(r.valor_comissao, 595);

  r = await calcularComissao(7500, 6, 'PJ', 0.5);
  assert.equal(r.valor_comissao, 712.5);

  r = await calcularComissao(3333.33, 3.5, 'PF', 0.5);
  assert.equal(r.valor_comissao, 200);

  await assert.rejects(() => calcularComissao(100, 5, 'XX', 0), /tipo_cliente/);
  await assert.rejects(() => calcularComissao(0, 5, 'PF', 0), /valor_venda/);

  console.log('OK - todos os testes de comissão passaram.');
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
