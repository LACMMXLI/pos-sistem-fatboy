# Documentacion de la API Actualizada - Fatboy POS

Este documento refleja el estado real y actualizado de los endpoints disponibles en el backend de Fatboy POS, incluyendo los módulos de fidelización, nómina, checador digital y el nuevo centro de plantillas de impresión.

---

## 🔐 Autenticación y Acceso

- **Swagger UI**: `http://localhost:3000/api/docs`
- **Prefijo global**: `/api`
- **Autenticación**: JWT mediante Header `Authorization: Bearer <TOKEN>`.

### Endpoints

- `POST /auth/login`: Login general (Admin/Cajero).
- `POST /auth/waiter-pin-login`: Login por PIN para Meseros.

---

## 📦 Órdenes y POS

### Órdenes (`/orders`)

- `POST /`: Crear orden (`DINE_IN`, `TAKE_AWAY`, `DELIVERY`).
- `GET /open`: Lista de cuentas abiertas.
- `GET /active`: Lista de pedidos en preparación.
- `PATCH /:id/items`: Agregar productos a una orden existente.
- `PATCH /:id/status`: Cambiar estado (IN_PROGRESS -> READY -> CLOSED).
- `POST /:id/print`: Solicitar impresión de cuenta.
- `POST /maintenance/clear-all`: **[ADMIN]** Borrado total de historial de órdenes.

### Pagos (`/payments`)

- `POST /`: Registrar pago (Soporta múltiples monedas y métodos).
- `GET /order/:orderId`: Consultar pagos de una orden.

---

## 👥 Empleados y Nómina

### Gestión de Empleados (`/employees`)

- `GET /`: Listar todos los empleados operativos.
- `GET /basic-list`: Lista simplificada para el Checador Digital.
- `POST /`: Crear nuevo empleado.
- `PATCH /:id`: Editar datos del empleado.

### Checador y Control de Asistencia

- `GET /:id/attendance`: Historial de entradas/salidas.
- `POST /:id/attendance`: Registrar entrada, salida y horas extra.

### Libro Mayor (Descuentos y Adelantos)

- `GET /:id/ledger`: Ver historial de movimientos financieros del empleado.
- `POST /:id/ledger/advance`: Registrar adelanto de sueldo (Caja).
- `POST /:id/ledger/debt`: Registrar deuda manual (Faltantes, etc).
- `POST /:id/ledger/consumption`: Registrar consumo interno de alimentos.

### Nóminas (`/payrolls`)

- `GET /`: Historial de nóminas cerradas.
- `GET /employees/:id/payroll-preview`: Previsualizar nómina actual (Cálculo de horas vs descuentos).
- `POST /employees/:id/payrolls/close`: Saldar y cerrar periodo de nómina.
- `PATCH /:id/mark-paid`: Marcar una nómina como liquidada físicamente.

---

## 💎 Fidelización (Loyalty)

- `POST /customers/find-or-create`: Buscar cliente por teléfono; si no existe, lo crea automáticamente.
- `GET /customers/phone/:phone`: Obtener perfil de puntos por teléfono.
- `GET /customers/:id/points`: Consultar saldo actual de puntos.
- `POST /loyalty/redeem`: Canje directo de puntos (Descuento monetario).
- `POST /loyalty/redeem-product`: Canje de puntos por un producto específico (Vale por producto).

---

## 🖨️ Centro de Impresión

### Plantillas (`/print-templates`)

- `GET /types`: Documentos soportados (Ticket, Comanda, Reporte de Turno, Nómina).
- `GET /`: Listar plantillas guardadas.
- `POST /`: Crear nueva configuración de diseño.
- `PATCH /:id`: Editar diseño de secciones, fuentes y alineación.
- `POST /:id/duplicate`: Clonar una plantilla existente.
- `POST /:id/activate`: Establecer como plantilla por defecto para un ancho de papel (58mm/80mm).
- `POST /preview`: Generar vista previa en texto RAW basada en datos reales o mock.

### Trabajos de Impresión (`/print-jobs`)

- `GET /`: Monitorear estado de la cola de impresión.
- `POST /reprint/:id`: Reintentar o duplicar un ticket fallido.

---

## 📊 Reportes y Auditoría (`/reports`)

- `GET /sales`: Historial detallado de ventas con filtros por fecha, turno o término de búsqueda.
- `GET /summary`: Resumen ejecutivo diario o por turno específico (Métricas de ventas, productos top, etc).

---

## 🔌 Integraciones Externas (`/external-orders`)

- `POST /`: Recibir pedidos de WhatsApp (Vía Addon) u otras fuentes externas.
- `GET /`: Monitorear pedidos pendientes de integración al POS.
- `PATCH /:id/status`: Vincular o rechazar pedidos externos.

---
© 2026 Fatboy POS - Documentación técnica actualizada.
