/**
 * Formatters - 数据格式化工具集
 * 用于将分析结果转换为多种输出格式
 */

class Formatters {
  /**
   * 格式化风险等级为中文
   */
  static riskLevel(score) {
    if (score >= 80) return { level: '极高风险', color: '#ff4444', emoji: '🔴' };
    if (score >= 60) return { level: '高风险', color: '#ff8800', emoji: '🟠' };
    if (score >= 40) return { level: '中等风险', color: '#ffcc00', emoji: '🟡' };
    if (score >= 20) return { level: '低风险', color: '#88cc00', emoji: '🟢' };
    return { level: '极低风险', color: '#00cc88', emoji: '✅' };
  }

  /**
   * 格式化金额
   */
  static currency(amount, currency = 'CNY') {
    if (amount === null || amount === undefined) return 'N/A';
    const num = Number(amount);
    if (isNaN(num)) return 'N/A';

    const symbols = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
    const symbol = symbols[currency] || currency + ' ';

    if (Math.abs(num) >= 100000000) {
      return `${symbol}${(num / 100000000).toFixed(2)}亿`;
    }
    if (Math.abs(num) >= 10000) {
      return `${symbol}${(num / 10000).toFixed(2)}万`;
    }
    return `${symbol}${num.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
  }

  /**
   * 格式化时长
   */
  static duration(ms) {
    if (!ms || ms < 0) return '0秒';
    if (ms < 1000) return `${ms}毫秒`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}小时${m}分`;
  }

  /**
   * 格式化 Token 用量
   */
  static tokens(usage) {
    if (!usage) return 'N/A';
    const { promptTokens, completionTokens, totalTokens } = usage;
    const parts = [];
    if (totalTokens) parts.push(`总计 ${totalTokens.toLocaleString()} tokens`);
    if (promptTokens) parts.push(`输入 ${promptTokens.toLocaleString()}`);
    if (completionTokens) parts.push(`输出 ${completionTokens.toLocaleString()}`);
    return parts.join(' | ');
  }

  /**
   * 格式化日期时间
   */
  static datetime(date, format = 'full') {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '无效日期';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    switch (format) {
      case 'date': return `${year}-${month}-${day}`;
      case 'time': return `${hours}:${minutes}:${seconds}`;
      case 'short': return `${month}-${day} ${hours}:${minutes}`;
      case 'relative': return Formatters.relativeTime(d);
      default: return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  }

  /**
   * 相对时间
   */
  static relativeTime(date) {
    const now = Date.now();
    const d = date instanceof Date ? date.getTime() : new Date(date).getTime();
    const diff = now - d;

    if (diff < 0) return '刚刚';
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;
    if (diff < 31536000000) return `${Math.floor(diff / 2592000000)}个月前`;
    return `${Math.floor(diff / 31536000000)}年前`;
  }

  /**
   * 格式化分析报告为 Markdown
   */
  static toMarkdown(report) {
    const sections = [];

    sections.push(`# ${report.title || '分析报告'}`);
    sections.push(`\n> 生成时间: ${Formatters.datetime(new Date())}\n`);

    if (report.summary) {
      sections.push(`## 执行摘要\n\n${report.summary}\n`);
    }

    if (report.risks && report.risks.length > 0) {
      sections.push('## 风险评估\n');
      report.risks.forEach((risk, i) => {
        const riskInfo = Formatters.riskLevel(risk.score || 50);
        sections.push(`### ${i + 1}. ${riskInfo.emoji} ${risk.name} (${riskInfo.level})`);
        sections.push(`${risk.description || ''}`);
        if (risk.mitigation) {
          sections.push(`\n**建议措施**: ${risk.mitigation}`);
        }
        sections.push('');
      });
    }

    if (report.strategy) {
      sections.push('## 谈判策略\n');
      if (typeof report.strategy === 'string') {
        sections.push(`${report.strategy}\n`);
      } else {
        Object.entries(report.strategy).forEach(([key, value]) => {
          sections.push(`### ${key}`);
          sections.push(`${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}\n`);
        });
      }
    }

    if (report.checklist && report.checklist.length > 0) {
      sections.push('## 谈判清单\n');
      report.checklist.forEach(item => {
        sections.push(`- [ ] ${item}`);
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 格式化分析报告为 HTML
   */
  static toHTML(report) {
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${report.title || '分析报告'}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; border-radius: 8px; padding: 20px; margin: 16px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; } h2 { color: #555; border-bottom: 2px solid #58a6ff; padding-bottom: 8px; }
    .risk-high { border-left: 4px solid #ff4444; }
    .risk-medium { border-left: 4px solid #ffcc00; }
    .risk-low { border-left: 4px solid #88cc00; }
    .score { font-size: 24px; font-weight: bold; color: #58a6ff; }
    .meta { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${report.title || '分析报告'}</h1>
    <p class="meta">生成时间: ${Formatters.datetime(new Date())}</p>
  </div>`;

    if (report.summary) {
      html += `<div class="card"><h2>执行摘要</h2><p>${report.summary}</p></div>`;
    }

    if (report.risks) {
      report.risks.forEach((risk, i) => {
        const riskInfo = Formatters.riskLevel(risk.score || 50);
        const riskClass = risk.score >= 60 ? 'risk-high' : risk.score >= 30 ? 'risk-medium' : 'risk-low';
        html += `<div class="card ${riskClass}">
          <h3>${riskInfo.emoji} ${risk.name} <span class="score">${risk.score || 0}</span></h3>
          <p>${risk.description || ''}</p>
          ${risk.mitigation ? `<p><strong>建议:</strong> ${risk.mitigation}</p>` : ''}
        </div>`;
      });
    }

    html += '</body></html>';
    return html;
  }

  /**
   * 格式化为 CSV 行
   */
  static toCSVRow(values, delimiter = ',') {
    return values.map(v => {
      const str = String(v ?? '');
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(delimiter);
  }

  /**
   * 生成风险雷达图数据
   */
  static radarChartData(dimensions) {
    return {
      labels: dimensions.map(d => d.name),
      datasets: [{
        label: '风险评分',
        data: dimensions.map(d => d.score || 0),
        backgroundColor: 'rgba(88, 166, 255, 0.2)',
        borderColor: 'rgba(88, 166, 255, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(88, 166, 255, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(88, 166, 255, 1)',
      }],
    };
  }
}

module.exports = { Formatters };
