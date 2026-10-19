# Tablero de Tareas v5

## Importacion Project XML
- Identidad estable por GUID del archivo de origen + UID; no se fusionan titulos repetidos.
- Si no hay GUID se solicita una clave estable: reutilizarla para actualizar el mismo plan.
- Ruta completa de fases y subfases en projectOrigen y en la descripcion.
- Progreso, bloqueo de otra carga en la misma pestana e informe descargable.
- Validacion previa de UID y verificacion de tareas releyendo los JSON guardados.
- Antes de actualizar se respaldan los registros afectados en data/respaldos/. No incluye binarios.
- Escritura por registro, no transaccion atomica. Un reintento con el mismo origen/UID actualiza sin duplicar.

## Cargas antiguas
No se eliminan ni se reconcilian automaticamente las importaciones de versiones anteriores sin UID de origen. Se crea un proyecto separado con identidad estable. Respaldar la carpeta completa antes de importar; revisar el nuevo proyecto antes de retirar el antiguo manualmente.

## Validacion
Prueba en Chromium con XML proporcionado, sin incorporarlo al repositorio: 295 tareas, 7 hitos, 100 fases/subfases como ruta. Primera carga: 295 creadas. Segunda: 0 creadas y 295 actualizadas. Se probaron UID duplicados, cambio de titulo y fallo de escritura con reintento. Almacenamiento de prueba en memoria y filesystem privado del navegador; pendiente validacion en la carpeta local del usuario y en la aplicacion completa.

## Uso
Abrir esta version, conectar carpeta e importar desde Configuracion > Intercambio > Importar desde Project (XML). Revisar cantidades e informe final. Se conservan modulos de Conexiones, Excel y presentaciones de v4.
