# Instalador automatizado del backend Fatboy POS

## Artefacto

```text
installer-out\FatboyPOSBackendSetup.exe
```

## Instalacion

Ejecuta el instalador como administrador. El usuario final no necesita instalar Node ni ejecutar scripts manuales.

El instalador copia el backend en:

```text
{autopf}\FatboyPOSBackend
```

## Flujo automatizado

1. Valida Windows x64 y permisos de administrador.
2. Copia backend compilado, `node.exe` portable, NSSM, Prisma CLI, migraciones y scripts bootstrap.
3. Detecta `DATABASE_URL` existente y lo reutiliza si la conexion real funciona.
4. Si PostgreSQL no es utilizable, instala/configura una instancia administrada por Fatboy POS.
5. Crea/actualiza `.env` del backend con `DATABASE_URL`, `JWT_SECRET`, `PORT` y rutas absolutas.
6. Ejecuta `prisma migrate deploy`.
7. Ejecuta seed compilado `dist\prisma\seed.js` si existe.
8. Reinstala el servicio `FatboyPOSBackend` con NSSM usando Node embebido.
9. Valida que el servicio quede `Running` y que el backend responda en `http://127.0.0.1:3000/api`.

## Politica PostgreSQL

La configuracion se centraliza en:

```text
installer\bootstrap\fatboy-installer.config.ps1
```

Valores por defecto:

```text
Servicio PostgreSQL: fatboy-postgresql-x64-17
Host: 127.0.0.1
Puerto: 55432
Base de datos: fatboy_pos
Usuario app: fatboy_app
Superusuario: postgres
```

Si existe `installer\payload\postgresql\postgresql-17.9-1-windows-x64.exe`, se empaqueta como instalador offline. Si no existe, el bootstrap descarga ese instalador desde la URL configurada solo cuando PostgreSQL haga falta.

## Reinstalacion y actualizacion

Instalar encima es soportado. El bootstrap:

- mantiene la base de datos y `.env` si son funcionales
- vuelve a ejecutar migraciones
- elimina/recrea el servicio para corregir rutas anteriores
- deja logs en `{app}\logs`

## Desinstalacion

La desinstalacion detiene y elimina `FatboyPOSBackend`.

Por seguridad no elimina PostgreSQL ni borra la base de datos.
