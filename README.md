# Panel privado de trading

Aplicación de una sola cuenta para registrar operaciones, posiciones y notas. La página se sirve desde Cloudflare Pages. Las cuentas, sesiones y registros se guardan en Cloudflare D1.

## Antes de cambiar de alojamiento

La página actual de GitHub Pages y la nueva URL de Cloudflare Pages tienen orígenes distintos. El navegador no comparte los datos locales entre esas direcciones.

1. Abre la página actual de GitHub Pages.
2. Ve a Configuración y descarga un respaldo JSON.
3. Conserva el archivo en un lugar seguro. No contiene correo ni contraseña.
4. Sigue la instalación y luego restaura el archivo en la nueva página de Cloudflare.

No fusiones esta rama en `main` mientras el repo siga desplegado por GitHub Pages. GitHub Pages no ejecuta los endpoints de `functions/`.

## Requisitos

- Cuenta de Cloudflare con Pages y D1 disponibles.
- Node.js y npm.
- Wrangler CLI.
- Un correo para la cuenta y una contraseña de al menos 12 caracteres.

## Crear la base D1

Desde la raíz del repo:

```sh
npx wrangler login
npx wrangler d1 create jonathan-trading-panel
```

Copia el `database_id` que devuelve Wrangler y reemplaza `REPLACE_WITH_D1_DATABASE_ID` en `wrangler.toml`.

Aplica el esquema:

```sh
npx wrangler d1 migrations apply jonathan-trading-panel --remote
```

## Crear el proyecto de Pages

Crea un proyecto Cloudflare Pages conectado al repo, con raíz `/`, comando de compilación vacío y salida `.`. Usa primero la rama `feature/cloudflare-auth-storage` para probarla como preview. Asegura que la vinculación D1 `DB` apunte a la base creada.

También puedes desplegar desde la carpeta local:

```sh
npx wrangler pages project create jonathan-trading-panel
npx wrangler pages deploy . --project-name jonathan-trading-panel
```

La URL será `https://jonathan-trading-panel.pages.dev`, salvo que Cloudflare asigne otro subdominio.

## Crear la primera cuenta

Genera un token de configuración que no hayas usado en otro sitio:

```sh
openssl rand -hex 32
```

Guárdalo como secreto en Pages:

```sh
npx wrangler pages secret put SETUP_TOKEN --project-name jonathan-trading-panel
```

Al pedirlo, pega el token generado. Abre la URL de Pages y configura correo y contraseña. Solo se admite una cuenta y el servidor cierra el alta después de crearla. Luego elimina el secreto `SETUP_TOKEN` de la configuración de Pages.

No compartas el token ni lo guardes en archivos del repo.

## Probar localmente

```sh
npm test
npx wrangler pages dev .
```

Prueba el acceso inicial, inicio de sesión, cambio de contraseña, crear y eliminar registros, cerrar sesión, exportar el JSON y restaurarlo. Para una prueba real, Pages debe tener la vinculación D1 y el secreto configurados.

## Operación y respaldo

- El endpoint `/api/auth` administra el alta inicial, el inicio/cierre de sesión y el cambio de contraseña.
- El endpoint `/api/data` guarda un conjunto de operaciones, posiciones y notas por usuario. El alta es de una sola cuenta.
- Las sesiones duran siete días y usan cookie `HttpOnly`, `Secure` y `SameSite=Strict`.
- Las contraseñas se derivan con PBKDF2-SHA-256 y salt aleatorio.
- El sitio limita intentos de autenticación por IP.
- Descarga respaldos JSON desde Configuración. D1 no está configurado aquí con una política automática de respaldo.
- Si pierdes la contraseña, no hay recuperación por correo. La contraseña puede cambiarse desde Configuración mientras exista una sesión válida.
- Antes de usar el panel con datos reales, configura respaldos de D1 desde Cloudflare y verifica la restauración.

## Límites conocidos

La primera cuenta requiere el token secreto de Cloudflare. La plataforma no envía correos de verificación ni de recuperación. La publicación en GitHub Pages no ejecuta las funciones de servidor, así que el alojamiento final debe ser Cloudflare Pages.
