# Tablero de Tareas (app local, sin backend)

Kanban + proyectos + hitos + Gantt + notas por proyecto + conexiones + intercambio con MS Project y Excel.

## Uso
1. Abre `index.html` en Chrome o Edge.
2. "Conectar carpeta" -> elige ESTA carpeta (la que contiene index.html) y acepta el permiso.
3. Trabaja: cada cambio se guarda en disco.

## Archivos
- index.html, styles.css, app.js (nucleo), conexiones.js (modulo Conexiones), intercambio.js (Project y Excel)
- data/config.json, data/proyectos/, data/tareas/, data/notas-generales.json, data/historial.json
- data/conexiones.json  -> tipos de conexion, sus campos y las conexiones (PASSWORDS EN TEXTO PLANO)
- recursos/<id>/ -> adjuntos

## Conexiones (Administracion > Conexiones)
- Tipos incluidos: Base de datos, API REST, SFTP/FTP, Nube (OCI/AWS/Azure), Correo SMTP.
- "Tipos y campos": agrega/edita/ordena campos (texto, numero, lista, secreto, URL, texto largo, casilla) y crea tipos nuevos.
- Los campos "secreto" se muestran enmascarados (ojo para ver, 📋 para copiar).

## Intercambio (Configuracion)
- Project: formato XML (MSPDI). En Project: Archivo > Guardar como > "XML". Proyecto = tarea resumen, hitos = hitos.
- Excel (.xlsx): hojas Proyectos, Tareas, Hitos, Notas (editable en Excel y reimportable).
- Importar actualiza por ID (o por titulo dentro del proyecto) y nunca elimina.
- Selector "Alcance" para exportar todo el tablero o un solo proyecto.

Sin dependencias externas: funciona sin internet.
