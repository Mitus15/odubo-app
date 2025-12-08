
import { queryDatabase, executeQuery } from '../src/lib/db';

async function fixClipTitles() {
  console.log('Starting clip title fix...');

  // 1. Find all clips
  const clips = await queryDatabase(`
    SELECT id, title, related_projects, position, created_at 
    FROM videos 
    WHERE type = 'clip'
  `);

  console.log(`Found ${clips.length} clips.`);

  for (const clip of clips) {
    try {
      // 2. Extract parent ID
      let parentId: number | null = null;
      if (clip.related_projects) {
        try {
          const rel = JSON.parse(clip.related_projects);
          if (Array.isArray(rel)) {
            for (const r of rel) {
              if (r.startsWith('parent_id:')) {
                parentId = parseInt(r.split(':')[1], 10);
                break;
              }
            }
          }
        } catch (e) {
          console.warn(`Failed to parse related_projects for clip ${clip.id}:`, e);
        }
      }

      if (!parentId) {
        console.warn(`No parent ID found for clip ${clip.id} (${clip.title})`);
        continue;
      }

      // 3. Get Parent Video
      const parents = await queryDatabase('SELECT title FROM videos WHERE id = ?', [parentId]);
      if (!parents || parents.length === 0) {
        console.warn(`Parent video ${parentId} not found for clip ${clip.id}`);
        continue;
      }
      const parentTitle = parents[0].title;

      // 4. Determine new title
      // We want "ParentTitle X".
      // If we have position, use it + 1. Else use a counter based on created_at?
      // For simplicity, let's assume position is populated or we can infer it.
      // If position is 0, maybe we should just use "ParentTitle 1" if it's the only one?
      // Or we can query all clips for this parent and re-number them.
      
      // Let's re-number all clips for this parent to be safe.
      // We'll do this by grouping processing by parentId, but here we are iterating clips.
      // Let's just use the current clip's position if available, or fallback to "1".
      
      // Actually, better approach: Group by parent first.
    } catch (e) {
      console.error(`Error processing clip ${clip.id}:`, e);
    }
  }

  // Better approach: Iterate parents
  const parentsWithClips = await queryDatabase(`
    SELECT DISTINCT CAST(SUBSTR(value, 11) AS INTEGER) as parent_id
    FROM videos, json_each(videos.related_projects)
    WHERE type = 'clip' AND value LIKE 'parent_id:%'
  `);
  
  // The above SQL might be complex for D1/SQLite depending on JSON support.
  // Let's stick to iterating clips and building a map.
  
  const parentMap = new Map<number, any[]>();
  
  for (const clip of clips) {
    let parentId: number | null = null;
    if (clip.related_projects) {
      try {
        const rel = JSON.parse(clip.related_projects);
        if (Array.isArray(rel)) {
          for (const r of rel) {
            if (r.startsWith('parent_id:')) {
              parentId = parseInt(r.split(':')[1], 10);
              break;
            }
          }
        }
      } catch {}
    }
    
    if (parentId) {
      if (!parentMap.has(parentId)) parentMap.set(parentId, []);
      parentMap.get(parentId)?.push(clip);
    }
  }

  console.log(`Found ${parentMap.size} parents with clips.`);

  for (const [parentId, parentClips] of parentMap.entries()) {
    const parents = await queryDatabase('SELECT title FROM videos WHERE id = ?', [parentId]);
    if (!parents.length) continue;
    const parentTitle = parents[0].title;

    // Sort clips by position, then created_at
    parentClips.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    for (let i = 0; i < parentClips.length; i++) {
      const clip = parentClips[i];
      const newTitle = `${parentTitle} ${i + 1}`;
      
      if (clip.title !== newTitle) {
        console.log(`Renaming clip ${clip.id}: "${clip.title}" -> "${newTitle}"`);
        await executeQuery('UPDATE videos SET title = ? WHERE id = ?', [newTitle, clip.id]);
      }
    }
  }

  console.log('Done.');
}

fixClipTitles().catch(console.error);
