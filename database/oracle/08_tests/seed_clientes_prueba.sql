-- =============================================================================
-- Clientes de PRUEBA con NIT válido para la SAT simulada (30 registros).
-- CLIENTE es una tabla externa del ERP: ajusta ESTADO y agrega las columnas
-- obligatorias que falten según DESC CLIENTE. Los NIT son ficticios.
-- No duplica: omite los NIT que ya existen.
-- =============================================================================
INSERT INTO CLIENTE (NOMBRE, NIT, ESTADO)
SELECT t.NOMBRE, t.NIT, 'ACTIVO'
  FROM (
    SELECT 'Distribuidora Central, S.A.' AS NOMBRE, '1100001-5' AS NIT FROM DUAL UNION ALL
    SELECT 'Comercial Los Pinos, S.A.' AS NOMBRE, '1100008-2' AS NIT FROM DUAL UNION ALL
    SELECT 'Ferretería El Tornillo' AS NOMBRE, '1100015-5' AS NIT FROM DUAL UNION ALL
    SELECT 'Servicios Maya, S.A.' AS NOMBRE, '1100022-8' AS NIT FROM DUAL UNION ALL
    SELECT 'Agroexport Guatemala, S.A.' AS NOMBRE, '1100029-5' AS NIT FROM DUAL UNION ALL
    SELECT 'Farmacia La Salud' AS NOMBRE, '1100036-8' AS NIT FROM DUAL UNION ALL
    SELECT 'Constructora Altiplano, S.A.' AS NOMBRE, '1100043-0' AS NIT FROM DUAL UNION ALL
    SELECT 'Papelería y Útiles El Estudiante' AS NOMBRE, '1100050-3' AS NIT FROM DUAL UNION ALL
    SELECT 'Transportes Quetzal, S.A.' AS NOMBRE, '1100057-0' AS NIT FROM DUAL UNION ALL
    SELECT 'Supermercado La Economía' AS NOMBRE, '1100064-3' AS NIT FROM DUAL UNION ALL
    SELECT 'Panadería San José' AS NOMBRE, '1100071-6' AS NIT FROM DUAL UNION ALL
    SELECT 'Textiles Kaqchikel, S.A.' AS NOMBRE, '1100078-3' AS NIT FROM DUAL UNION ALL
    SELECT 'Importadora Pacífico, S.A.' AS NOMBRE, '1100085-6' AS NIT FROM DUAL UNION ALL
    SELECT 'Librería Universal' AS NOMBRE, '1100092-9' AS NIT FROM DUAL UNION ALL
    SELECT 'Hotel Casa Antigua, S.A.' AS NOMBRE, '1100099-6' AS NIT FROM DUAL UNION ALL
    SELECT 'Clínica Dental Sonrisa' AS NOMBRE, '1100106-2' AS NIT FROM DUAL UNION ALL
    SELECT 'Taller Mecánico Los Hermanos' AS NOMBRE, '1100113-5' AS NIT FROM DUAL UNION ALL
    SELECT 'Restaurante El Fogón' AS NOMBRE, '1100120-8' AS NIT FROM DUAL UNION ALL
    SELECT 'Tecnología y Redes, S.A.' AS NOMBRE, '1100127-5' AS NIT FROM DUAL UNION ALL
    SELECT 'Eléctricos del Norte, S.A.' AS NOMBRE, '1100134-8' AS NIT FROM DUAL UNION ALL
    SELECT 'Muebles Rústicos de Petén' AS NOMBRE, '1100141-0' AS NIT FROM DUAL UNION ALL
    SELECT 'Cafetalera Los Volcanes, S.A.' AS NOMBRE, '1100148-8' AS NIT FROM DUAL UNION ALL
    SELECT 'Ópticas Visión Clara' AS NOMBRE, '1100155-0' AS NIT FROM DUAL UNION ALL
    SELECT 'Gráficas Modernas, S.A.' AS NOMBRE, '1100162-3' AS NIT FROM DUAL UNION ALL
    SELECT 'Distribuidora de Lácteos Atitlán' AS NOMBRE, '1100169-0' AS NIT FROM DUAL UNION ALL
    SELECT 'Seguridad Total, S.A.' AS NOMBRE, '1100176-3' AS NIT FROM DUAL UNION ALL
    SELECT 'Lavandería Express' AS NOMBRE, '1100183-6' AS NIT FROM DUAL UNION ALL
    SELECT 'Veterinaria Mi Mascota' AS NOMBRE, '1100190-9' AS NIT FROM DUAL UNION ALL
    SELECT 'Panel y Vidrio, S.A.' AS NOMBRE, '1100197-6' AS NIT FROM DUAL UNION ALL
    SELECT 'Academia de Idiomas Global' AS NOMBRE, '1100204-2' AS NIT FROM DUAL
  ) t
 WHERE NOT EXISTS (SELECT 1 FROM CLIENTE c WHERE c.NIT = t.NIT);

COMMIT;

SELECT COUNT(*) AS CLIENTES_DE_PRUEBA FROM CLIENTE WHERE NIT IN ('1100001-5', '1100008-2', '1100015-5', '1100022-8', '1100029-5', '1100036-8', '1100043-0', '1100050-3', '1100057-0', '1100064-3', '1100071-6', '1100078-3', '1100085-6', '1100092-9', '1100099-6', '1100106-2', '1100113-5', '1100120-8', '1100127-5', '1100134-8', '1100141-0', '1100148-8', '1100155-0', '1100162-3', '1100169-0', '1100176-3', '1100183-6', '1100190-9', '1100197-6', '1100204-2');
