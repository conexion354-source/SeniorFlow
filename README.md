# Mundo Led Control

Este ZIP contiene la web app base con tu logo como ícono.

## Antes de publicar
1. Editá `firebase-config.js` y completá los datos reales de Firebase.
2. En Firebase Authentication activá Email/Password.
3. En Firestore usá reglas de prueba para usuarios autenticados.

## Reglas sugeridas de Firestore
```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
