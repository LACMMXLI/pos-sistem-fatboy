# Documentacion de la API - Fatboy Restaurant POS

Referencia funcional resumida de los endpoints principales del sistema POS.

## Acceso

- Swagger UI: `http://localhost:3000/api/docs`
- JSON OpenAPI: `http://localhost:3000/api/docs-json`
- Prefijo global: `/api`
- Puerto por defecto: `3000`

## Autenticacion

### `POST /api/auth/login`

Inicia sesion y devuelve JWT.

Ejemplo:

```json
{
  "username": "usuario",
  "password": "password123"
}
```

## Reglas globales clave

- Los endpoints operativos usan JWT.
- El acceso se controla tambien por rol.
- No se pueden crear pedidos ni registrar pagos sin turno abierto.
- El cierre de turno se bloquea solo por cuentas con saldo pendiente.
- Una comanda pagada puede seguir activa en KDS y no bloquea cierre de turno.
- El KDS no se limpia por pago ni por cierre de turno; solo cambia por accion de cocina.

## Ordenes

### `POST /api/orders`

Roles: `ADMIN`, `CAJERO`, `MESERO`

Crea una orden.

Reglas principales:

- `DINE_IN` requiere mesa y mesero.
- `TAKE_AWAY` requiere pago inmediato.
- `DELIVERY` no requiere pago inmediato.
- `DELIVERY` sale a produccion sin cobro previo.
- `DELIVERY` puede capturarse con cliente/domicilio registrado o con datos manuales.

Estados operativos relevantes:

- Generales: `OPEN`, `IN_PROGRESS`, `READY`, `CLOSED`, `CANCELLED`
- Delivery: `OPEN`, `IN_PROGRESS`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CLOSED`, `CANCELLED`

### `GET /api/orders/open`

Roles: `ADMIN`, `SUPERVISOR`, `CAJERO`, `MESERO`

Obtiene cuentas abiertas. Acepta `orderType` opcional.

### `GET /api/orders/active`

Roles: `ADMIN`, `SUPERVISOR`, `CAJERO`, `COCINA`, `MESERO`

Obtiene pedidos activos.

### `GET /api/orders/:id`

Roles: `ADMIN`, `SUPERVISOR`, `CAJERO`, `COCINA`, `MESERO`

Detalle de una orden.

### `PATCH /api/orders/:id/items`

Roles: `ADMIN`, `CAJERO`, `MESERO`

Agrega productos a una cuenta abierta.

### `PATCH /api/orders/:id/status`

Roles: `ADMIN`, `SUPERVISOR`, `COCINA`, `CAJERO`

Actualiza estado operativo.

Reglas relevantes:

- No se puede cerrar una orden con saldo pendiente.
- No se puede cancelar una orden con pagos registrados.
- `DELIVERY` no puede cerrarse antes de `DELIVERED`.

### `POST /api/orders/:id/print`

Roles: `ADMIN`, `CAJERO`, `MESERO`

Marca cuenta impresa para comedor.

## Pagos

### `POST /api/payments`

Roles: `ADMIN`, `CAJERO`

Registra pago sobre una orden.

Reglas principales:

- Requiere turno abierto del usuario que cobra.
- No permite pagar orden cancelada o ya cerrada.
- No permite cobrar mas del saldo pendiente.
- El backend calcula el cambio.
- Si es efectivo, registra movimiento de caja.
- `TAKE_AWAY` exige liquidacion completa antes de producir si aun no tiene comanda.
- `DELIVERY` puede liquidarse al final del reparto.
- Una orden pagada no desaparece del KDS automaticamente.

## Turnos de caja

### `POST /api/cash-shifts/open`

Roles: `ADMIN`, `CAJERO`

Abre turno. Un usuario no puede tener dos turnos abiertos.

### `GET /api/cash-shifts/current`

Roles operativos autenticados segun flujo del frontend.

Devuelve turno abierto del usuario.

### `GET /api/cash-shifts/current/summary`

Resumen del turno abierto.

### `PATCH /api/cash-shifts/:id/close`

Roles: `ADMIN`, `CAJERO`

Cierra turno.

Reglas principales:

- `CAJERO` solo puede cerrar su propio turno.
- `ADMIN` puede cerrar turnos ajenos.
- Se bloquea si existe cualquier cuenta con saldo pendiente.
- No se bloquea por comandas ya pagadas aunque sigan activas en KDS.
- No fuerza cierre operativo de orden ni limpia el KDS.

### `POST /api/cash-shifts/:id/movements`

Roles: `ADMIN`, `CAJERO`

Registra movimientos manuales de caja.

Regla principal:

- `CAJERO` no puede registrar movimientos en turno ajeno.

## Cocina / KDS

### `GET /api/kitchen/active`

Roles: `ADMIN`, `COCINA`, `SUPERVISOR`

Lista comandas activas.

### `PATCH /api/kitchen/:id/status`

Roles: `ADMIN`, `COCINA`

Actualiza estado global de comanda.

### `PATCH /api/kitchen/item/:itemId/status`

Roles: `ADMIN`, `COCINA`

Actualiza estado de item individual.

Reglas relevantes:

- La comanda sigue viva aunque la cuenta ya este pagada.
- Solo cocina debe mover la comanda hasta su estado final.

## Clientes

### `GET /api/customers`

Roles: `ADMIN`, `SUPERVISOR`, `CAJERO`, `MESERO`

Soporta busqueda por telefono con `?phone=...`.

### `POST /api/customers`

Roles: `ADMIN`, `CAJERO`, `MESERO`

Crea cliente.

### `GET /api/customers/:id/addresses`

Lista domicilios del cliente.

### `POST /api/customers/:id/addresses`

Registra domicilio del cliente.

## Productos y catalogos

### `GET /api/products`

Roles: `ADMIN`, `SUPERVISOR`, `CAJERO`, `MESERO`

Filtro opcional: `categoryId`

### `POST|PATCH|DELETE /api/products`

Roles: `ADMIN`

### `GET /api/categories`

Catalogo de categorias.

### `GET /api/areas`

Catalogo de areas.

### `GET /api/tables`

Lista mesas, opcionalmente por `areaId`.

## Notas de negocio

- `DINE_IN`: cuenta abierta en mesa, pago normalmente al final.
- `TAKE_AWAY`: pago inmediato.
- `DELIVERY`: cuenta abierta, produccion inmediata, reparto y cobro al final.
