# Fatboy POS - Punto de Venta para Windows

Sistema de Punto de Venta (POS) moderno y optimizado para Windows, con arquitectura desacoplada (Backend, Frontend y Desktop) e integración de impresión ESC/POS.

## 🚀 Guía de Inicio Rápido

### Prerrequisitos
- **Node.js**: v18 o superior.
- **PostgreSQL**: Instancia local configurada.

### Instalación Completa
1. Clonar el repositorio.
2. Instalar dependencias en todos los módulos:
   ```bash
   npm run install:all
   ```
3. Configurar el archivo `.env` en la carpeta `backend/` con tus credenciales de base de datos.
4. Inicializar la base de datos:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma db seed
   ```

## 🛠️ Comandos de Desarrollo

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia Backend, Frontend y Electron simultáneamente. |
| `npm run backend` | Inicia solamente el servicio NestJS. |
| `npm run frontend` | Inicia el servidor de desarrollo Vite. |
| `npm run desktop:dev` | Inicia el entorno completo con recarga en caliente de Electron. |

## 📦 Producción y Despliegue

Para generar los instaladores del sistema:
1. **Generar Ejecutable Desktop**: `npm run desktop:exe`
2. **Generar Instalador Backend**: `npm run backend:installer`

## 📂 Documentación Adicional
- [Documentación de la API](API_DOCUMENTATION.md)
- [Guía de Instalación del Backend](BACKEND_INSTALLER_GUIDE.md)

---
© 2026 Fatboy POS. Todos los derechos reservados.
