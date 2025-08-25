// Cloudflare Worker R2 + D1 update and delete for videos
// PUT: update video metadata (and optionally video/thumbnail files)
// DELETE: remove video and thumbnail from R2 and D1

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop();
    if (!id) return new Response("Missing video id", { status: 400 });

    if (request.method === "PUT") {
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.startsWith("multipart/form-data")) {
        return new Response("Invalid content type", { status: 400 });
      }
      const formData = await request.formData();
      // Optionally handle new file uploads
      let videoUrl, thumbnailUrl;
      const fileEntry = formData.get("file");
      const thumbnailEntry = formData.get("thumbnail");
      if (fileEntry instanceof File) {
        const uuid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const fileKey = `videos/${uuid}-${fileEntry.name}`;
        await env.R2.put(fileKey, await fileEntry.arrayBuffer(), { httpMetadata: { contentType: fileEntry.type } });
        videoUrl = `https://media.odubo.studio/${fileKey}`;
      }
      if (thumbnailEntry instanceof File) {
        const thumbUuid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        const thumbnailKey = `thumbnails/${thumbUuid}-${thumbnailEntry.name}`;
        await env.R2.put(thumbnailKey, await thumbnailEntry.arrayBuffer(), { httpMetadata: { contentType: thumbnailEntry.type } });
        thumbnailUrl = `https://media.odubo.studio/${thumbnailKey}`;
      }
      // Parse other fields
      const title = formData.get("title")?.toString() || undefined;
      const description = formData.get("description")?.toString() || undefined;
      const duration = formData.get("duration")?.toString() || undefined;
      const category = formData.get("category")?.toString() || undefined;
      const is_public = formData.get("is_public") === "true" ? 1 : undefined;
      const type = formData.get("type")?.toString() || undefined;
      const mood = formData.get("mood")?.toString() || undefined;
      const credits = formData.get("credits")?.toString() || undefined;
      const related_projects = formData.get("related_projects")?.toString() || undefined;
      // Build update statement
      const fields = [];
      const params = [];
      if (title !== undefined) { fields.push("title = ?"); params.push(title); }
      if (description !== undefined) { fields.push("description = ?"); params.push(description); }
      if (videoUrl) { fields.push("url = ?"); params.push(videoUrl); }
      if (thumbnailUrl) { fields.push("thumbnail = ?"); params.push(thumbnailUrl); }
      if (duration !== undefined) { fields.push("duration = ?"); params.push(duration); }
      if (category !== undefined) { fields.push("category = ?"); params.push(category); }
      if (is_public !== undefined) { fields.push("is_public = ?"); params.push(is_public); }
      if (type !== undefined) { fields.push("type = ?"); params.push(type); }
      if (mood !== undefined) { fields.push("mood = ?"); params.push(mood); }
      if (credits !== undefined) { fields.push("credits = ?"); params.push(credits); }
      if (related_projects !== undefined) { fields.push("related_projects = ?"); params.push(related_projects); }
      if (fields.length === 0) return new Response("No fields to update", { status: 400 });
      const stmt = `UPDATE videos SET ${fields.join(", ")} WHERE id = ? RETURNING *;`;
      params.push(id);
      const result = await env.DB.prepare(stmt).bind(...params).first();
      return Response.json({ video: result });
    }

    if (request.method === "DELETE") {
      // Get video record
      const video = await env.DB.prepare("SELECT url, thumbnail FROM videos WHERE id = ?").bind(id).first();
      if (!video) return new Response("Not found", { status: 404 });
      // Delete from R2
      if (video.url) {
        const key = video.url.replace("https://media.odubo.studio/", "");
        await env.R2.delete(key);
      }
      if (video.thumbnail) {
        const key = video.thumbnail.replace("https://media.odubo.studio/", "");
        await env.R2.delete(key);
      }
      // Delete from D1
      await env.DB.prepare("DELETE FROM videos WHERE id = ?").bind(id).run();
      return Response.json({ success: true });
    }

    return new Response("Method Not Allowed", { status: 405 });
  },
};
