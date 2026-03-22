# MundoLED Control

Web app instalable para control interno del negocio.

## Incluye
- Login con Firebase Authentication
- Roles por colección `users`
- Caja con cierre automático del día
- Ventas resumidas
- Gastos
- Stock de mercadería
- Cuentas corrientes con saldo automático
- PWA instalable
- Lista para GitHub Pages

## Estructura sugerida en Firestore

### users/{uid}
```json
{
  "name": "Administrador",
  "email": "admin@empresa.com",
  "role": "admin",
  "active": true
}
```

### sales
```json
{
  "amount": 120000,
  "paymentMethod": "transferencia",
  "client": "Cliente ejemplo",
  "reference": "Pedido 1001",
  "userName": "Admin",
  "dateKey": "2026-03-22"
}
```

### expenses
```json
{
  "amount": 25000,
  "category": "Flete",
  "paymentMethod": "efectivo",
  "detail": "Viaje proveedor",
  "userName": "Admin",
  "dateKey": "2026-03-22"
}
```

### cash_movements
```json
{
  "type": "apertura",
  "amount": 50000,
  "detail": "Apertura turno mañana",
  "userName": "Admin",
  "dateKey": "2026-03-22"
}
```

### products/{codigo}
```json
{
  "code": "LAMP001",
  "name": "Lámpara LED 20W",
  "category": "Iluminación",
  "quantity": 35,
  "minStock": 8,
  "cost": 5000
}
```

### account_movements
```json
{
  "client": "Municipalidad X",
  "type": "cargo",
  "amount": 180000,
  "detail": "Factura cargada en sistema principal",
  "userName": "Admin",
  "dateKey": "2026-03-22"
}
```

## Pasos para publicar
1. Crear repositorio en GitHub.
2. Subir todos los archivos.
3. Editar `firebase-config.js` con tus credenciales.
4. En Firebase habilitar Authentication > Email/Password.
5. Crear Firestore en modo producción o prueba.
6. Crear el primer usuario en Authentication.
7. Crear documento `users/UID` con rol `admin`.
8. Activar GitHub Pages desde la rama principal.

## Roles sugeridos
- `admin`: acceso total
- `encargado`: dashboard, ventas, gastos, caja, stock, cuentas
- `caja`: ventas y caja
- `stock`: stock y dashboard

## Reglas de Firestore
Ajustalas a tu negocio. Se recomienda permitir lectura/escritura solo a usuarios autenticados con documento activo en `users`.
