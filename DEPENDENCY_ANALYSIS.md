# 服務依賴分析報告

## 所有服務依賴關係

### AIConfirmationService
- 無依賴

### aiService
- 無依賴

### analyticsAIService
- 無依賴

### databaseService
- 無依賴

### ExpenseChatService
- StateManager
- EventBus
- EventTypes

### hotReloadService
- 無依賴

### ImageProcessingService
- StateManager
- EventBus
- EventTypes

### logger
- 無依賴

### moduleManager
- 無依賴

### pluginLoader
- 無依賴

### QueueService
- 無依賴

### redisService
- 無依賴

### userExperienceService
- 無依賴

### userService
- 無依賴

### websocketService
- 無依賴

### whatsappConnection
- ServiceContainer
- StateManager
- EventBus
- EventTypes

### whatsappMessage
- EventTypes

### WhatsAppService
- StateManager
- EventBus
- EventTypes

### Application
- whatsappConnection

### EventBus
- 無依賴

### EventHandlers
- ImageProcessingService
- ExpenseChatService
- WhatsAppService

### EventTypes
- 無依賴

### ServiceBootstrap
- databaseService
- redisService
- userService
- aiService
- QueueService
- ImageProcessingService
- ExpenseChatService
- WhatsAppService
- websocketService
- pluginLoader
- hotReloadService

### ServiceContainer
- 無依賴

### ServiceRegistry
- StateManager
- EventBus
- EventHandlers
- redisService
- databaseService
- QueueService
- ImageProcessingService
- ExpenseChatService
- aiService
- userService
- pluginLoader
- WhatsAppService

### StateManager
- 無依賴

## 檢測到的循環依賴
✅ 未檢測到循環依賴
