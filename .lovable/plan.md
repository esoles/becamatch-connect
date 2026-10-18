# Plan: Flujo de postulación con IA (patrón Casas para Gatos, sin LinkedIn)

## Objetivo
Un visitante sin cuenta cuenta su situación en un formulario público; la IA interpreta su necesidad y recomienda becas reales de la tabla `scholarships` (sin inventar datos); el sistema genera un "plan de postulación" y lo envía por correo automáticamente; el admin ve las solicitudes en el panel.

## Cambios

### 1. Base de datos (1 migración)
- Tabla `postulation_requests`: id, full_name, email, request_text, ai_analysis (jsonb), recommended_scholarship_id → scholarships, status (`recibida`/`analizada`/`correo_enviado`/`error`), created_at.
- RLS: sin SELECT público; solo admins leen (policy con `has_role`). El insert lo hace una server function con cliente privilegiado tras validar, no desde el navegador.

### 2. Formulario público `/postular`
- Ruta pública nueva con `head()` propio. Campos: nombre, correo, y texto grande "Cuéntanos tu situación" (nivel, área, promedio, países, presupuesto…).
- Enlace visible desde la landing ("Quiero postular").
- Al enviar: mensaje "Gracias. Estamos preparando tu plan de postulación personalizado."

### 3. Server function `submitPostulation`
- Pública (sin auth) pero validada con zod y con límite básico (longitud mínima/máxima del texto, formato de email).
- Inserta la solicitud, llama a la IA de Lovable (gateway, modelo por defecto) con el texto + catálogo de becas vigentes (id, nombre, entidad, país, nivel, área, promedio mínimo, deadline, cobertura) y pide JSON estricto: `{ needs, recommended_scholarship_ids[] }` — solo IDs existentes; se descarta cualquier ID que no esté en la tabla.
- Genera el plan: becas recomendadas con sus datos reales (nombre, entidad, deadline, requisitos, documentos, enlace oficial) tomados de la DB, nunca del texto de la IA.
- Envía el correo automático y actualiza `status`.

### 4. Correo automático (app emails de Lovable)
- Prerequisito: dominio de correo configurado; si falta, se completa como parte del trabajo (scaffold de plantillas).
- Plantilla React Email `postulation-plan`: saludo, becas recomendadas con datos reales, pasos y documentos, enlace a la beca en BecaMatch.
- Envío desde la server function con `sendTemplateEmail` e `idempotencyKey` por solicitud. Un envío = un destinatario.

### 5. Panel admin
- Nueva pestaña "Solicitudes" en `/admin`: tabla con nombre, correo, extracto de la solicitud, becas recomendadas, estado y fecha. Solo lectura (sin CRM).

## Lo que NO se hace
- Nada de LinkedIn, tracking UTM, marketing, ni generación de imágenes.
- No se tocan el mazo, WhatsApp, compatibilidad ni roles existentes.
- Sin tablas ni pantallas extra (no CRM, no multi-rol).

## Verificación
- Migración aplicada y RLS comprobada.
- Envío de prueba end-to-end con una solicitud real y revisión del correo recibido.
- tsgo + build OK.
