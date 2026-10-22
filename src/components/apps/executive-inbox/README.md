# Componentes compartidos de Executive Inbox

Este directorio contiene componentes React reutilizables del MVP **Executive AI Inbox & Hub**.

Los componentes específicos de la página `/inbox` viven en `src/app/(portal)/inbox/_components/`.
Los componentes aquí deben ser independientes de la ruta para poder reutilizarse en:

- El dashboard ejecutivo.
- La vista de reuniones.
- Notificaciones y widgets del portal.

## Reglas

1. No importar directamente mocks de dominio.
2. Recibir datos por props o hooks genéricos.
3. Manejar estados de carga y vacío explícitamente.
