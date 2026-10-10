# Becamatch Connect

<!-- V01 -->

# PROMPT 0 — MVP Base + Perfil

Estamos construyendo BecaMatch como MVP de presentación. Usa como fuente de verdad los SPEC y SKILL de BecaMatch disponibles en Knowledge.

OBJETIVO

Construir la base funcional mínima y el flujo Landing → Registro → Perfil → Mazo inicial.

IMPLEMENTA

- Landing mobile-first con CTA “Crear mi perfil”.

- Navegación básica.

- Persistencia/autenticación disponible; reutiliza infraestructura existente.

- Perfil: nombre, email, fecha de nacimiento, nivel, área, países de interés, idiomas CEFR, promedio 0–20, año de egreso.

- Estado de autorización parental para menores.

- Modelo de beca con al menos 5 datos demo estructurados.

- Etiqueta visible “Datos de demostración”.

- Compatibilidad determinística según SPEC.

- Muestra inicial ordenada por compatibilidad.

NO IMPLEMENTES

- Resend todavía.

- Cron.

- Admin completo.

- MCP.

- ML.

- Chat complejo.

ACEPTACIÓN

- Perfil guarda correctamente.

- Promedio solo acepta 0–20.

- Menor de 18 queda en estado de autorización correspondiente.

- Compatibilidad es reproducible.

- Se llega desde Landing hasta el mazo.

- Responsive correcto.

No hagas cambios fuera de este alcance.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://becamatch-connect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b2684883-d53f-45c8-8117-13684384a676).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
