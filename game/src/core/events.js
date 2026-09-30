// Tiny pub/sub. Listener arrays are stable (only appended to), so emit()
// never allocates; off() splices, which only happens at setup/teardown.
export function createEvents() {
  const listeners = new Map();
  return {
    on(type, fn) {
      let list = listeners.get(type);
      if (!list) {
        list = [];
        listeners.set(type, list);
      }
      list.push(fn);
      return fn;
    },
    off(type, fn) {
      const list = listeners.get(type);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(type, data) {
      const list = listeners.get(type);
      if (!list) return;
      for (let i = 0; i < list.length; i++) list[i](data);
    },
  };
}
