# Tablero de Tareas v7 - Gantt jerarquico editable

## Instalacion del paquete de actualizacion
Este paquete NO contiene la aplicacion completa. Aplicar sobre una copia de v5 o v6, que incluya Conexiones, Intercambio, Presentaciones e import-project-v5.js. Copiar index.html, gantt-v7.js y gantt-v7.css en la raiz. No reemplazar data/ ni recursos/. Respaldar primero toda la carpeta.

## Uso
Reimportar el XML para recuperar las fechas, duracion original y jerarquia de las fases. Se mantienen los IDs de v5. Las tareas anteriores sin UID no se reconcilian automaticamente.
El Gantt abre con fases contraidas. Filtrar rama, buscar, expandir, limitar profundidad, cambiar escala o ajustar a seleccion. Pulsar una fase para editarla; el formulario de tareas incorpora Fase / subfase. Crear fases y subfases con el boton superior. No se permiten ciclos ni eliminar una fase que contenga elementos.

## Avance y fechas
Por defecto el avance se calcula como actividades terminadas / total de actividades descendientes, incluidas archivadas, sin contar fases ni hitos. Se puede alternar con el porcentaje original Project en fases. El porcentaje mostrado en las actividades corresponde a su estado del tablero.
La barra usa fechas, no un motor de calendario laboral. La duracion importada es informativa y se etiqueta como original Project. Modificar una fase no desplaza automaticamente sus tareas. No se implementan dependencias, ruta critica ni arrastre de barras; se editan fechas en formularios.

## Reimportacion
Se conservan por defecto los campos de fechas, fase, proyecto y estado editados localmente con esta version. Si existen cambios locales se pregunta expresamente si deben reemplazarse. Las fases manuales se conservan. Los cambios realizados antes de v7 no tienen marca local y no pueden distinguirse automaticamente. La escritura es por registro, sin transaccion global; se mantiene el respaldo y verificacion de v5.

## Compatibilidad
Fases en proyectos[].fases; vinculacion mediante tareas[].faseId e hitos[].faseId. El JSON y la copia de carpeta conservan la estructura completa. Los exportadores existentes de Project, Excel y PowerPoint mantienen su formato anterior: esta version no agrega la jerarquia completa a esas exportaciones.

## Pruebas
Pruebas aisladas en Chromium del modulo v7, con dependencias de Store/FS/importador v5 simuladas. XML del usuario: 295 actividades, 7 hitos, 100 fases, 8 fases visibles inicialmente y 402 filas al expandir. Se verificaron preservacion de cambios al reimportar, modo reemplazar, creacion manual, rechazo de ciclos y selector en formulario de tareas. El XML no se incluye en este paquete ni se publica. Pendiente prueba integral con la aplicacion real y la carpeta del usuario.
