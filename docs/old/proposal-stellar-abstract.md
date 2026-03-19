# Propuesta: SDK Modular Multi-Blockchain para Wirex Pay
## Arquitectura Abstracta con Soporte Stellar y EVM

---

## Objetivo

Crear un SDK modular, extensible y developer-friendly que abstraiga la complejidad de blockchain y pagos para Wirex Pay. El SDK estará **inicialmente enfocado en Stellar**, pero diseñado con una arquitectura abstracta que permita extenderlo a blockchains EVM (Ethereum, Polygon, etc.) con mínimo esfuerzo.

---

## Arquitectura Propuesta

El SDK sigue un patrón de **capas de abstracción** que separa la lógica común de las implementaciones específicas de cada blockchain:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Común (Interfaces)                    │
│  - Definiciones de tipos y contratos compartidos            │
│  - Interfaces abstractas para todas las operaciones         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Módulos Core (6)                          │
│  1. Wallet  2. Blockchain  3. Transaction                   │
│  4. API Client  5. WebSocket  6. Configuration              │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │    Adaptadores Blockchain           │
        └─────────────────────────────────────┘
                ↓                   ↓
        ┌──────────────┐    ┌──────────────┐
        │   Stellar    │    │     EVM      │
        │   Adapter    │    │   Adapter    │
        │  (Prioridad) │    │   (Futuro)   │
        └──────────────┘    └──────────────┘
```

---

## Módulos del SDK

### 1. Wallet Management Module
**Objetivo:** Gestión completa de wallets independientemente de la blockchain subyacente.

| Feature | Descripción | Stellar | EVM |
|---------|-------------|---------|-----|
| **Creación de Wallets** | Generar nuevos keypairs/cuentas de forma segura | Stellar Keypairs | EOA/AA Wallets |
| **Importación de Wallets** | Importar wallets existentes desde seed/private key | ✅ | ✅ |
| **Derivación HD** | Soporte para wallets determinísticos (BIP39/44) | ✅ | ✅ |
| **Firma de Transacciones** | Firmar transacciones con claves privadas locales | ✅ | ✅ |
| **Integración Wallets Externas** | Conectar con wallets del usuario (Freighter, MetaMask, WalletConnect) | Freighter, Lobstr | MetaMask, WC |
| **Multi-firma** | Soporte para wallets con múltiples signatarios | Stellar multisig | Safe, multisig contracts |

**Abstracción clave:**
```typescript
interface Wallet {
  address: string;
  sign(transaction: Transaction): Promise<SignedTransaction>;
  getPublicKey(): string;
}
```

---

### 2. Blockchain Interaction Module
**Objetivo:** Abstraer las interacciones específicas de cada blockchain (operaciones nativas y smart contracts).

| Feature | Descripción | Stellar | EVM |
|---------|-------------|---------|-----|
| **Operaciones Nativas** | Ejecutar operaciones básicas de la blockchain | Payment, PathPayment, CreateAccount | Transfer, Approve |
| **Smart Contracts** | Interactuar con contratos inteligentes | Soroban contracts | Solidity contracts |
| **Consulta de Estado** | Leer datos on-chain (balances, estados) | Horizon API | RPC nodes |
| **Gestión de Assets** | Manejo de tokens/assets nativos y personalizados | Stellar Assets, trustlines | ERC20, ERC721, ERC1155 |
| **Protocolo específico** | Operaciones únicas de cada blockchain | Claimable Balances, Sponsored Reserves | Account Abstraction, ERC-4337 |

**Abstracción clave:**
```typescript
interface BlockchainAdapter {
  sendPayment(params: PaymentParams): Promise<Transaction>;
  getBalance(address: string, asset?: Asset): Promise<Balance>;
  invokeContract(params: ContractInvocation): Promise<Transaction>;
  queryContract(params: ContractQuery): Promise<any>;
}
```

**Implementaciones:**
- `StellarAdapter` - Usa Stellar SDK + Horizon
- `EVMAdapter` - Usa ethers.js/viem + RPC nodes

---

### 3. Transaction Module
**Objetivo:** Construir, firmar, enviar y monitorear transacciones de forma unificada.

| Feature | Descripción | Compatible |
|---------|-------------|------------|
| **Transaction Builder** | API fluida para construir transacciones paso a paso | ✅ Universal |
| **Estimación de Fees** | Calcular costos antes de enviar | ✅ (fees en XLM vs gas en ETH) |
| **Firma y Envío** | Firmar con wallet y broadcast a la red | ✅ Universal |
| **Tracking de Estado** | Monitorear confirmación y finalización | ✅ Universal |
| **Retry Logic** | Reintentos automáticos con backoff exponencial | ✅ Universal |
| **Batch Transactions** | Agrupar múltiples operaciones | ✅ (distinto enfoque) |

**Ejemplo de uso unificado:**
```typescript
const tx = await sdk.transaction()
  .sendPayment({
    to: "GDEST...", // o "0x123..." en EVM
    amount: "100",
    asset: "USDC"
  })
  .withFeeLimit("0.1")
  .sign(wallet)
  .send();

