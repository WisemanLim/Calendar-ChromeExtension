// 템플릿 저장소 — chrome.storage(JSON) 영속, 최초 기본 시드 제공. iOS TemplateStore 포팅.
import * as storage from './storage.js';
import { TEMPLATES_KEY, normalizeTemplate, seedTemplates } from '../core/templates.js';

export class TemplateStore {
  constructor() {
    this.templates = [];
  }

  async load() {
    const saved = await storage.get(TEMPLATES_KEY);
    this.templates = Array.isArray(saved) ? saved.map(normalizeTemplate) : seedTemplates();
    return this;
  }

  persist() {
    return storage.set(TEMPLATES_KEY, this.templates);
  }

  add(t) {
    this.templates.push(t);
    return this.persist();
  }

  remove(t) {
    this.templates = this.templates.filter((x) => x.id !== t.id);
    return this.persist();
  }

  update(t) {
    const i = this.templates.findIndex((x) => x.id === t.id);
    if (i >= 0) this.templates[i] = t;
    return this.persist();
  }

  inCategory(category) {
    return this.templates.filter((t) => t.category === category);
  }
}
