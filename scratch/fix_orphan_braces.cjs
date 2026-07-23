const fs = require('fs');
const path = 'src/components/portal/FrontpageView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Remove orphan } lines that appear between JSX element attributes
// Pattern: a line containing only whitespace + } when the previous non-empty line 
// was a JSX attribute (className=, etc.) and next line is style= or >
// This handles the leftover } from removed onClick handlers
const lines = content.split('\n');
const fixed = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Check if this line is JUST a closing } (orphan from removed onClick)
  if (trimmed === '}' && i > 0 && i < lines.length - 1) {
    const nextLine = lines[i + 1] ? lines[i + 1].trim() : '';
    const prevLine = lines[i - 1] ? lines[i - 1].trim() : '';
    
    // If previous line is a JSX className/attribute and next is style= or >
    // this is an orphan } from the removed onClick handler
    const prevIsAttr = prevLine.includes('className=') || prevLine.includes('md:col-span') || prevLine.includes('cursor-pointer') || prevLine.includes('transition-all');
    const nextIsAttr = nextLine.startsWith('style=') || nextLine.startsWith('>') || nextLine.startsWith('/*');
    
    if (prevIsAttr && nextIsAttr) {
      console.log(`Removing orphan } at line ${i + 1}: ...${prevLine.substring(0, 40)}...`);
      continue; // skip this line
    }
  }
  fixed.push(line);
}

fs.writeFileSync(path, fixed.join('\n'), 'utf8');
console.log('Done. Lines remaining:', fixed.length);
