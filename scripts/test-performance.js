#!/usr/bin/env node

/**
 * 🚀 Performance Testing Script for Odubo Studio
 * Runs Lighthouse audits and generates performance reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logHeader = (title) => {
  log('\n' + '='.repeat(50), 'bright');
  log(` ${title}`, 'bright');
  log('='.repeat(50), 'bright');
};

const logSection = (title) => {
  log(`\n${title}`, 'cyan');
  log('-'.repeat(title.length));
};

const logSuccess = (message) => log(`✅ ${message}`, 'green');
const logWarning = (message) => log(`⚠️  ${message}`, 'yellow');
const logError = (message) => log(`❌ ${message}', 'red');
const logInfo = (message) => log(`ℹ️  ${message}`, 'blue');

// Check if required tools are installed
const checkDependencies = () => {
  logSection('Checking Dependencies');
  
  try {
    // Check if Lighthouse CI is installed
    execSync('lhci --version', { stdio: 'pipe' });
    logSuccess('Lighthouse CI is installed');
  } catch (error) {
    logError('Lighthouse CI is not installed');
    logInfo('Installing Lighthouse CI...');
    try {
      execSync('npm install -g @lhci/cli', { stdio: 'inherit' });
      logSuccess('Lighthouse CI installed successfully');
    } catch (installError) {
      logError('Failed to install Lighthouse CI');
      process.exit(1);
    }
  }
  
  try {
    // Check if Next.js dev server can start
    logInfo('Checking if Next.js dev server can start...');
    execSync('npm run build', { stdio: 'pipe' });
    logSuccess('Next.js build successful');
  } catch (error) {
    logError('Next.js build failed');
    process.exit(1);
  }
};

// Run Lighthouse CI audit
const runLighthouseAudit = () => {
  logSection('Running Lighthouse CI Audit');
  
  try {
    logInfo('Starting Lighthouse CI audit...');
    execSync('lhci autorun', { stdio: 'inherit' });
    logSuccess('Lighthouse CI audit completed');
  } catch (error) {
    logError('Lighthouse CI audit failed');
    logInfo('Trying manual Lighthouse run...');
    
    try {
      // Fallback to manual Lighthouse run
      execSync('npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-report.json', { stdio: 'inherit' });
      logSuccess('Manual Lighthouse audit completed');
    } catch (manualError) {
      logError('Manual Lighthouse audit also failed');
      process.exit(1);
    }
  }
};

// Generate performance report
const generatePerformanceReport = () => {
  logSection('Generating Performance Report');
  
  const reportPath = './lighthouse-report.json';
  if (!fs.existsSync(reportPath)) {
    logWarning('No Lighthouse report found');
    return;
  }
  
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const categories = report.categories;
    
    log('\n📊 Performance Report Summary:', 'bright');
    log('='.repeat(40));
    
    // Overall scores
    Object.entries(categories).forEach(([category, data]) => {
      const score = Math.round(data.score * 100);
      const color = score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red';
      log(`${category.charAt(0).toUpperCase() + category.slice(1)}: ${score}/100`, color);
    });
    
    // Core Web Vitals
    if (report.audits) {
      log('\n🎯 Core Web Vitals:', 'bright');
      log('-'.repeat(20));
      
      const coreVitals = {
        'Largest Contentful Paint': report.audits['largest-contentful-paint']?.numericValue,
        'First Input Delay': report.audits['first-input-delay']?.numericValue,
        'Cumulative Layout Shift': report.audits['cumulative-layout-shift']?.numericValue,
        'First Contentful Paint': report.audits['first-contentful-paint']?.numericValue,
        'Time to First Byte': report.audits['time-to-first-byte']?.numericValue,
      };
      
      Object.entries(coreVitals).forEach(([metric, value]) => {
        if (value !== undefined) {
          const formattedValue = metric.includes('Layout Shift') ? value.toFixed(3) : `${Math.round(value)}ms`;
          log(`${metric}: ${formattedValue}`);
        }
      });
    }
    
    // Recommendations
    log('\n💡 Recommendations:', 'bright');
    log('-'.repeat(20));
    
    if (categories.performance.score < 0.8) {
      logWarning('Performance score needs improvement');
      logInfo('Consider:');
      logInfo('  • Optimizing images and assets');
      logInfo('  • Implementing code splitting');
      logInfo('  • Reducing bundle size');
    }
    
    if (categories.accessibility.score < 0.9) {
      logWarning('Accessibility score needs improvement');
      logInfo('Consider:');
      logInfo('  • Adding alt text to images');
      logInfo('  • Improving color contrast');
      logInfo('  • Adding ARIA labels');
    }
    
    if (categories['best-practices'].score < 0.8) {
      logWarning('Best practices score needs improvement');
      logInfo('Consider:');
      logInfo('  • Using HTTPS');
      logInfo('  • Updating dependencies');
      logInfo('  • Following security best practices');
    }
    
    logSuccess('Performance report generated successfully');
    
  } catch (error) {
    logError('Failed to parse performance report');
    console.error(error);
  }
};

// Main execution
const main = async () => {
  logHeader('Odubo Studio Performance Testing');
  logInfo('Starting comprehensive performance audit...\n');
  
  try {
    checkDependencies();
    runLighthouseAudit();
    generatePerformanceReport();
    
    logHeader('Performance Testing Complete');
    logSuccess('All performance tests completed successfully!');
    logInfo('Check the generated reports for detailed analysis.');
    
  } catch (error) {
    logError('Performance testing failed');
    console.error(error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, checkDependencies, runLighthouseAudit, generatePerformanceReport };
