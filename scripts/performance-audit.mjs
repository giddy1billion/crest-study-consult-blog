#!/usr/bin/env node

/**
 * Crest Study Consult Performance Audit Script
 * 
 * Runs Lighthouse CI after builds to track Core Web Vitals.
 * Usage: npm run perf:audit [url]
 * 
 * Default URL: http://localhost:3000
 * Production: npm run perf:audit https://blog.creststudyconsult.com
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const BUDGETS = {
  performance: 90,
  accessibility: 95,
  'best-practices': 90,
  seo: 100,
  metrics: {
    'first-contentful-paint': 1800,
    'largest-contentful-paint': 2500,
    'total-blocking-time': 200,
    'cumulative-layout-shift': 0.1,
    'speed-index': 3000,
  }
};

async function runLighthouse(url) {
  console.log(`\n🔍 Running Lighthouse audit for: ${url}\n`);
  
  const outputDir = './lighthouse-reports';
  await fs.mkdir(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(outputDir, `lighthouse-${timestamp}`);
  
  try {
    const { stdout, stderr } = await execAsync(
      `npx lighthouse ${url} ` +
      `--output=json,html ` +
      `--output-path=${outputPath} ` +
      `--chrome-flags="--headless --no-sandbox" ` +
      `--emulated-form-factor=mobile ` +
      `--throttling.cpuSlowdownMultiplier=4 ` +
      `--only-categories=performance,accessibility,best-practices,seo`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    
    // Parse JSON report
    const reportJson = await fs.readFile(`${outputPath}.report.json`, 'utf8');
    const report = JSON.parse(reportJson);
    
    // Extract scores
    const scores = {
      performance: Math.round(report.categories.performance.score * 100),
      accessibility: Math.round(report.categories.accessibility.score * 100),
      'best-practices': Math.round(report.categories['best-practices'].score * 100),
      seo: Math.round(report.categories.seo.score * 100),
    };
    
    // Extract metrics
    const metrics = {
      FCP: report.audits['first-contentful-paint'].numericValue,
      LCP: report.audits['largest-contentful-paint'].numericValue,
      TBT: report.audits['total-blocking-time'].numericValue,
      CLS: report.audits['cumulative-layout-shift'].numericValue,
      SI: report.audits['speed-index'].numericValue,
    };
    
    // Print results
    console.log('📊 Lighthouse Scores:\n');
    console.log('  Category          Score   Target   Status');
    console.log('  ────────────────────────────────────────────');
    
    let allPassing = true;
    for (const [category, score] of Object.entries(scores)) {
      const target = BUDGETS[category];
      const passing = score >= target;
      const status = passing ? '✅' : '❌';
      if (!passing) allPassing = false;
      console.log(`  ${category.padEnd(18)} ${String(score).padStart(3)}     ${target}      ${status}`);
    }
    
    console.log('\n📈 Core Web Vitals:\n');
    console.log('  Metric   Value      Target     Status');
    console.log('  ────────────────────────────────────────────');
    
    const metricTargets = [
      ['FCP', metrics.FCP, BUDGETS.metrics['first-contentful-paint'], 'ms'],
      ['LCP', metrics.LCP, BUDGETS.metrics['largest-contentful-paint'], 'ms'],
      ['TBT', metrics.TBT, BUDGETS.metrics['total-blocking-time'], 'ms'],
      ['CLS', metrics.CLS, BUDGETS.metrics['cumulative-layout-shift'], ''],
      ['SI', metrics.SI, BUDGETS.metrics['speed-index'], 'ms'],
    ];
    
    for (const [name, value, target, unit] of metricTargets) {
      const passing = value <= target;
      const status = passing ? '✅' : '❌';
      if (!passing) allPassing = false;
      const displayValue = unit === 'ms' ? `${Math.round(value)}ms` : value.toFixed(3);
      const displayTarget = unit === 'ms' ? `${target}ms` : target;
      console.log(`  ${name.padEnd(7)}  ${String(displayValue).padStart(8)}   ${String(displayTarget).padStart(8)}   ${status}`);
    }
    
    console.log(`\n📁 Report saved: ${outputPath}.report.html\n`);
    
    if (!allPassing) {
      console.log('❌ Performance budget exceeded. Review recommendations in the HTML report.\n');
      process.exit(1);
    } else {
      console.log('✅ All performance budgets met!\n');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Lighthouse audit failed:', error.message);
    process.exit(1);
  }
}

// Get URL from command line or use default
const url = process.argv[2] || 'http://localhost:3000';
runLighthouse(url);
