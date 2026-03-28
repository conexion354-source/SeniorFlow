SeniorFlow - paquete corregido

Contenido principal:
- index.html
- app.js
- style.css
- firebase-config.js
- manifest.json
- sw.js
- icons/
- img/

Cambios incluidos:
- PWA instalable con manifest, service worker e íconos locales.
- Ventas:
  - cuenta corriente oculta medios de cobro
  - botón "Guardar venta y cliente"
  - historial con búsqueda por texto, día, mes, año y rango de fechas
  - editar, eliminar y generar ticket imagen
- Gastos:
  - categorías fijas pedidas
  - detalle/aclaración
  - editar y eliminar
- Stock:
  - categorías
  - unidad / kilos / metros / litros
  - cancelar creación/edición
  - exportar lista PDF por categorías con costo, precio final y descripción
- Cuentas corrientes:
  - buscador
  - ver saldo y movimientos
  - exportar imagen o PDF
  - eliminar cuenta
- Presupuestos:
  - búsqueda por cliente o fechas
  - editar
  - compartir PDF o imagen
  - estados Enviado / Aprobado en verde
  - cliente manual o cliente cargado
  - ítems desde stock o manuales
- Todo el sistema:
  - texto debajo de importes escritos
  - vendedor sin acceso a Inicio, Presupuestos y Usuarios

Nota importante:
- El punto "importar lista en PDF" quedó implementado como EXPORTAR lista PDF desde el stock.
  Interpreté que necesitabas generar la lista de productos en PDF separada por categorías.
  Si querés que además lea un PDF externo y cargue productos automáticamente, eso requiere
  desarrollar un importador según el formato exacto de tu PDF.

Subida:
- reemplazá los archivos del repo por los de este paquete y volvé a publicar GitHub Pages.
