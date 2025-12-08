
const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log('Fetching clips...');
  // Fetch clips
  const clipsJson = execSync('npx wrangler d1 execute odubo --command "SELECT id, title, related_projects, position, created_at FROM videos WHERE type = \'clip\'" --json --remote', { encoding: 'utf-8' });
  const clips = JSON.parse(clipsJson)[0].results;

  console.log(`Found ${clips.length} clips.`);

  // Fetch all videos (parents)
  console.log('Fetching parent videos...');
  const videosJson = execSync('npx wrangler d1 execute odubo --command "SELECT id, title FROM videos WHERE type != \'clip\'" --json --remote', { encoding: 'utf-8' });
  const videos = JSON.parse(videosJson)[0].results;
  
  const videoMap = new Map();
  videos.forEach(v => videoMap.set(v.id, v.title));

  const parentMap = new Map();

  // Group clips by parent
  for (const clip of clips) {
    let parentId = null;
    if (clip.related_projects) {
      try {
        // Handle both string and parsed JSON if D1 returns it differently
        let rel = clip.related_projects;
        if (typeof rel === 'string') rel = JSON.parse(rel);
        
        if (Array.isArray(rel)) {
          for (const r of rel) {
            if (r.startsWith('parent_id:')) {
              parentId = parseInt(r.split(':')[1], 10);
              break;
            }
          }
        }
      } catch (e) {
        // console.warn('Parse error', e);
      }
    }

    if (parentId) {
      if (!parentMap.has(parentId)) parentMap.set(parentId, []);
      parentMap.get(parentId).push(clip);
    }
  }

  let sql = 'BEGIN TRANSACTION;\n';
  let count = 0;

  for (const [parentId, parentClips] of parentMap.entries()) {
    const parentTitle = videoMap.get(parentId);
    if (!parentTitle) continue;

    // Sort
    parentClips.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    for (let i = 0; i < parentClips.length; i++) {
      const clip = parentClips[i];
      const newTitle = `${parentTitle} ${i + 1}`;
      
      // Escape single quotes for SQL
      const safeTitle = newTitle.replace(/'/g, "''");
      
      if (clip.title !== newTitle) {
        sql += `UPDATE videos SET title = '${safeTitle}' WHERE id = ${clip.id};\n`;
        count++;
      }
    }
  }
  
  sql += 'COMMIT;\n';

  fs.writeFileSync('scripts/rename_clips.sql', sql);
  console.log(`Generated SQL to rename ${count} clips. Run:`);
  console.log('npx wrangler d1 execute odubo --file scripts/rename_clips.sql --remote');

} catch (e) {
  console.error(e);
}
