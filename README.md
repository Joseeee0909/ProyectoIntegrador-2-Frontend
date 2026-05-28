# Proyecto Integrador 2 - Frontend

Frontend en React + TypeScript + Vite para el sistema de autenticación y perfil del proyecto integrador. La app consume el backend desplegado en Render y usa Firebase para el flujo de sesión y Google Sign-In.

## Funcionalidades

- Registro manual con validación de nombre, username, correo, avatar y contraseña.
- Inicio de sesión con correo y contraseña.
- Inicio de sesión con Google y completado de perfil si falta username.
- Edición de perfil de usuario autenticado.
- Validación de disponibilidad de username y correo contra el backend.
- Persistencia de sesión en Firebase y estado local.

## Tecnologías

- React 19
- TypeScript
- Vite
- Firebase Auth y Firestore
- React Router
- Tailwind CSS
- Lucide React

## Requisitos

- Node.js 18 o superior.
- Una cuenta/proyecto de Firebase configurado.
- Acceso al backend desplegado o local.

## Instalación

```bash
npm install
```

## Configuración

Configura las variables de entorno de Vite en tu entorno local según el backend y Firebase que uses.

## Scripts

```bash
npm run dev
```

Arranca el servidor de desarrollo.

```bash
npm run build
```

Compila el proyecto para producción.

```bash
npm run lint
```

Ejecuta ESLint sobre el código fuente.

```bash
npm run preview
```

Sirve localmente la versión compilada.

## Flujo de autenticación

### Registro manual

1. El formulario valida los campos en el cliente.
2. El frontend consulta `GET /api/auth/check-email` y `GET /api/auth/check-username`.
3. Luego envía `POST /api/auth/register` con:

```json
{
  "names": "Ana",
  "lastNames": "Soto",
  "username": "anastudy",
  "avatar": "https://...",
  "email": "ana@example.com",
  "password": "Password123"
}
```

### Login manual

1. Se envía `POST /api/auth/login` con `email` y `password`.
2. Si el backend responde correctamente, la app guarda la sesión y redirige al dashboard.

### Google Sign-In

1. Firebase abre el popup de Google.
2. El frontend envía el `idToken` a `POST /api/auth/google`.
3. Si el backend responde que falta username, la app navega a la pantalla de completado.
4. Para finalizar, se llama `POST /api/auth/google/complete` con `Authorization: Bearer <firebaseIdToken>` y `{ "username": "..." }`.


## Estructura principal

```bash
src/
├── auth/
├── components/
│   ├── auth/
│   ├── dashboard/
│   └── profile/
├── services/
├── App.tsx
├── main.tsx
└── index.css
```

## Problemas conocidos

- Los avisos de `Cross-Origin-Opener-Policy` al usar Google pueden aparecer en el navegador; normalmente no bloquean el flujo, pero dependen de la configuración del hosting.
- Si el backend devuelve `500` en Google, el problema está en el servidor, no en el formulario.

## Desarrollo

Para correr la app en local:

```bash
npm run dev
```

Luego abre la URL que muestra Vite, normalmente `http://localhost:5173`.

## Notas

- La app mantiene una capa de estado local para ayudar en el flujo de auth, pero la fuente real de verdad sigue siendo Firebase y el backend.
- Si cambias rutas o contrato del backend, actualiza `src/auth/mockAuth.ts` para mantenerlo sincronizado.
