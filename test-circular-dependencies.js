const fs = require('fs');
const path = require('path');
const { businessLogger } = require('./utils/logger');

class DependencyAnalyzer {
  constructor() {
    this.dependencies = new Map();
    this.circularDependencies = [];
    this.servicesDir = path.join(__dirname, 'services');
    this.coreDir = path.join(__dirname, 'core');
  }

  // 分析文件中的依賴
  analyzeDependencies(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const requires = this.extractRequires(content);
      const serviceName = path.basename(filePath, '.js');
      this.dependencies.set(serviceName, requires);
    } catch (err) {
      businessLogger.error(`分析文件 ${filePath} 失敗: ${err.message}`);
    }
  }

  // 提取 require 語句
  extractRequires(content) {
    const requires = new Set();
    // 匹配 require('../services/xxx') 或 require('./xxx') 或 const xxx = require('xxx')
    const requirePattern = /require\(['"]([^'"]+)['"]\)/g;
    let match;

    while ((match = requirePattern.exec(content)) !== null) {
      const requirePath = match[1];
      if (requirePath.includes('services/') || requirePath.includes('core/')) {
        const serviceName = path.basename(requirePath, '.js');
        requires.add(serviceName);
      }
    }

    return Array.from(requires);
  }

  // 檢測循環依賴
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (service, path = []) => {
      if (recursionStack.has(service)) {
        const cycle = path.slice(path.indexOf(service));
        cycle.push(service);
        this.circularDependencies.push(cycle);
        return true;
      }

      if (visited.has(service)) {
        return false;
      }

      visited.add(service);
      recursionStack.add(service);
      path.push(service);

      const dependencies = this.dependencies.get(service) || [];
      for (const dep of dependencies) {
        if (dfs(dep, [...path])) {
          return true;
        }
      }

      recursionStack.delete(service);
      return false;
    };

    for (const service of this.dependencies.keys()) {
      if (!visited.has(service)) {
        dfs(service);
      }
    }
  }

  // 分析所有服務文件
  async analyzeAllServices() {
    // 分析 services 目錄
    const serviceFiles = fs.readdirSync(this.servicesDir)
      .filter(file => file.endsWith('.js'));

    for (const file of serviceFiles) {
      this.analyzeDependencies(path.join(this.servicesDir, file));
    }

    // 分析 core 目錄
    const coreFiles = fs.readdirSync(this.coreDir)
      .filter(file => file.endsWith('.js'));

    for (const file of coreFiles) {
      this.analyzeDependencies(path.join(this.coreDir, file));
    }

    // 檢測循環依賴
    this.detectCircularDependencies();

    return {
      dependencies: Object.fromEntries(this.dependencies),
      circularDependencies: this.circularDependencies
    };
  }

  // 生成依賴報告
  generateReport() {
    let report = '# 服務依賴分析報告\n\n';
    
    report += '## 所有服務依賴關係\n';
    for (const [service, deps] of this.dependencies) {
      report += `\n### ${service}\n`;
      if (deps.length === 0) {
        report += '- 無依賴\n';
      } else {
        deps.forEach(dep => {
          report += `- ${dep}\n`;
        });
      }
    }

    report += '\n## 檢測到的循環依賴\n';
    if (this.circularDependencies.length === 0) {
      report += '✅ 未檢測到循環依賴\n';
    } else {
      this.circularDependencies.forEach((cycle, index) => {
        report += `\n### 循環依賴 #${index + 1}\n`;
        report += `${cycle.join(' -> ')} -> ${cycle[0]}\n`;
      });
    }

    return report;
  }
}

// 執行分析
async function runAnalysis() {
  console.log('開始分析服務依賴關係...');
  const analyzer = new DependencyAnalyzer();
  
  try {
    await analyzer.analyzeAllServices();
    const report = analyzer.generateReport();
    
    // 寫入報告文件
    fs.writeFileSync('DEPENDENCY_ANALYSIS.md', report);
    console.log('分析報告已生成: DEPENDENCY_ANALYSIS.md');
    
    // 如果發現循環依賴，拋出錯誤
    if (analyzer.circularDependencies.length > 0) {
      throw new Error(`檢測到 ${analyzer.circularDependencies.length} 個循環依賴`);
    }
    
    console.log('✅ 依賴分析完成，未發現循環依賴');
    return true;
  } catch (err) {
    console.error('❌ 依賴分析失敗:', err.message);
    businessLogger.error(`依賴分析失敗: ${err.message}`);
    return false;
  }
}

// 如果直接運行此文件
if (require.main === module) {
  runAnalysis();
}

module.exports = {
  DependencyAnalyzer,
  runAnalysis
}; 