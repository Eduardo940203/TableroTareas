# Historial de cambios

## TableroTareas-v16

- Ancho (px) editable por columna en Configuración > Columnas del tablero.
- Valores enteros de 200 a 1200 px; 300 px para configuraciones anteriores y columnas nuevas.
- Se guarda ancho junto con cada columna mediante Guardar columnas y se aplica al renderizar el tablero.
- Se conserva al editar, reordenar y añadir columnas; el lector mantiene propiedades adicionales.
- Se conserva el scroll horizontal y el arrastre existente. No modifica tareas, adjuntos, Gantt ni presentaciones.
- Pruebas automáticas: sintaxis JS, valores predeterminados, límites y serialización JSON. Pendiente: prueba visual y guardado real en navegador.

## TableroTareas-v15

Reorganización sin cambios funcionales intencionales. JavaScript en js/, estilos en css/ y documentación en docs/. Se conserva el orden de ejecución y de las reglas CSS; los módulos históricos de presentaciones se integran, no se descartan sus dependencias. Se elimina mejoras-v12.js no cargado por index.html. data/ y recursos/ no se modifican.

Validación automática: sintaxis JS, orden de carga, referencias locales y equivalencia del contenido concatenado. Pendiente: pruebas funcionales y visuales en navegador, importación/exportación y PowerPoint.

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


---

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


---

# TableroTareas-v13

- Actualiza RUTAS.proyecto, no solamente la función global vProyecto.
- Añade botón ＋ Mostrar tareas / − Ocultar tareas en la vista de proyecto y conserva ＋ Tarea.
- Colorea el fondo de las barras vencidas del PPTX en rojo incluso al 0%. No modifica el porcentaje real.
- Valida el XML de cada diapositiva antes de generar el ZIP y corrige el escape de textos.
- Conserva presentaciones-v11.js y sus niveles de fases/subfases, así como el Gantt jerárquico del sitio.
- Deja de cargar mejoras-v12.js; no elimina datos ni adjuntos.

Pendiente: validación visual en navegador y PowerPoint. No se ha realizado una prueba de extremo a extremo.


---

# TableroTareas-v14

- Sustituye el desplegable global de tareas del proyecto por un desplegable independiente por columna del tablero con tareas.
- Cada columna conserva su nombre y conteo, con botón ＋ Mostrar tareas / − Ocultar tareas.
- Las columnas empiezan contraídas; se recuerda su estado por proyecto y columna durante la sesión de la página.
- Conserva el botón ＋ Tarea y las acciones de las tareas.
- Mantiene mejoras-v13.js como dependencia para las correcciones de la presentación.
- No modifica datos ni adjuntos ni el Gantt jerárquico.

Pendiente: validación visual en navegador.

