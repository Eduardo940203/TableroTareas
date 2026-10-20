# Estructura v15

- index.html: entrada; mantener en la raíz.
- js/app.js: almacenamiento, router y vistas base.
- js/conexiones.js: conexiones.
- js/intercambio.js: XML, Excel y ZIP.
- js/presentaciones-base.js: plantilla PPTX y enlace inicial con las vistas.
- js/project.js: Gantt jerárquico e importador Project, en su orden original.
- js/presentaciones.js: dependencias y generador actual integrados en su orden original.
- js/mejoras.js: correcciones PPTX y desplegables por columna.
- css/styles.css: las tres hojas en el orden original.
- docs/README.md: instrucciones originales.
- docs/CHANGELOG.md: historial conservado.
- data/ y recursos/: sin cambios.

Los scripts continúan siendo scripts clásicos, no módulos ES. Las referencias internas y las funciones globales se conservan. Esta consolidación conserva también listeners y observadores: no elimina código activo por parecer antiguo.
