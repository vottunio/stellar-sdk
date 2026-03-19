Proposal: Core SDK Architecture and Component Descriptions
Objective
This document outlines a proposal for a modular, standardized architecture for our Core SDKs. The goal is to create a robust, extensible, and developer-friendly set of tools that abstracts complex blockchain and payment logic, making integration straightforward for all users, regardless of their familiarity with the underlying technologies.
Proposed Changes: Core SDK Architecture
Each Core SDK will adhere to a modular design, ensuring separation of concerns, easier maintenance, and independent evolution of features. This architecture is based on my current understanding of the requirements and potential scope. This list represents the minimum required components and may be expanded upon as development progresses and further needs are identified.

The Core SDK will be structured into the following six specialized modules:


1. Wallet Management Module
Goal: To provide comprehensive tools for creating, managing, and interacting with user wallets, focusing on seamless integration with modern blockchain standards and security practices.

Feature
Description
Create Account Abstraction wallets using Crossmint integration
Enables the creation of non-custodial, smart contract-based wallets (Account Abstraction or AA) facilitated by the Crossmint infrastructure, offering enhanced flexibility and user experience (e.g., social login, sponsored transactions).
Support for external wallet signers
Allows the SDK to interface with external wallet providers (e.g., MetaMask, WalletConnect) for transaction signing when users prefer or need to use their existing external wallet.
Key management utilities
Secure tools for generating, storing, and retrieving cryptographic keys used for signing transactions, typically for internal or managed wallets.
Wallet address derivation
Provides methods to deterministically generate a user's wallet address based on their unique identifier and network context.

2. Smart Contract Module
Goal: To facilitate secure and standardized interaction with key smart contracts deployed on the blockchain, particularly those governing protocol operations and account registration.

Feature
Description
Contract registry client
A service that maintains and retrieves the addresses and ABIs (Application Binary Interfaces) of all necessary protocol smart contracts (e.g., the AA factory, executors, and governance contracts).
ExecutionDelayPolicy interactions
Methods for querying and setting parameters related to the execution delay policy contract, which governs the waiting period before certain sensitive operations are finalized.
FundsManagementExecutor operations
Functions to interact with the dedicated executor contract responsible for moving, managing, or sweeping funds within the protocol.
Accounts contract registration
Logic to register newly created Account Abstraction wallets with the central accounts contract, making them recognizable and usable by the protocol.
Generic contract call builder
A flexible utility allowing developers to build and encode arbitrary calls to any smart contract address, supporting future contract additions without requiring SDK updates.

3. Transaction Module
Goal: To simplify the end-to-end process of building, signing, submitting, and monitoring blockchain transactions, ensuring reliability through built-in resilience mechanisms.

Feature
Description
Transaction builder with fluent API
An intuitive, method-chaining interface that guides developers through the process of constructing a valid transaction payload.
Transaction signing and submission
Handles the cryptographic signing of the transaction payload using the appropriate signer (internal key or external wallet) and submits it to the designated network endpoint.
Fee estimation
Provides accurate estimates of the required transaction fees (gas costs) before submission, allowing users to confirm costs transparently.
Transaction status tracking
A service to poll the network and provide real-time updates on a transaction's status (e.g., pending, confirmed, failed).
Retry logic with exponential backoff
Automated mechanism to handle temporary network errors by resubmitting failed transactions after increasing wait intervals, ensuring eventual execution.

4. API Client Module
Goal: To provide a comprehensive, type-safe wrapper for interacting with the off-chain Wirex Pay backend services, covering user data, payment operations, and history retrieval.

Feature
Description
RESTful API wrapper for Wirex Pay backend
A complete set of client functions mapping directly to the Wirex Pay REST API endpoints.
Authentication and token management
Handles user login, session management, token refresh, and securely attaching authorization headers to all API requests.
User management endpoints
Functions for profile creation, updating user details, and managing KYC/AML status.
Card operations
Services for requesting, activating, suspending, and managing virtual and physical payment cards.
Transaction history
Endpoints for retrieving detailed lists and individual records of both on-chain and off-chain transaction activities.
Wallet information retrieval
Methods for fetching balances, linked accounts, and other critical financial data managed by the Wirex Pay system.

5. WebSocket Module
Goal: To enable real-time communication between the client application and the backend, providing immediate updates on critical events without continuous polling.

Feature
Description
Real-time event subscription
Allows the client to subscribe to specific streams of events (e.g., transaction status updates, deposit notifications, card activity).
Automatic reconnection
Built-in logic to detect lost connections and attempt to reconnect automatically and gracefully to minimize service interruptions.
Event filtering and routing
Mechanisms to selectively process only relevant events and efficiently direct them to the appropriate application handlers.
Type-safe event handlers
Provides strongly typed interfaces for incoming events, eliminating runtime errors and improving developer experience.

6. Configuration Module
Goal: To manage environment-specific parameters and operational settings, allowing developers to easily switch between development, testing, and production environments.

Feature
Description
Environment management (testnet/mainnet)
Simple methods to toggle between development (e.g., testnet) and production (e.g., mainnet) environments, ensuring all modules use the correct settings.
API endpoint configuration
Centralized control over the base URLs for the Wirex Pay backend and other necessary external services.
Network parameters
Defines blockchain-specific settings, such as chain ID, currency symbol, and default gas limits.
Logging and debugging options
Controls the verbosity of internal logging, allowing developers to enable detailed output for troubleshooting and development purposes.




Note: This proposed structure is what I understand to be the foundational requirements for a comprehensive SDK suite. As development evolves, additional specialized modules or features may be integrated into this framework to meet unforeseen requirements.
