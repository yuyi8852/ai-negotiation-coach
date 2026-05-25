/**
 * JSON File Database - 轻量级 JSON 文件数据库
 * 零依赖，零编译
 */

const fs = require('fs');
const path = require('path');

class JsonDB {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = {};
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  _filePath(table) {
    return path.join(this.dataDir, `${table}.json`);
  }

  _load(table) {
    if (this.cache[table]) return this.cache[table];
    const filePath = this._filePath(table);
    if (!fs.existsSync(filePath)) {
      this.cache[table] = [];
      return this.cache[table];
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.cache[table] = data;
    return data;
  }

  _save(table) {
    const filePath = this._filePath(table);
    fs.writeFileSync(filePath, JSON.stringify(this.cache[table] || [], null, 2));
  }

  /**
   * 插入记录
   */
  insert(table, record) {
    const data = this._load(table);
    const entry = {
      id: this._genId(),
      createdAt: new Date().toISOString(),
      ...record,
    };
    data.push(entry);
    this._save(table);
    return entry;
  }

  /**
   * 查询记录
   */
  find(table, filter = {}) {
    const data = this._load(table);
    return data.filter(item => {
      return Object.entries(filter).every(([key, value]) => item[key] === value);
    });
  }

  /**
   * 按 ID 查询
   */
  findById(table, id) {
    const data = this._load(table);
    return data.find(item => item.id === id) || null;
  }

  /**
   * 更新记录
   */
  update(table, id, updates) {
    const data = this._load(table);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return null;
    data[index] = { ...data[index], ...updates, updatedAt: new Date().toISOString() };
    this._save(table);
    return data[index];
  }

  /**
   * 删除记录
   */
  delete(table, id) {
    const data = this._load(table);
    const index = data.findIndex(item => item.id === id);
    if (index === -1) return false;
    data.splice(index, 1);
    this._save(table);
    return true;
  }

  /**
   * 获取最近 N 条记录
   */
  recent(table, limit = 10) {
    const data = this._load(table);
    return data.slice(-limit).reverse();
  }

  /**
   * 统计记录数
   */
  count(table, filter = {}) {
    return this.find(table, filter).length;
  }

  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = { JsonDB };
