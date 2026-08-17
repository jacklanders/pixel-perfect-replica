# Jack v2 — Fase 2 (maqueta)

## Backup de la v1

El código ya se guarda automáticamente en cada cambio y se sincroniza con el repo conectado (`jacklanders/cv_ai_proyect`), así que la maqueta actual queda respaldada tal cual está. Para dejarlo explícito:

- Crear `CHANGELOG.txt` en la raíz con el detalle versionado que pide el prompt:
  - `v1.0` — Landing, Login, Perfil, Editor de CV con Jack, Mis CVs (todo con datos simulados).
  - `v2.0` — Fase 2: postulaciones y envío de mail (maqueta).
- A partir de acá, cada bloque nuevo se anota en ese archivo antes de avanzar.

Si querés un punto de restauración visual, también podés marcarlo desde el historial de versiones de Lovable.

## Qué falta del prompt (Fase 2)

Todo Fase 2 está sin construir. En esta versión se hace solo la interfaz, con datos de ejemplo y envío simulado.

### 1. Nueva sección "Postulaciones" (`/postulaciones`)

Listado/historial de vacantes trabajadas con estado: **Enviada**, **Descartada** (con motivo) o **Pendiente** (falta confirmación del usuario). Filtros por estado, buscador, y acceso al detalle de cada una.

### 2. Cargar aviso (`/postulaciones/nueva`)

- Pegar el texto del aviso o subir una imagen/captura (drag & drop, parseo simulado).
- Panel de "datos extraídos por Jack": puesto, empresa, ubicación, mail de contacto, requisitos excluyentes, fecha de vigencia.
- Avisos de Jack según las reglas del prompt:
  - Alerta cuando el perfil no cumple un requisito excluyente (con opción de continuar igual o descartar con motivo).
  - Preguntas cuando falta información (vehículo propio, mudanza, liderazgo) antes de generar el mail.
  - Aviso de aviso vencido, con opción de generar igual.

### 3. Generador de mail (`/postulaciones/$id`)

- Selector de **asunto**: botón "genérico de Jack" y, si el aviso pide uno exacto, ambos visibles para elegir.
- Campos: origen (fijo, el mail de registro), destino, cuerpo generado, CCO automático al propio mail.
- Botón de copiar en cada campo.
- Adjuntar CV: elegir una de las versiones guardadas en "Mis CVs" o subir PDF/Word.
- Firma de mail tomada del Perfil, editable.
- Botón "Enviar" simulado: muestra confirmación y pasa la postulación a estado _Enviada_.
- Contador freemium: 2 mails por día, con estado de límite alcanzado (sin cobro real).

### 4. Ajustes en lo ya hecho

- Sumar "Postulaciones" al menú lateral del AppShell.
- Enlazar el contador de uso diario del sidebar con el límite de postulaciones.
- Enlace desde "Mis CVs" para usar una versión en una postulación.

## Notas técnicas

- Rutas nuevas: `src/routes/postulaciones.index.tsx`, `postulaciones.nueva.tsx`, `postulaciones.$id.tsx` (con `postulaciones.tsx` como layout con `<Outlet />`).
- Datos simulados en un módulo compartido (`src/lib/mock-postulaciones.ts`) para que después sea directo reemplazarlo por la base de datos real.
- Estado en memoria con React; sin backend, sin login real, sin envío de mail.
- `head()` propio por ruta con título y descripción específicos.
- Mismo sistema de diseño y componentes shadcn ya usados.

## Fuera de alcance de esta versión

Login real con Google, base de datos, API de Claude, envío por Gmail, panel de administrador, búsqueda automática de avisos (Fase 3) y monetización (Fase 9). Se conectan en un paso posterior sobre esta misma maqueta.
