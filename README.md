# Sistema de Vendas com Comissões, Metas e Performance

API REST em **Node.js + Express + MySQL** (`mysql2/promise`, `async/await`) para gerenciar
vendedores, vendas, comissões e metas, com relatório gerencial de performance.

## Requisitos

- Node.js 18 ou superior
- MySQL 8.0.16+ (necessário para as restrições `CHECK`)

## Instalação

```bash
git clone <url-do-seu-repositorio>
cd <pasta-do-projeto>
npm install
```

## Configuração

1. Crie o banco, as tabelas e os dados de teste:

   ```bash
   mysql -u root -p < database/db_vendas.sql
   ```

   > O script recria o banco `db_vendas` do zero (`DROP DATABASE IF EXISTS`).

2. Copie o arquivo de exemplo e preencha suas credenciais (o `.env` não vai para o Git):

   ```bash
   cp .env.example .env
   ```

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=sua_senha_aqui
   DB_NAME=db_vendas
   PORT=3000
   ```

## Execução

```bash
npm start        # produção
npm run dev      # desenvolvimento (reinicia ao salvar)
npm run test:comissao   # teste da regra de comissão (não precisa de banco)
```

A API sobe em `http://localhost:3000`.

## Estrutura

```
database/db_vendas.sql   Banco, tabelas, relacionamentos e dados de teste
src/db.js                Pool de conexões mysql2/promise (credenciais via .env)
src/comissao.js          calcularComissao() - única implementação da regra
src/vendedores.js        cadastrarVendedor, listarVendedores, atualizarVendedor, desativarVendedor
src/vendas.js            registrarVenda, listarVendas, consultarVendasPorVendedor, excluirVenda
src/relatorios.js        gerarRelatorioPerformance
src/erros.js             AppError, validações e relançamento de erros
src/app.js               Rotas Express e tratamento central de erros
requests.http            Requisições prontas para todos os testes obrigatórios
tests/comissao.test.js   Teste da regra de comissão
```

## Regras de comissão

`comissao = valor_venda × (percentual_base + bônus_cliente + bônus_região) / 100`

| Cliente | Bônus | | Região | Bônus |
|---|---|---|---|---|
| PF | 2% | | Norte | 1% |
| PJ | 3% | | Nordeste | 1% |
| | | | Sudeste | 0% |
| | | | Sul | 0,5% |

Os percentuais são somados (sem composição). Exemplo: R$ 2.000,00, PJ, Norte, base 5% → 9% → **R$ 180,00**.

## Endpoints

| Método | Endpoint | Operação | Códigos |
|---|---|---|---|
| POST | `/vendedores` | Cadastrar vendedor | 201, 400 |
| GET | `/vendedores` | Listar vendedores (`?ativo=1` só ativos) | 200 |
| GET | `/vendedores/:id` | Consultar vendedor | 200, 400, 404 |
| PUT | `/vendedores/:id` | Atualizar `meta_mensal` e/ou `percentual_base` | 200, 400, 404 |
| PATCH | `/vendedores/:id/desativar` | Desativar (histórico preservado) | 200, 400, 404 |
| POST | `/vendas` | Registrar venda | 201, 400, 404, 409 |
| GET | `/vendas` | Listar vendas | 200 |
| GET | `/vendas/vendedor/:id` | Vendas por vendedor | 200, 404 |
| GET | `/vendas/regiao/:id` | Vendas por região | 200, 404 |
| DELETE | `/vendas/:id` | Excluir venda | 200, 404 |
| GET | `/relatorios/performance?inicio=YYYY-MM-DD&fim=YYYY-MM-DD` | Relatório gerencial | 200, 400 |

Erros de banco/conexão retornam **500** com mensagem genérica (o detalhe fica só no log do servidor).

### Exemplos de corpo

```json
POST /vendedores
{ "nome": "Gabriela Torres", "meta_mensal": 16000, "percentual_base": 5 }

POST /vendas
{ "id_venda": 2001, "id_vendedor": 1, "id_regiao": 1,
  "data_venda": "2026-10-25 10:00:00", "valor_venda": 2000, "tipo_cliente": "PJ" }
```

- `id_venda` é opcional (se omitido, o MySQL gera o código); se informado, deve ser único (**409** se duplicado).
- `data_venda` é opcional (padrão: agora). Formato `YYYY-MM-DD HH:mm:ss`.
- `id_regiao`: 1 Norte, 2 Nordeste, 3 Sudeste, 4 Sul.

## Relatório de performance

Retorna: total de vendas, vendas por região (R$), vendas por tipo de cliente (R$), melhor vendedor,
vendedor com maior comissão acumulada, metas atingidas, comissão média geral e por região.

Todos os indicadores usam SQL com `JOIN`, `GROUP BY`, `SUM()`, `AVG()` e `COUNT()`.
O intervalo `inicio`/`fim` é inclusivo. Para metas, o **mês de referência é o mês da data inicial**
(considera o mês inteiro, apenas vendedores ativos).

Com os dados de teste (`inicio=2026-10-01&fim=2026-10-31`): Ana, Bruno e Diego atingem a meta;
Carla e Elisa não (3 de 5 vendedores ativos).

## Segurança

- Todas as consultas usam parâmetros (`?`) com `execute()` — sem concatenação de valores no SQL.
- Credenciais apenas em variáveis de ambiente (`.env` está no `.gitignore`).

## Testes obrigatórios

Abra `requests.http` (extensão REST Client do VS Code) ou importe as requisições no
Postman/Insomnia/Thunder Client. Cada bloco está numerado conforme o enunciado:
cadastro e comissão correta, código duplicado, vendedor inexistente/inativo, atualização de meta,
consultas por região e vendedor, relatório mensal e erro de conexão.

Salve as capturas de tela na pasta `capturas/` antes de enviar ao GitHub.
