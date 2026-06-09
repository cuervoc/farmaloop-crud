-- Schema para la base de datos SEO de Farmaloop
-- Se ejecuta automáticamente al iniciar MariaDB por primera vez

CREATE DATABASE IF NOT EXISTS farmaloop_seo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE farmaloop_seo;

CREATE TABLE IF NOT EXISTS products (
  -- Datos del catálogo (desde CSVs de Sergio)
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  sku                   VARCHAR(50) DEFAULT '',
  url                   TEXT,
  fullName              VARCHAR(500) DEFAULT '',
  category              VARCHAR(200) DEFAULT '',
  subCategory           VARCHAR(200) DEFAULT '',
  stock_total           INT DEFAULT 0,
  price_min_activo      DECIMAL(12,2) DEFAULT NULL,
  price_max_activo      DECIMAL(12,2) DEFAULT NULL,
  currency              VARCHAR(10) DEFAULT 'CLP',
  requiresPrescription  BOOLEAN DEFAULT FALSE,
  prescriptionType      VARCHAR(100) DEFAULT '',
  pharmaceuticalForm    VARCHAR(100) DEFAULT '',
  presentation          VARCHAR(100) DEFAULT '',
  quantityPerPresentation INT DEFAULT 1,
  ean                   VARCHAR(20) DEFAULT '',
  bioequivalent         BOOLEAN DEFAULT FALSE,
  cooled                BOOLEAN DEFAULT FALSE,
  composicion           TEXT,
  aliasBusqueda         TEXT,
  tags                  TEXT,
  priority              INT DEFAULT 0,
  temporaryCategories   TEXT,

  -- Campos desde BD de Sergio (sync batch)
  laboratorio              VARCHAR(300) DEFAULT '',
  precio_actual            DECIMAL(12,2) DEFAULT NULL,
  precio_referencia        DECIMAL(12,2) DEFAULT NULL,

  -- Campos SEO (nuestros, para el bloque 1)
  title_optimizado          VARCHAR(70) DEFAULT '',
  meta_description_optimizado TEXT,
  link_laboratorio          VARCHAR(500) DEFAULT '',
  principio_activo          VARCHAR(200) DEFAULT '',
  presentacion_optimizada   VARCHAR(200) DEFAULT '',
  keywords_ocultos          TEXT,
  bullets_atributos         TEXT,
  registro_isp              VARCHAR(50) DEFAULT '',
  estado                    ENUM('pendiente','optimizado','revisar') DEFAULT 'pendiente',
  notas                     TEXT,
  fecha_optimizacion        DATETIME DEFAULT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Índices para búsqueda rápida
  INDEX idx_subCategory (subCategory),
  INDEX idx_estado (estado),
  INDEX idx_principio_activo (principio_activo),
  INDEX idx_sku (sku),
  FULLTEXT INDEX idx_busqueda (fullName, principio_activo, sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de configuración del proyecto
CREATE TABLE IF NOT EXISTS config (
  key_name VARCHAR(50) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valores por defecto
INSERT IGNORE INTO config (key_name, value) VALUES
  ('meta_visitas', '150000'),
  ('visitas_actuales', '50000'),
  ('inicio_proyecto', '2026-05-25'),
  ('fee_mensual', '980000'),
  ('sprint_actual', '1');

-- Tabla de más vendidos (desde CSV de GA4 con SKU)
CREATE TABLE IF NOT EXISTS best_sellers (
  sku        VARCHAR(50) PRIMARY KEY,
  views      INT DEFAULT 0,
  cart_adds  INT DEFAULT 0,
  purchases  INT DEFAULT 0,
  revenue    DECIMAL(15,2) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
