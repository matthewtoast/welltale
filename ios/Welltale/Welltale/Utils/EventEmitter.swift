class EventEmitter<Event: Hashable> {
    private var listeners: [Event: [(once: Bool, callback: () -> Void)]] = [:]
    
    func on(_ event: Event, _ callback: @escaping () -> Void) {
        if listeners[event] == nil {
            listeners[event] = []
        }
        listeners[event]?.append((once: false, callback: callback))
    }
    
    func once(_ event: Event, _ callback: @escaping () -> Void) {
        if listeners[event] == nil {
            listeners[event] = []
        }
        listeners[event]?.append((once: true, callback: callback))
    }
    
    func emit(_ event: Event) {
        listeners[event]?.forEach { _, callback in
            callback()
        }
        listeners[event] = listeners[event]?.filter { !$0.once }
    }
    
    func removeAllListeners(_ event: Event) {
        listeners[event] = []
    }
    
    func removeAllListeners() {
        listeners = [:]
    }
}
