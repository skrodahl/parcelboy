// Data registry (§5.4). Data files export plain arrays; lookups are by id.
export class Registry {
  constructor(kind, requiredFields = []) {
    this.kind = kind;
    this.requiredFields = requiredFields;
    this.map = new Map();
    this.order = [];
  }
  add(def) {
    if (!def || !def.id) throw new Error(this.kind + ': entry missing id');
    if (this.map.has(def.id)) throw new Error(this.kind + ': duplicate id ' + def.id);
    for (let i = 0; i < this.requiredFields.length; i++) {
      const f = this.requiredFields[i];
      if (def[f] === undefined || def[f] === null) {
        throw new Error(this.kind + '.' + def.id + ': missing field ' + f);
      }
    }
    this.map.set(def.id, def);
    this.order.push(def.id);
    return def;
  }
  get(id) {
    const def = this.map.get(id);
    if (!def) throw new Error('Unknown ' + this.kind + ': ' + id);
    return def;
  }
  has(id) {
    return this.map.has(id);
  }
  all() {
    const out = new Array(this.order.length);
    for (let i = 0; i < this.order.length; i++) out[i] = this.map.get(this.order[i]);
    return out;
  }
}
