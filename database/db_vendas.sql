DROP DATABASE IF EXISTS db_vendas;
CREATE DATABASE db_vendas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE db_vendas;


CREATE TABLE regioes (
  id_regiao        INT AUTO_INCREMENT PRIMARY KEY,
  nome_regiao      VARCHAR(50)  NOT NULL,
  percentual_bonus DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  CONSTRAINT uq_regioes_nome   UNIQUE (nome_regiao),
  CONSTRAINT chk_regioes_nome  CHECK (nome_regiao IN ('Norte','Nordeste','Sudeste','Sul')),
  CONSTRAINT chk_regioes_bonus CHECK (percentual_bonus >= 0 AND percentual_bonus <= 100)
) ENGINE=InnoDB;

CREATE TABLE vendedores (
  id_vendedor     INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(100)  NOT NULL,
  meta_mensal     DECIMAL(12,2) NOT NULL,
  percentual_base DECIMAL(5,2)  NOT NULL,
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_vendedores_meta CHECK (meta_mensal >= 0),
  CONSTRAINT chk_vendedores_base CHECK (percentual_base >= 0 AND percentual_base <= 100)
) ENGINE=InnoDB;

CREATE TABLE vendas (
  id_venda       INT AUTO_INCREMENT PRIMARY KEY,
  id_vendedor    INT           NOT NULL,
  id_regiao      INT           NOT NULL,
  data_venda     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor_venda    DECIMAL(12,2) NOT NULL,
  tipo_cliente   ENUM('PF','PJ') NOT NULL,
  valor_comissao DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_vendas_vendedor FOREIGN KEY (id_vendedor)
    REFERENCES vendedores (id_vendedor) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_vendas_regiao FOREIGN KEY (id_regiao)
    REFERENCES regioes (id_regiao) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_vendas_valor    CHECK (valor_venda > 0),
  CONSTRAINT chk_vendas_comissao CHECK (valor_comissao >= 0),
  INDEX idx_vendas_data     (data_venda),
  INDEX idx_vendas_vendedor (id_vendedor),
  INDEX idx_vendas_regiao   (id_regiao)
) ENGINE=InnoDB;

INSERT INTO regioes (id_regiao, nome_regiao, percentual_bonus) VALUES
  (1, 'Norte',    1.00),
  (2, 'Nordeste', 1.00),
  (3, 'Sudeste',  0.00),
  (4, 'Sul',      0.50);

INSERT INTO vendedores (id_vendedor, nome, meta_mensal, percentual_base, ativo) VALUES
  (1, 'Vinicius de Souza',      20000.00, 5.00, TRUE),
  (2, 'Kelwin Felipe',     15000.00, 4.00, TRUE),
  (3, 'Guilherme',   25000.00, 6.00, TRUE),
  (4, 'Gustavo', 10000.00, 3.50, TRUE),
  (5, 'Leonardo',    18000.00, 4.50, TRUE),
  (6, 'Lavinia',    12000.00, 4.00, FALSE);  

CREATE TEMPORARY TABLE tmp_vendas (
  id_venda     INT,
  id_vendedor  INT,
  id_regiao    INT,
  data_venda   DATETIME,
  valor_venda  DECIMAL(12,2),
  tipo_cliente ENUM('PF','PJ')
);

INSERT INTO tmp_vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente) VALUES
  (1001, 1, 1, '2026-10-02 10:15:00',  2000.00, 'PJ'),
  (1002, 1, 3, '2026-10-05 14:30:00',  8500.00, 'PF'),
  (1003, 1, 4, '2026-10-12 09:10:00', 12000.00, 'PJ'),

  (1004, 2, 2, '2026-10-03 11:00:00',  6000.00, 'PF'),
  (1005, 2, 2, '2026-10-14 16:45:00',  4500.00, 'PJ'),
  (1006, 2, 1, '2026-10-20 13:20:00',  5200.00, 'PF'),

  (1007, 3, 3, '2026-10-04 10:00:00',  9000.00, 'PJ'),
  (1008, 3, 4, '2026-10-11 15:30:00',  7500.00, 'PF'),
  (1009, 3, 1, '2026-10-18 12:00:00',  3200.00, 'PJ'),

  (1010, 4, 4, '2026-10-06 09:40:00',  3800.00, 'PF'),
  (1011, 4, 2, '2026-10-15 17:10:00',  4100.00, 'PJ'),
  (1012, 4, 3, '2026-10-22 10:50:00',  3000.00, 'PF'),

  (1013, 5, 1, '2026-10-08 14:00:00',  5000.00, 'PF'),
  (1014, 5, 3, '2026-10-16 11:25:00',  6200.00, 'PJ'),
  (1015, 5, 2, '2026-10-24 15:15:00',  2500.00, 'PF');

INSERT INTO vendas (id_venda, id_vendedor, id_regiao, data_venda, valor_venda, tipo_cliente, valor_comissao)
SELECT t.id_venda, t.id_vendedor, t.id_regiao, t.data_venda, t.valor_venda, t.tipo_cliente,
       ROUND(t.valor_venda * (v.percentual_base
                              + CASE t.tipo_cliente WHEN 'PF' THEN 2 ELSE 3 END
                              + r.percentual_bonus) / 100, 2)
FROM tmp_vendas t
JOIN vendedores v ON v.id_vendedor = t.id_vendedor
JOIN regioes    r ON r.id_regiao   = t.id_regiao;

DROP TEMPORARY TABLE tmp_vendas;