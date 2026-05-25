/**
 * Export Module - 导出谈判报告为多种格式
 */

const fs = require('fs');
const path = require('path');

class Exporter {
  constructor(outputDir) {
    this.outputDir = outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * 导出为 Markdown
   */
  toMarkdown(session) {
    const r = session.results || {};
    const report = r.finalReport?.report || {};
    const risk = r.riskAssessment?.assessment || {};
    const strategy = r.strategy?.strategy || {};

    let md = `# 谈判分析报告\n\n`;
    md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += `## 执行摘要\n\n${report.executiveSummary || '无'}\n\n`;

    md += `## 关键发现\n\n`;
    (report.keyFindings || []).forEach(f => { md += `- ${f}\n`; });
    md += `\n`;

    md += `## 风险评估\n\n`;
    md += `**综合风险等级**: ${risk.overallRiskLevel || '未知'} (${risk.overallScore || 0}/100)\n\n`;
    (risk.dimensions || []).forEach(d => {
      md += `### ${d.name} (${d.level}, ${d.score}/100)\n`;
      (d.findings || []).forEach(f => { md += `- ${f}\n`; });
      md += `**影响**: ${d.impact || '无'}\n\n`;
    });

    md += `## 谈判策略\n\n`;
    md += `**推荐风格**: ${strategy.strategyStyle || '未知'}\n\n`;
    (strategy.phases || []).forEach(p => {
      md += `### ${p.phase}\n`;
      md += `**目标**: ${p.objective || '无'}\n`;
      (p.tactics || []).forEach(t => { md += `- 策略: ${t}\n`; });
      (p.redLines || []).forEach(r => { md += `- 红线: ${r}\n`; });
      md += `\n`;
    });

    md += `## 谈判清单\n\n`;
    (report.negotiationChecklist || []).forEach(item => {
      md += `- [ ] ${item}\n`;
    });
    md += `\n`;

    md += `## 开场陈述\n\n${report.openingStatement || '无'}\n\n`;
    md += `## 终场论据\n\n${report.closingArguments || '无'}\n\n`;

    const filePath = path.join(this.outputDir, `report-${session.id}.md`);
    fs.writeFileSync(filePath, md);
    return filePath;
  }

  /**
   * 导出为 JSON
   */
  toJSON(session) {
    const filePath = path.join(this.outputDir, `session-${session.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    return filePath;
  }

  /**
   * 导出完整报告包
   */
  exportAll(session) {
    return {
      markdown: this.toMarkdown(session),
      json: this.toJSON(session),
    };
  }
}

module.exports = { Exporter };
