/**
 * Desktop IPC Adapter (Placeholder)
 * Bridges runtime events to Electron IPC
 * This is a template for future Desktop integration
 */

import { RuntimeEvent } from '../../runtime/types.js';

export class DesktopIPCAdapter {
  #eventBus;
  #ipcMain;
  #subscriptions;

  constructor(eventBus, ipcMain) {
    this.#eventBus = eventBus;
    this.#ipcMain = ipcMain;
    this.#subscriptions = [];
  }

  /**
   * Attach to event bus and register IPC handlers
   */
  attach() {
    // Listen to runtime events and forward to renderer
    this.#subscriptions = [
      this.#eventBus.subscribe(RuntimeEvent.AGENT_START, this.#forwardToRenderer.bind(this, 'agent:start')),
      this.#eventBus.subscribe(RuntimeEvent.AGENT_COMPLETE, this.#forwardToRenderer.bind(this, 'agent:complete')),
      this.#eventBus.subscribe(RuntimeEvent.AGENT_ERROR, this.#forwardToRenderer.bind(this, 'agent:error')),
      this.#eventBus.subscribe(RuntimeEvent.TOOL_CALL, this.#forwardToRenderer.bind(this, 'tool:call')),
      this.#eventBus.subscribe(RuntimeEvent.TOOL_RESULT, this.#forwardToRenderer.bind(this, 'tool:result')),
      this.#eventBus.subscribe(RuntimeEvent.TOOL_ERROR, this.#forwardToRenderer.bind(this, 'tool:error')),
      this.#eventBus.subscribe(RuntimeEvent.STATUS_UPDATE, this.#forwardToRenderer.bind(this, 'status:update'))
    ];

    // Register IPC handlers from renderer
    if (this.#ipcMain) {
      this.#ipcMain.handle('agent:processInput', this.#handleProcessInput.bind(this));
      this.#ipcMain.handle('agent:stop', this.#handleStop.bind(this));
      this.#ipcMain.handle('agent:getState', this.#handleGetState.bind(this));
    }
  }

  /**
   * Detach from event bus
   */
  detach() {
    this.#subscriptions.forEach(unsubscribe => unsubscribe());
    this.#subscriptions = [];
  }

  /**
   * Forward event to renderer process
   */
  #forwardToRenderer(channel, eventData) {
    // Implementation depends on Electron setup
    // Typically: webContents.send(channel, eventData)
    console.log('[Desktop IPC] Forward event:', channel, eventData);
  }

  /**
   * Handle processInput from renderer
   */
  async #handleProcessInput(event, input) {
    throw new Error('Not implemented - attach agent engine first');
  }

  /**
   * Handle stop from renderer
   */
  #handleStop() {
    throw new Error('Not implemented - attach agent engine first');
  }

  /**
   * Handle getState from renderer
   */
  #handleGetState() {
    throw new Error('Not implemented - attach agent engine first');
  }

  /**
   * Attach the agent engine
   */
  attachEngine(engine) {
    this.#handleProcessInput = async (event, input) => {
      return await engine.processInput(input);
    };
    this.#handleStop = () => {
      engine.stop();
    };
    this.#handleGetState = () => {
      return engine.getState();
    };
  }
}
