# API Docs - Backend Fatboy Restaurant POS

Resumen tecnico de endpoints y reglas de negocio vigentes en backend.

## Swagger

- UI: `http://localhost:3000/api/docs`
- JSON: `http://localhost:3000/api/docs-json`

## Seguridad

- Prefijo global: `/api`
- Autenticacion: JWT Bearer
- Control de acceso: roles

## Reglas de negocio transversales

- No hay operacion de caja, orden o cocina sin JWT valido.
- No se crean pedidos ni se cobran cuentas sin turno abierto cuando el flujo lo requiere.
- El cierre de turno solo se bloquea por cuentas con saldo pendiente real.
- Las comandas pagadas pueden seguir activas en KDS.
- Pago o cierre de turno no eliminan comandas del KDS.

## Auth

### `POST /api/auth/login`

Devuelve `access_token`.

## Orders

### `POST /api/orders`

Roles: `ADMIN`, `CAJERO`, `MESERO`

Tipos:

- `DINE_IN`
- `TAKE_AWAY`
- `DELIVERY`

Reglas:

- `DINE_IN` requiere mesa y mesero.
- `TAKE_AWAY` requiere pago inmediato.
- `DELIVERY` no requiere pago inmediato.
- `DELIVERY` puede usar cliente y domicilio guardado o datos manuales.
- `DELIVERY` entra a cocina sin cobro previo.

Estados:

- Base: `OPEN`, `IN_PROGRESS`, `READY`, `CLOSED`, `CANCELLED`
- Delivery: `OPEN`, `IN_PROGRESS`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CLOSED`, `CANCELLED`

### `GET /api/orders/open`

Query opcional:

- `orderType`

### `GET /api/orders/active`

Pedidos activos del sistema.

### `GET /api/orders/:id`

Detalle de orden.

### `PATCH /api/orders/:id/items`

Agrega items a cuenta abierta.

### `PATCH /api/orders/:id/status`

Reglas importantes:

- No cerrar con saldo pendiente.
- No cancelar con pagos registrados.
- `DELIVERY` no puede cerrar antes de `DELIVERED`.

### `POST /api/orders/:id/print`

Uso de comedor para marcar cuenta impresa.

## Payments

### `POST /api/payments`

Roles: `ADMIN`, `CAJERO`

Reglas:

- Requiere turno abierto del cobrador.
- No permite exceder saldo pendiente.
- El backend calcula cambio.
- Si es efectivo, registra movimiento.
- `TAKE_AWAY` exige liquidacion completa antes de enviar a produccion si aun no tiene comanda.
- `DELIVERY` puede cobrarse al final del reparto.
- El pago no saca la comanda del KDS automaticamente.

## Cash Shifts

### `POST /api/cash-shifts/open`

Abre turno.

### `GET /api/cash-shifts/current`

Turno abierto del usuario.

### `GET /api/cash-shifts/current/summary`

Resumen actual.

### `PATCH /api/cash-shifts/:id/close`

Roles: `ADMIN`, `CAJERO`

Reglas:

- `CAJERO` solo opera su propio turno.
- `ADMIN` puede operar turnos ajenos.
- Se bloquea por cuentas pendientes de comedor o delivery.
- No se bloquea por comandas ya pagadas pero aun activas en KDS.
- No cambia automaticamente el estado operativo de la orden.
- No limpia ni elimina comandas del KDS.

### `POST /api/cash-shifts/:id/movements`

Movimiento manual.

Regla:

- `CAJERO` no puede operar movimientos sobre turno ajeno.

## Kitchen

### `GET /api/kitchen/active`

Lista comandas activas.

### `PATCH /api/kitchen/:id/status`

Actualiza estado de comanda.

### `PATCH /api/kitchen/item/:itemId/status`

Actualiza estado de item.

Notas:

- La comanda puede seguir activa aunque la cuenta ya este pagada.
- Solo cocina debe llevar la comanda hasta su fin operativo.

## Customers

### `GET /api/customers`

Soporta:

- `?phone=...`

### `POST /api/customers`

Crea cliente.

### `GET /api/customers/:id/addresses`

Lista domicilios.

### `POST /api/customers/:id/addresses`

Crea domicilio.

## Catalogos

### `GET /api/products`

Filtro:

- `categoryId`

### `GET /api/categories`

Categorias.

### `GET /api/areas`

Areas.

### `GET /api/tables`

Filtro:

- `areaId`