const status = await tx.waitForConfirmation();
```

---

### 4. API Client Module
**Objetivo:** Cliente completo para interactuar con el backend de Wirex Pay.

| Feature | Descripción |
|---------|-------------|
| **Autenticación** | Login, logout, refresh tokens, gestión de sesiones |
| **User Management** | CRUD de usuarios, perfiles, KYC/AML status |
| **Card Operations** | Solicitar, activar, suspender tarjetas físicas/virtuales |
| **Transaction History** | Consultar historial completo (on-chain y off-chain) |
| **Wallet Info** | Obtener balances, cuentas vinculadas, límites |
| **Payments** | Iniciar pagos, conversiones, top-ups |

**Nota:** Este módulo es **100% independiente de blockchain** - interactúa solo con APIs REST de Wirex.

**Ejemplo:**
```typescript
const client = sdk.api;
await client.auth.login(credentials);
const balance = await client.wallet.getBalance();
const cards = await client.cards.list();
const history = await client.transactions.getHistory({ limit: 50 });
```

---

### 5. WebSocket Module
**Objetivo:** Eventos en tiempo real desde el backend de Wirex Pay.

| Feature | Descripción |
|---------|-------------|
| **Event Subscription** | Suscribirse a eventos específicos (tx confirmadas, depósitos, etc.) |
| **Auto-reconnection** | Reconexión automática en caso de pérdida de conexión |
| **Event Filtering** | Filtrar eventos por tipo, cuenta, asset |
| **Type-safe Handlers** | Handlers tipados para cada tipo de evento |
| **Connection Status** | Callbacks para estados de conexión (connected, disconnected, error) |

**Nota:** También **independiente de blockchain** - eventos del backend de Wirex.

**Ejemplo:**
```typescript
const ws = sdk.websocket;
ws.on('transaction.confirmed', (event) => {
  console.log('Transaction confirmed:', event.txHash);
});
ws.on('deposit.received', (event) => {
  console.log('Deposit received:', event.amount);
});
await ws.connect();
```

---

### 6. Configuration Module
**Objetivo:** Gestionar configuraciones de entorno, red y debugging.

| Feature | Descripción | Stellar | EVM |
|---------|-------------|---------|-----|
| **Environment Selection** | Cambiar entre testnet/mainnet | ✅ | ✅ |
| **Network Parameters** | Configurar endpoints, chain IDs, parámetros de red | Horizon URL, passphrase | RPC URL, chain ID |
| **API Endpoints** | Base URLs para backend de Wirex | ✅ Universal | ✅ Universal |
| **Logging** | Niveles de log (debug, info, warn, error) | ✅ Universal | ✅ Universal |
| **Timeout & Retry** | Configurar timeouts y políticas de reintento | ✅ Universal | ✅ Universal |

**Ejemplo:**
```typescript
const sdk = new WirexSDK({
  blockchain: 'stellar', // o 'ethereum', 'polygon'
  network: 'testnet',
  apiEndpoint: 'https://api.wirex.pay',
  horizonUrl: 'https://horizon-testnet.stellar.org', // solo Stellar
  rpcUrl: 'https://eth-sepolia.g.alchemy.com/...', // solo EVM
  logging: { level: 'debug' }
});
```

---

## Roadmap de Implementación

### Fase 1: Core + Stellar (Prioridad - Grant de Stellar)
1. ✅ Definir interfaces abstractas comunes
2. ✅ Implementar módulos universales (API Client, WebSocket, Config)
3. ✅ Implementar `StellarAdapter` completo
4. ✅ Wallet Management con Stellar
5. ✅ Transaction Module para Stellar
6. ✅ Testing exhaustivo en testnet de Stellar
7. ✅ Documentación y ejemplos

### Fase 2: Extensión a EVM (Futuro)
1. Implementar `EVMAdapter`
2. Extender Wallet Management para EVM
3. Adaptar Transaction Module
4. Testing en testnets EVM (Sepolia, Mumbai)
5. Documentación para EVM

### Fase 3: Features Avanzadas
- Soporte para más blockchains (Solana, etc.)
- UI Components (opcional)
- SDKs nativos (Swift, Kotlin) si se requiere

---

## Stack Técnico Propuesto

| Componente | Tecnología |
|------------|------------|
| **Lenguaje** | TypeScript (compilable a JavaScript) |
| **Plataformas** | Node.js, Browser (Web), React Native (mobile) |
| **Stellar SDK** | `@stellar/stellar-sdk` |
| **EVM SDK** | `viem` o `ethers.js` |
| **HTTP Client** | `axios` o `fetch` nativo |
| **WebSocket** | `ws` (Node) / nativo (Browser) |
| **Testing** | Jest + Playwright (e2e) |
| **Build** | Rollup o Vite |
| **Package Manager** | pnpm |

**Ventajas de TypeScript:**
- Type safety en todo el SDK
- Autocompletado perfecto para developers
- Funciona en web, Node.js y React Native
- Si en el futuro se necesita nativo (Swift/Kotlin), se puede generar bindings

---

## Diferencias Clave: Stellar vs EVM

### Conceptos que SÍ se mapean bien:
| Concepto | Stellar | EVM |
|----------|---------|-----|
| Wallet | Keypair (Ed25519) | EOA (secp256k1) |
| Address | `GABC...` (56 chars) | `0x123...` (42 chars) |
| Balance | Asset balances | Token balances (ERC20) |
| Transaction | Operations list | Call data |
| Fee | Base fee + operations | Gas price × gas used |
| Confirmation | Ledger close (~5s) | Block inclusion (~12s) |

### Conceptos que NO se mapean:
| Stellar-only | EVM-only |
|--------------|----------|
| Trustlines (para recibir assets) | No existe |
| Sponsored Reserves | No existe |
| Claimable Balances | No existe (contratos custom) |
| Path Payments | No nativo (DEX aggregators) |
| No existe | Account Abstraction (ERC-4337) |
| No existe | Gas tokens variables |
| No existe | MEV, flashbots |

**Estrategia:** El adapter específico maneja estos casos particulares sin contaminar la API común.

---

## Ejemplo de Uso Completo

```typescript
import { WirexSDK } from '@wirex/sdk';

