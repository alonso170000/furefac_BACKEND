CREATE DATABASE IF NOT EXISTS furefac
  DEFAULT CHARACTER SET utf8mb4;
USE furefac;

CREATE TABLE roles (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(60) NOT NULL UNIQUE,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  usuario        VARCHAR(40)  NOT NULL UNIQUE,
  nombre         VARCHAR(80)  NOT NULL,
  apellido       VARCHAR(80)  NOT NULL,
  correo         VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  rol_id         BIGINT UNSIGNED NOT NULL,
  activo         TINYINT(1) NOT NULL DEFAULT 1,
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usr_rol FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE secciones (
  id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre    VARCHAR(60) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE rol_permisos (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  rol_id          BIGINT UNSIGNED NOT NULL,
  seccion_id      BIGINT UNSIGNED NOT NULL,
  puede_crear     TINYINT(1) NOT NULL DEFAULT 0,
  puede_editar    TINYINT(1) NOT NULL DEFAULT 0,
  puede_eliminar  TINYINT(1) NOT NULL DEFAULT 0,
  puede_reporte   TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_perm_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_perm_sec FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE CASCADE,
  UNIQUE KEY uk_perm (rol_id, seccion_id)
) ENGINE=InnoDB;

INSERT INTO roles (nombre) VALUES
('Superadmin');

INSERT INTO secciones (nombre) VALUES
('productos'), ('usuarios'), ('cotizaciones'), ('comentarios'), ('contactos'), ('buzon'), ('configuracion');

INSERT INTO usuarios (usuario, nombre, apellido, correo, password_hash, rol_id)
VALUES ('superadmin', 'Administrador', 'Principal', 'admin@furefac.com', 'hash_superseguro', 1);

CREATE TABLE categorias (
  id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre    VARCHAR(80) NOT NULL UNIQUE,
  slug      VARCHAR(100) UNIQUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE productos (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre          VARCHAR(150) NOT NULL,
  descripcion     TEXT,
  precio_mxn      DECIMAL(10,2) NOT NULL,
  categoria_id    BIGINT UNSIGNED NOT NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prod_nombre (nombre),
  INDEX idx_prod_cat (categoria_id),
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB;

CREATE TABLE producto_imagenes (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  producto_id  BIGINT UNSIGNED NOT NULL,
  ruta         VARCHAR(255) NOT NULL,
  orden        TINYINT UNSIGNED NOT NULL DEFAULT 1,
  creado_en    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_img_prod (producto_id),
  UNIQUE KEY uk_prod_img_orden (producto_id, orden),
  CONSTRAINT fk_img_prod FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cotizaciones (
  id                     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  producto_id            BIGINT UNSIGNED NULL,
  nombre_usuario         VARCHAR(120) NOT NULL,
  correo                 VARCHAR(120) NOT NULL,
  telefono               VARCHAR(30)  NOT NULL,
  descripcion            TEXT NOT NULL,
  producto_nombre_snap   VARCHAR(150),
  producto_precio_snap   DECIMAL(10,2),
  producto_categoria_snap VARCHAR(80),
  creado_en              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eliminado              TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_cot_fecha (creado_en),
  CONSTRAINT fk_cot_prod FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

CREATE TABLE cotizacion_imagenes (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  cotizacion_id  BIGINT UNSIGNED NOT NULL,
  ruta           VARCHAR(255) NOT NULL,
  orden          TINYINT UNSIGNED NOT NULL DEFAULT 1,
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cimg_cot (cotizacion_id),
  UNIQUE KEY uk_cot_img_orden (cotizacion_id, orden),
  CONSTRAINT fk_cimg_cot FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comentarios (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,
  correo      VARCHAR(120) NOT NULL,
  telefono    VARCHAR(30)  NOT NULL,
  comentario  TEXT NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eliminado   TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE contactos (
  id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nombre      VARCHAR(120) NOT NULL,
  numero      VARCHAR(30)  NOT NULL,
  correo      VARCHAR(120) NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE OR REPLACE VIEW vw_buzon_cotizaciones AS
SELECT
  c.id, c.creado_en AS fecha,
  c.nombre_usuario, c.telefono, c.correo, c.descripcion,
  p.nombre AS producto_nombre, p.precio_mxn AS producto_precio,
  cat.nombre AS categoria
FROM cotizaciones c
LEFT JOIN productos p   ON p.id = c.producto_id
LEFT JOIN categorias cat ON cat.id = p.categoria_id
WHERE c.eliminado = 0;

CREATE OR REPLACE VIEW vw_buzon_comentarios AS
SELECT
  id, creado_en AS fecha, nombre, telefono, correo, comentario
FROM comentarios
WHERE eliminado = 0;
