# Mundo Led Control

## Qué incluye
- Instalación como app (PWA)
- Logo e ícono usando la imagen ML
- Login de administración y vendedor con usuario + contraseña
- Inicio solo para administración
- Mensajes rápidos visibles para todos
- Ventas con Remito X, Factura A y Factura B
- Cuenta corriente con clientes, cobros y captura
- Gastos con Insumos Negocio, Fletes y Sueldos
- Stock con categorías y ranking de bajo stock
- Usuarios con roles administrador / vendedor

## IMPORTANTE SOBRE FIREBASE
Esta app usa:
- Firebase Authentication con **Anonymous** habilitado
- Firestore Database

### 1) Configurar firebase-config.js
Pegá tu config real de Firebase.

### 2) Authentication
En Firebase > Authentication > Sign-in method:
- activar **Anonymous**

### 3) Firestore rules
Usá estas reglas:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}

### 4) Primer administrador
Si todavía no hay ningún admin creado:
- entrá por la pestaña "Administración"
- poné usuario y contraseña
- el primer ingreso crea ese administrador

Después ya podés entrar a Usuarios y crear vendedores y más administradores.

## Instalación PWA
Subí todos los archivos a GitHub Pages o cualquier hosting HTTPS.
Cuando el navegador detecte que puede instalarse, aparece el botón "Instalar app".

## Notas
- Las fotos del cheque quedan preparadas en el formulario, pero esta versión no sube imágenes a Firebase Storage.
- Las contraseñas de usuarios se guardan hasheadas con SHA-256 del lado cliente.
