# AMC CONSTRUCCIONES · Proyecto completo

Web en español para materiales de construcción en Paraguay, basada en la imagen proporcionada. Incluye catálogo, búsqueda, categorías, orden por precio, detalle del producto, carrito, formulario de entrega, pedidos persistentes y asistente.

## Abrir en Windows

Doble clic en **INICIAR.cmd**. Inicia el servidor, espera a que la página esté lista y la abre directamente en tu navegador, sin copiar ni pegar el enlace. Si el sistema ya está funcionando, abre la página existente. La dirección predeterminada es http://127.0.0.1:3080; respeta el puerto configurado en `.env`. Mantené la ventana del servidor abierta; para terminar, presioná Ctrl+C. El lanzador utiliza el Node.js incluido en runtime. El paquete portátil es para Windows 10/11 x64. No requiere Codex ni paquetes adicionales.

En otra computadora Windows x64, extraé TODO el ZIP y ejecutá INICIAR.cmd. No copies únicamente el acceso directo .lnk. Para instrucciones completas, leé COMO-ABRIR.txt.

## Probar una compra

1. Elegí un material y agregalo al carrito.
2. Cambiá la cantidad y completá los datos de entrega con información ficticia.
3. Solicitá el pedido; aparece en Mis pedidos como pendiente de confirmación y no cobrado.

El servidor calcula precios y envío; ignora cualquier precio enviado por el navegador. Registra el pedido y descuenta stock dentro de una transacción. Los datos se guardan en `data/tienda.sqlite`; no borres esa carpeta si necesitás conservar pedidos. Cada pedido tiene un token privado guardado en el navegador: no compartas ese token. Los pedidos son visibles desde el navegador que los creó. No hay cuenta de usuario ni recuperación entre dispositivos.

## Asistente e IA

Sin clave: respuestas locales sobre 16 temas de construcción y compras, comparación de cemento y hormigón, consulta de precios, presupuestos por cantidades y cálculos de pintura y volumen de piso. Es un respaldo por reglas y conocimientos predefinidos, no un modelo de IA. No puede responder cualquier pregunta. Escribí “Pintura para 40 m²”, luego “¿Y para 80 m²?”, o “Presupuesto: 2 bolsas de cemento y 100 ladrillos”. Para el piso ingresá largo y ancho en metros y espesor en cm, en ese orden; también acepta mm. Las estimaciones muestran los supuestos y no sustituyen el diseño profesional.

El chat conserva los últimos 10 mensajes en memoria mientras la página permanezca abierta. “Nueva consulta” borra ese contexto. Al recargar se inicia una conversación nueva. No se escribe el historial de chat en la base de pedidos.

Para habilitar IA conversacional real:

1. Abrí `CONFIGURAR-IA.cmd`: crea `.env` si todavía no existe y lo abre para editar.
2. Configurá `OPENAI_API_KEY` con tu clave y `OPENAI_MODEL` con un modelo disponible en tu cuenta. El nuevo valor predeterminado es `gpt-4.1`; una configuración existente conserva el modelo que hayas elegido.
3. Guardá el archivo, cerrá el servidor anterior y volvé a ejecutar `INICIAR.cmd`.

La clave nunca se envía al navegador. Con la conexión habilitada se envían a OpenAI la consulta, los últimos 10 mensajes, el catálogo de ejemplo, los productos del carrito y la ciudad seleccionada, con `store:false`. No se envían nombre, teléfono, dirección ni tokens de pedidos. El uso puede generar costos en tu cuenta. Si falla el proveedor, se informa y se usa el respaldo local. La integración incluye más espacio para respuestas y contexto de conversación, siguiendo la [API Responses oficial](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create) y su [guía de conversación](https://developers.openai.com/api/docs/guides/conversation-state).

El modelo recibe instrucciones para resolver consultas variadas, pedir datos faltantes, comparar opciones y usar los precios del servidor. No navega por Internet ni realiza compras o modificaciones del carrito. Las respuestas del modelo pueden contener errores y deben verificarse. La conexión a OpenAI fue probada con un servicio simulado; falta la prueba real con una clave habilitada.

## Qué falta para vender al público

Esta entrega es un proyecto local funcional. Los productos, stock, tarifas y precios son de ejemplo; los cuatro primeros precios provienen de la referencia. Pintura y taladro se agregaron como ejemplos para completar las categorías. La longitud de la varilla no está confirmada. No se cobra dinero ni se envían pedidos a un comercio real. La transferencia y contraentrega se registran como preferencias, sin datos bancarios.

Antes de ponerlo en producción: reemplazar catálogo y tarifas, conectar una pasarela de pago con confirmación del servidor, agregar acceso administrativo, identidad de clientes, política de privacidad, respaldos y HTTPS. El servidor escucha únicamente en esta computadora por defecto. No lo expongas directamente a Internet como tienda pública.

## Archivos

- `public/`: interfaz y recursos; imágenes de productos mostradas como recortes visuales de la referencia proporcionada.
- `server.mjs`: servidor HTTP, base SQLite, pedidos y conexión opcional de IA.
- `asistente.mjs`: conversación con el modelo y conocimiento local de respaldo.
- `asistente.test.mjs` y `test.mjs`: pruebas del historial, integración simulada y tienda con base temporal; `npm test`.
- `.env.example`: configuración sin secretos.

No se necesita instalar librerías. Node.js 24 incluye SQLite. Para modificar el stock de ejemplo, hacelo antes del primer arranque en `public/catalogo.json`; una base existente conserva su stock y no se reemplaza al reiniciar.
