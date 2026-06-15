#!/usr/bin/env node

/**
 * Crest Study Consult Bundle Size Budget Checker
 * 
 * Validates JavaScript bundle sizes against defined budgets.
 * Designed to run as a pre-commit hook or CI check.
 * 
 * Usage: node scripts/bundle-budget.mjs
 */

import fs from 'fs/promises';
import path from 'path';
import { gzipSync } from 'zlib';

// Bundle size budgets (in bytes, gzipped)
const BUDGETS = {
  // Critical path bundles
  'entry.client': 65 * 1024,      // 65KB gzipped
  'jsx-runtime': 50 * 1024,       // 50KB gzipped
  'layout': 8 * 1024,             // 8KB gzipped
  
  // Page bundles
  'home': 12 * 1024,              // 12KB gzipped
  '$category': 10 * 1024,         // 10KB gzipped
  '_category._slug': 15 * 1024,   // 15KB gzipped
  
  // Utility bundles
  'cn': 10 * 1024,                // 10KB gzipped (tailwind-merge)
  
  // Total budget for initial page load
  _totalInitial: 150 * 1024,      // 150KB gzipped total
};

// Bundles considered part of initial load
const INITIAL_BUNDLES = [
  'entry.client',
  'jsx-runtime',
  'layout',
  'home',
  'cn',
];

async function checkBundleSizes() {
  const buildDir = './build/client/assets';
  
  console.log('\n📦 Bundle Size Budget Check\n');
  console.log('  Bundle                Size (raw)   Size (gz)    Budget    Status');
  console.log('  ─────────────────────────────────────────────────────────────────');
  
  let hasViolations = false;
  let totalInitialGz = 0;
  
  try {
    const files = await fs.readdir(buildDir);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    const bundleData = [];
    
    for (const file of jsFiles) {
      const filePath = path.join(buildDir, file);
      const content = await fs.readFile(filePath);
      const gzipped = gzipSync(content);
      
      // Extract bundle name from filename (e.g., "entry.client-CFG8En04.js" -> "entry.client")
      const bundleName = file.replace(/-[A-Za-z0-9]+\.js$/, '');
      
      bundleData.push({
        name: bundleName,
        file,
        rawSize: content.length,
        gzSize: gzipped.length,
      });
    }
    
    // Sort by gzipped size descending
    bundleData.sort((a, b) => b.gzSize - a.gzSize);
    
    for (const bundle of bundleData) {
      const budget = BUDGETS[bundle.name];
      const rawKB = (bundle.rawSize / 1024).toFixed(1) + 'KB';
      const gzKB = (bundle.gzSize / 1024).toFixed(1) + 'KB';
      
      // Track initial load total
      if (INITIAL_BUNDLES.some(b => bundle.name.includes(b))) {
        totalInitialGz += bundle.gzSize;
      }
      
      if (budget) {
        const budgetKB = (budget / 1024).toFixed(0) + 'KB';
        const passing = bundle.gzSize <= budget;
        const status = passing ? '✅' : '❌';
        if (!passing) hasViolations = true;
        
        console.log(
          `  ${bundle.name.padEnd(22)} ${rawKB.padStart(8)}    ${gzKB.padStart(8)}    ${budgetKB.padStart(6)}    ${status}`
        );
      } else {
        // No budget defined - show info only for large bundles
        if (bundle.gzSize > 5 * 1024) {
          console.log(
            `  ${bundle.name.padEnd(22)} ${rawKB.padStart(8)}    ${gzKB.padStart(8)}    ${'-'.padStart(6)}    ℹ️`
          );
        }
      }
    }
    
    // Check total initial load
    console.log('  ─────────────────────────────────────────────────────────────────');
    const totalGzKB = (totalInitialGz / 1024).toFixed(1) + 'KB';
    const totalBudgetKB = (BUDGETS._totalInitial / 1024).toFixed(0) + 'KB';
    const totalPassing = totalInitialGz <= BUDGETS._totalInitial;
    const totalStatus = totalPassing ? '✅' : '❌';
    if (!totalPassing) hasViolations = true;
    
    console.log(
      `  ${'TOTAL INITIAL'.padEnd(22)} ${'-'.padStart(8)}    ${totalGzKB.padStart(8)}    ${totalBudgetKB.padStart(6)}    ${totalStatus}`
    );
    
    console.log('');
    
    if (hasViolations) {
      console.log('❌ Bundle size budget exceeded!\n');
      console.log('Recommendations:');
      console.log('  • Review imports for tree-shaking opportunities');
      console.log('  • Consider dynamic imports for non-critical code');
      console.log('  • Check for duplicate dependencies');
      console.log('  • Use bundle analyzer: npx vite-bundle-visualizer\n');
      process.exit(1);
    } else {
      console.log('✅ All bundle size budgets met!\n');
      process.exit(0);
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  Build directory not found. Run `npm run build` first.\n');
      process.exit(0); // Don't fail if no build exists
    }
    throw error;
  }
}

checkBundleSizes();
