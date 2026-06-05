/**
 * Event Bus for cross-platform communication
 * Enables decoupled communication between runtime and adapters
 */

import { EventEmitter } from 'events';

export class RuntimeEventBus extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map();
  }

  /**
   * Subscribe to an event
   */
  subscribe(event, callback) {
    this.on(event, callback);
    
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event).push(callback);
    
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(event, callback) {
    this.off(event, callback);
    
    if (this.subscribers.has(event)) {
      const callbacks = this.subscribers.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event with structured data
   */
  emit(event, data = {}) {
    const eventData = {
      type: event,
      timestamp: Date.now(),
      ...data
    };
    return super.emit(event, eventData);
  }

  /**
   * Get current subscribers count for an event
   */
  getSubscriberCount(event) {
    return this.subscribers.get(event)?.length || 0;
  }

  /**
   * Clear all subscribers
   */
  clear() {
    this.removeAllListeners();
    this.subscribers.clear();
  }
}

// Singleton instance
let instance = null;
export function getEventBus() {
  if (!instance) {
    instance = new RuntimeEventBus();
  }
  return instance;
}