// Inicialización
const sdk = new WirexSDK({
  blockchain: 'stellar',
  network: 'testnet',
  apiEndpoint: 'https://api-testnet.wirex.pay'
});

// 1. Autenticación
await sdk.api.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// 2. Crear/importar wallet
const wallet = await sdk.wallet.import({
  secretKey: 'SXXX...'
});

// 3. Consultar balance
const balance = await sdk.blockchain.getBalance(
  wallet.address,
  { code: 'USDC', issuer: 'GXXX...' }
);

// 4. Enviar pago
const tx = await sdk.transaction()
  .sendPayment({
    from: wallet.address,
    to: 'GDEST...',
    amount: '50',
    asset: { code: 'USDC', issuer: 'GXXX...' }
  })
  .withMemo('Payment for services')
  .estimateFees() // Calcula fees antes de enviar
  .sign(wallet)
  .send();

// 5. Monitorear transacción
await tx.waitForConfirmation();
console.log('Transaction confirmed:', tx.hash);

// 6. WebSocket para eventos en tiempo real
sdk.websocket.on('transaction.confirmed', (event) => {
  if (event.address === wallet.address) {
    console.log('New transaction:', event);
  }
});

await sdk.websocket.connect();
```

**El mismo código con blockchain: 'ethereum' funcionaría con mínimos cambios** (address format, asset representation).

---

## Preguntas Respondidas para Wirex (Roman)

### 1. ¿El API module implica que otros módulos son UI customizables?
**No.** Todos los módulos son **lógica pura (headless)**. No incluyen UI.
- El API Client interactúa con backend de Wirex
- Los demás módulos interactúan con blockchain
- Si en el futuro se desea, podemos crear módulos UI por separado (React components, por ejemplo)

### 2. ¿Propósito del Config Module?
Centralizar toda la configuración:
- Cambiar entre testnet/mainnet fácilmente
- Configurar endpoints (Horizon, RPC, API de Wirex)
- Logging y debugging
- Timeouts y retry policies
- Permite a developers configurar el SDK sin tocar código interno

### 3. ¿Qué plataformas?
**TypeScript/JavaScript** que funciona en:
- ✅ Node.js (backend, scripts)
- ✅ Navegadores Web (dApps, web apps)
- ✅ React Native (apps móviles)

Si más adelante se necesita **nativo** (Swift/Kotlin), se puede:
- Generar bindings desde TypeScript
- O reescribir solo los adapters en nativo manteniendo la arquitectura

### 4. ¿Solo Stellar o también EVM?
**Fase 1: Stellar** (para grant)
**Fase 2: EVM** (cuando haya "buyer")

La arquitectura está diseñada para soportar ambos con **código compartido maximizado** (~70% común, ~30% específico por blockchain).

---

## Estimación de Esfuerzo

### Fase 1 - Stellar (MVP completo):
- **Arquitectura base e interfaces:** 1-2 semanas
- **Wallet Management Module:** 1-2 semanas
- **Blockchain Interaction Module (Stellar):** 2-3 semanas
- **Transaction Module:** 2 semanas
- **API Client Module:** 2-3 semanas
- **WebSocket Module:** 1 semana
- **Configuration Module:** 1 semana
- **Testing & Debugging:** 2-3 semanas
- **Documentación:** 1-2 semanas

**Total Fase 1: 13-19 semanas (~3-5 meses)** con 1-2 developers

### Fase 2 - EVM:
- **EVM Adapter:** 2-3 semanas
- **Ajustes y testing:** 2 semanas
- **Documentación:** 1 semana

**Total Fase 2: 5-6 semanas adicionales**

---

## Beneficios de Esta Arquitectura

✅ **Modular:** Cada módulo es independiente y testeable
✅ **Extensible:** Agregar nuevas blockchains es agregar un nuevo adapter
✅ **Developer-friendly:** API intuitiva y consistente entre blockchains
✅ **Type-safe:** TypeScript previene errores en tiempo de desarrollo
✅ **Reutilizable:** ~70% del código es común entre Stellar y EVM
✅ **Mantenible:** Cambios en una blockchain no afectan a otras
✅ **Testeable:** Interfaces permiten mocking fácil para tests

---

## Próximos Pasos

1. ✅ **Validar esta propuesta** con Wirex (Pavel, Roman)
2. **Definir prioridades** de features dentro de cada módulo
3. **Setup del proyecto** (repo, CI/CD, estructura)
4. **Comenzar Fase 1** - Stellar implementation
5. **Aplicar al grant de Stellar** con esta propuesta

---

**Preparado por:** Vottun Development Team
**Fecha:** Diciembre 2025
**Versión:** 2.0 (Arquitectura Multi-Blockchain)
