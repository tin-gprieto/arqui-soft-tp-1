# Observaciones

## Preguntas para realizar:
1. Se considera a Docker parte de la app o eso lo "hicimos nosotros" como equipo de arquitectura?

## Codigo
1. Parece que `transfer` no esta implementado. Pero de estarlo, esta intentando validar si hay saldo suficiente para realizar las transferencias reales entre cuentas del cliente y del exchange.
Lo hace llamando a `transfer` dos veces. La primera vez intenta transferir X del cliente al exchange (cliente da moneda base). La segunda vez intenta transferir Y del exchange al cliente (exchange da moneda destino).

La idea es que de tener existo en ambas, se verifica que:
1. El exchange tiene saldo suficiente para realizar la transaccion.
2. El cliente tiene saldo suficiente para realizar la transaccion.



## Atributos de Calidad

### Performance

- GET /accounts/:id utiliza `findAccountById`, que recorre todo el array de cuentas. Brindando una complejidad O(n) cuando podria ser O(1) si se usara un map. 

- `exchange` utiliza `findAccountByCurrency`, que recorre todo el array de cuentas. Brindando una complejidad O(n) cuando podria ser O(1) si se usara un map.

### Security

- *"**No** se valida que haya saldo en la cuenta del cliente, se espera que lo haga la UI y que no permita la operación"*: Trae un problema claro de seguridad. Cualquier modificación de estado de la DB debe tener un al menos un mecanismo de validacion en el backend (server + db mínimamente). Esto se debe a que se puede editar el codigo de validacion de la UI y hacer operaciones prohibidas.

- No hay mecanismo de rate limit en la API.

### Reliability

Puede tener problemas altos al estar actualizando la DB de forma periodica (ademas de esta ser en json). Si se intentan realizar muchas transacciones seguidas, se puede llegar a perder informacion.
- No utiliza mecanismos de control de concurrencia. Ej: locks, transacciones atomicas, etc.
- Tiene actualizaciones periodicas de la DB que no estan sincronizadas entre si. 

