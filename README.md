
# MundoLED Control

Web app instalable para control interno del negocio.

## Qué incluye
- Login con Firebase Authentication
- Roles de usuario
- Dashboard con cierre automático del día
- Ventas
- Gastos
- Stock
- Cuentas corrientes
- Movimientos de caja
- PWA instalable

## Firebase ya cargado
Este proyecto ya incluye la configuración que compartiste para:
- proyecto: `mundoledcontrol`

## Antes de usar
1. En Firebase activá **Authentication > Email/Password**.
2. En Firebase creá al menos un usuario en **Authentication > Users**.
3. En Firestore creá la base en **modo test**.
4. Publicá la carpeta en GitHub Pages.

## Estructura Firestore usada
- `ventas`
- `gastos`
- `stock`
- `cuentas_corrientes`
- `movimientos_caja`
- `users`

## Roles
- `admin`: acceso total
- `ventas`: ventas, gastos, cuentas y dashboard
- `stock`: stock y dashboard
- `consulta`: solo dashboard

## Primer admin
Por defecto, si iniciás con `admin@mundoled.com`, la app lo toma como admin.
Si querés cambiar eso, editá `ADMIN_EMAILS` en `app.js`.

## Publicación en GitHub
1. Subí todos los archivos al repositorio.
2. En GitHub: **Settings > Pages**
3. Elegí **Deploy from a branch**
4. Branch: `main` / carpeta raíz `/`
5. Guardá y esperá el link público.

## Nota
La gestión de usuarios se hace así:
- primero creás el usuario en Firebase Authentication
- después le asignás rol desde el módulo **Usuarios**
