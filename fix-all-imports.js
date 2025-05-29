#!/usr/bin/env node

/**
 * Comprehensive script to fix ALL ESM import issues by adding .js extensions
 * This catches imports that the previous script missed
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

function fixImportsInFile(filePath) {
  console.log(`Fixing imports in: ${filePath}`);
  
  let content = readFileSync(filePath, 'utf8');
  let modified = false;
  
  // More comprehensive regex patterns to catch all import variations
  const patterns = [
    // Pattern 1: import ... from './path' or '../path' (without .js)
    /(import\s+.*?\s+from\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    // Pattern 2: export ... from './path' or '../path' (without .js) 
    /(export\s+.*?\s+from\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
  ];
  
  for (const pattern of patterns) {
    content = content.replace(pattern, (match, prefix, path, suffix) => {
      // Skip if already has .js extension
      if (path.endsWith('.js')) {
        return match;
      }
      
      // Skip if it's a directory import (we'll handle those separately)
      if (path.endsWith('/')) {
        return match;
      }
      
      // Skip npm packages (don't start with . or ..)
      if (!path.startsWith('.')) {
        return match;
      }
      
      // Add .js extension
      modified = true;
      const newPath = `${path}.js`;
      console.log(`    Fixed: ${path} → ${newPath}`);
      return prefix + newPath + suffix;
    });
  }
  
  if (modified) {
    writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function processDirectory(dirPath) {
  let totalFixed = 0;
  
  const items = readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      totalFixed += processDirectory(fullPath);
    } else if (extname(item) === '.js') {
      if (fixImportsInFile(fullPath)) {
        totalFixed++;
      }
    }
  }
  
  return totalFixed;
}

console.log('🔧 Comprehensive ESM Import Fixer - Round 2');
console.log('============================================');

const totalFixed = processDirectory('src/hyperfy/core');

console.log('\\n🎉 Import fixing complete!');
console.log(`📊 Total files modified: ${totalFixed}`);
console.log('\\n✅ All relative imports should now have .js extensions'); 