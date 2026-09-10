-- =========================================================
-- Datos de ejemplo — DAN Propiedades
-- Opcional: pega esto en el SQL Editor DESPUÉS de schema.sql
-- si quieres ver el catálogo funcionando con propiedades de
-- muestra. Bórralas o edítalas desde el panel privado cuando
-- cargues tus propiedades reales (los títulos dicen "EJEMPLO"
-- a propósito para que nunca se confundan con datos reales).
-- =========================================================

insert into propiedades
  (titulo, tipo, comuna, region, direccion, terreno_m2, superficie_construida_m2, dormitorios, banos, estacionamientos, precio_uf, descripcion, caracteristicas, fotos, portada, publicada, destacada)
values
(
  'EJEMPLO — Casa con quincho, reemplázame',
  'Casa', 'Los Ángeles', 'Biobío', 'Sector Santa Fe',
  320, 145, 4, 3, 2, 3800,
  'Esta es una propiedad de ejemplo para que veas cómo se muestra la ficha técnica. Edítala o elimínala desde el panel privado y reemplázala por tus propiedades reales.',
  ARRAY['Quincho','Bodega','Cocina amoblada'],
  ARRAY['data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27800%27%20height%3D%27600%27%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20fill%3D%27%23E9EEF2%27/%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27sans-serif%27%20font-size%3D%2740%27%20fill%3D%27%23565F68%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EEJEMPLO%20%E2%80%94%20Casa%3C/text%3E%3C/svg%3E'],
  'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27800%27%20height%3D%27600%27%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20fill%3D%27%23E9EEF2%27/%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27sans-serif%27%20font-size%3D%2740%27%20fill%3D%27%23565F68%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EEJEMPLO%20%E2%80%94%20Casa%3C/text%3E%3C/svg%3E',
  true, true
),
(
  'EJEMPLO — Departamento céntrico, reemplázame',
  'Departamento', 'Concepción', 'Biobío', 'Barrio Universitario',
  null, 62, 2, 1, 1, 2450,
  'Segunda propiedad de ejemplo, para probar los filtros por tipo y comuna. Recuerda subir una foto real desde el panel al crear tus propias propiedades.',
  ARRAY['Bodega','Amoblado'],
  ARRAY['data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27800%27%20height%3D%27600%27%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20fill%3D%27%23DCE7EA%27/%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27sans-serif%27%20font-size%3D%2740%27%20fill%3D%27%2316323E%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EEJEMPLO%20%E2%80%94%20Depto.%3C/text%3E%3C/svg%3E'],
  'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27800%27%20height%3D%27600%27%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20fill%3D%27%23DCE7EA%27/%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27sans-serif%27%20font-size%3D%2740%27%20fill%3D%27%2316323E%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EEJEMPLO%20%E2%80%94%20Depto.%3C/text%3E%3C/svg%3E',
  true, true
),
(
  'EJEMPLO — Parcela con vista, reemplázame',
  'Parcela', 'Chillán', 'Ñuble', 'Camino a Coihueco km 8',
  5000, null, null, null, null, 5200,
  'Tercera propiedad de ejemplo. Cuando cargues tus propiedades reales puedes dejar campos como dormitorios o superficie construida vacíos si no aplican (por ejemplo, en un terreno).',
  ARRAY['Vista despejada','Pozo propio'],
  ARRAY['data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27800%27%20height%3D%27600%27%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20fill%3D%27%23FBE7D6%27/%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27sans-serif%27%20font-size%3D%2740%27%20fill%3D%27%23C96A22%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EEJEMPLO%20%E2%80%94%20Parcela%3C/text%3E%3C/svg%3E'],
  'data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27800%27%20height%3D%27600%27%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20fill%3D%27%23FBE7D6%27/%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27sans-serif%27%20font-size%3D%2740%27%20fill%3D%27%23C96A22%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EEJEMPLO%20%E2%80%94%20Parcela%3C/text%3E%3C/svg%3E',
  true, false
);
