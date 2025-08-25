#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { readdirSync, statSync } from 'fs';
import path from 'path';

function findRouteFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      findRouteFiles(fullPath, files);
    } else if (item === 'route.ts') {
      files.push(fullPath);
    }
  }
  
  return files;
}

function fixParams() {
  try {
    // Find all API route files
    const files = findRouteFiles('src/app/api');
    
    console.log(`Found ${files.length} API route files to fix...`);
    
    let fixedCount = 0;
    
    for (const file of files) {
      let content = readFileSync(file, 'utf8');
      let modified = false;
      
      // Fix params type from { id: string } to Promise<{ id: string }>
      if (content.includes('params: { id: string }')) {
        content = content.replace(
          /params: \{ id: string \}/g,
          'params: Promise<{ id: string }>'
        );
        modified = true;
      }
      
      // Fix params destructuring from params.id to await params.id
      if (content.includes('const { id } = params;')) {
        content = content.replace(
          /const \{ id \} = params;/g,
          'const { id } = await params;'
        );
        modified = true;
      }
      
      if (modified) {
        writeFileSync(file, content, 'utf8');
        console.log(`Fixed: ${file}`);
        fixedCount++;
      }
    }
    
    console.log(`\nFixed ${fixedCount} files successfully!`);
    
  } catch (error) {
    console.error('Error fixing params:', error);
  }
}

fixParams();
