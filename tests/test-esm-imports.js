#!/usr/bin/env node

/**
 * ESM Import Validation Test
 * Scans all JavaScript files to detect missing .js extensions in relative imports
 * This helps identify ALL import issues at once instead of discovering them one by one at runtime
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

console.log('🔍 ESM Import Validation Test');
console.log('============================');
console.log('Scanning for missing .js extensions in relative imports...\n');

const projectRoot = process.cwd();
const scanDirectories = [
  'src/hyperfy/core',
  'src/lib/physx',
  'src/servers',
  'src/core',
  'src/hyperfy/managers',
  'src/hyperfy/systems'
];

let totalFiles = 0;
let filesWithIssues = 0;
let totalIssues = 0;
const issuesByFile = new Map();

function findMissingExtensions(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Patterns to match relative imports without .js extensions
  const importPatterns = [
    // import ... from './path' or '../path'
    /(import\s+[^'"]*from\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    // export ... from './path' or '../path'
    /(export\s+[^'"]*from\s+['"])(\.\.?\/[^'"]*?)(['"])/g,
    // dynamic imports: import('./path')
    /(import\s*\(\s*['"])(\.\.?\/[^'"]*?)(['"])/g,
  ];
  
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0; // Reset regex state
    let match;
    while (true) {
      match = pattern.exec(content);
      if (!match) break;
      
      const [fullMatch, prefix, importPath, suffix] = match;
      
      // Skip if already has .js extension
      if (importPath.endsWith('.js')) continue;
      
      // Skip if it's a directory import (ends with /)
      if (importPath.endsWith('/')) continue;
      
      // Skip npm packages (don't start with . or ..)
      if (!importPath.startsWith('.')) continue;
      
      // Skip if it's trying to import a directory with index.js
      const resolvedPath = resolve(filePath, '..', importPath);
      const indexPath = join(resolvedPath, 'index.js');
      const directPath = `${resolvedPath}.js`;
      
      let expectedPath = '';
      let issueType = '';
      
      try {
        // Check if it should be importing index.js from a directory
        if (statSync(resolvedPath).isDirectory() && statSync(indexPath).isFile()) {
          expectedPath = `${importPath}/index.js`;
          issueType = 'missing_index';
        }
      } catch {
        try {
          // Check if it should be a direct .js file
          if (statSync(directPath).isFile()) {
            expectedPath = `${importPath}.js`;
            issueType = 'missing_extension';
          }
        } catch {
          // File doesn't exist at all
          expectedPath = `${importPath}.js (FILE NOT FOUND)`;
          issueType = 'missing_file';
        }
      }
      
      if (expectedPath) {
        issues.push({
          line: content.substring(0, match.index).split('\n').length,
          current: importPath,
          expected: expectedPath,
          type: issueType,
          fullMatch: fullMatch.trim()
        });
      }
    }
  }
  
  return issues;
}

function scanDirectory(dirPath, relativePath = '') {
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const relativeItemPath = relativePath ? join(relativePath, item) : item;
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and dist directories
          if (item === 'node_modules' || item === 'dist') continue;
          scanDirectory(fullPath, relativeItemPath);
        } else if (extname(item) === '.js') {
          totalFiles++;
          const issues = findMissingExtensions(fullPath);
          
          if (issues.length > 0) {
            filesWithIssues++;
            totalIssues += issues.length;
            issuesByFile.set(relativeItemPath, issues);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Warning: Could not process ${relativeItemPath}: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not scan directory ${dirPath}: ${error.message}`);
  }
}

// Scan all specified directories
for (const scanDir of scanDirectories) {
  const fullDirPath = join(projectRoot, scanDir);
  try {
    if (statSync(fullDirPath).isDirectory()) {
      console.log(`📁 Scanning: ${scanDir}`);
      scanDirectory(fullDirPath, scanDir);
    }
  } catch (error) {
    console.log(`📁 Skipping: ${scanDir} (not found)`);
  }
}

console.log('\n📊 Scan Results:');
console.log('================');
console.log(`📁 Total files scanned: ${totalFiles}`);
console.log(`🚨 Files with issues: ${filesWithIssues}`);
console.log(`⚠️  Total import issues: ${totalIssues}`);

if (totalIssues === 0) {
  console.log('\n🎉 SUCCESS: All imports have correct .js extensions!');
  console.log('✅ No ESM import issues found.');
  process.exit(0);
} else {
  console.log('\n🚨 ESM IMPORT ISSUES FOUND:');
  console.log('===========================');
  
  const issueTypeColors = {
    'missing_extension': '🔴',
    'missing_index': '🟡', 
    'missing_file': '🟠'
  };
  
  const issueTypeDescriptions = {
    'missing_extension': 'Missing .js extension',
    'missing_index': 'Should import index.js from directory',
    'missing_file': 'File does not exist'
  };
  
  // Group issues by type for better reporting
  const issuesByType = new Map();
  
  for (const [filePath, issues] of issuesByFile.entries()) {
    console.log(`\n📄 ${filePath}:`);
    
    for (const issue of issues) {
      const color = issueTypeColors[issue.type] || '⚪';
      const description = issueTypeDescriptions[issue.type] || 'Unknown issue';
      
      console.log(`   ${color} Line ${issue.line}: ${description}`);
      console.log(`      Current:  ${issue.current}`);
      console.log(`      Expected: ${issue.expected}`);
      console.log(`      Context:  ${issue.fullMatch}`);
      
      // Track by type for summary
      if (!issuesByType.has(issue.type)) {
        issuesByType.set(issue.type, []);
      }
      issuesByType.get(issue.type).push({ file: filePath, issue });
    }
  }
  
  console.log('\n📈 Issue Summary by Type:');
  console.log('=========================');
  
  for (const [type, typeIssues] of issuesByType.entries()) {
    const color = issueTypeColors[type] || '⚪';
    const description = issueTypeDescriptions[type] || 'Unknown';
    console.log(`${color} ${description}: ${typeIssues.length} issues`);
  }
  
  console.log('\n💡 Recommended Actions:');
  console.log('=======================');
  console.log('1. 🔧 Run the import fixer script to automatically resolve issues');
  console.log('2. 🔍 Manually review any "FILE NOT FOUND" issues');
  console.log('3. ✅ Re-run this test to verify all issues are resolved');
  console.log('4. 🚀 Test the application to ensure imports work correctly');
  
  process.exit(1);
} 