# Reglas del Proyecto (MenuQR Pro)

Este proyecto está diseñado para ser desplegado de forma continua en **Coolify** en un VPS de **Vultr**, utilizando **PostgreSQL** como base de datos y un **Dockerfile** optimizado para Next.js.

## Restricciones y Guías de Desarrollo

1. **Persistencia de Archivos y Subidas**:
   - Todas las imágenes (logos, fotos de platos, códigos QR, etc.) subidas por los usuarios se deben guardar estrictamente dentro de la ruta `public/uploads/` (o ruta resuelta como `/app/public/uploads` en producción).
   - Nunca cambies el directorio de uploads a otro lugar fuera de `public/uploads`, ya que este directorio específico está configurado como volumen persistente en Coolify.

2. **Compatibilidad con PostgreSQL (Prisma)**:
   - Mantén la compatibilidad del esquema en `prisma/schema.prisma` utilizando tipos nativos que sean compatibles tanto con PostgreSQL en producción como con cualquier base de datos Postgres local.
   - No introduzcas dependencias ni funciones específicas de SQLite.
   - Cada cambio en el esquema debe ir acompañado de su migración correspondiente (`npx prisma migrate dev`).

3. **Configuración de Docker (Dockerfile)**:
   - No elimines ni alteres la fase de compilación del `Dockerfile` de forma que rompa la autogeneración de Prisma o la compilación standalone de Next.js.
   - El comando de inicio debe seguir ejecutando `npx prisma migrate deploy` antes del inicio del servidor para aplicar los cambios de base de datos de manera automática en Coolify.

4. **Variables de Entorno**:
   - Siempre lee la clave secreta, las credenciales del administrador y la URL de la base de datos desde `process.env` (por ejemplo, `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`).
   - Evita valores quemados (hardcoded) para entornos de desarrollo que puedan interferir en producción.
