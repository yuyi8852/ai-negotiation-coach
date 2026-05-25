/**
 * BaseAgent - 所有 Agent 的基类
 */

class BaseAgent {
  constructor(name, role, mimoClient) {
    this.name = name;
    this.role = role;
    this.mimo = mimoClient;
    this.systemPrompt = '';
  }

  async process(task, context = {}) {
    throw new Error(`${this.name}.process() must be implemented`);
  }

  buildMessages(userContent, extraContext = '') {
    const messages = [
      { role: 'system', content: this.systemPrompt },
    ];

    if (extraContext) {
      messages.push({ role: 'system', content: extraContext });
    }

    messages.push({ role: 'user', content: userContent });
    return messages;
  }

  formatResult(result) {
    return {
      agent: this.name,
      role: this.role,
      timestamp: new Date().toISOString(),
      ...result,
    };
  }
}

module.exports = { BaseAgent };
