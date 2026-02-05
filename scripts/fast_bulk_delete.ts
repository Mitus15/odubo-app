import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY as string,
  },
});

async function bulkDelete(prefix: string) {
  console.log(`\n🗑️  Deleting ${prefix}...`);
  const objects = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: 1000,
  }));

  if (!objects.Contents || objects.Contents.length === 0) {
    console.log(`  ℹ️  No objects found with prefix: ${prefix}`);
    return 0;
  }

  const keys = objects.Contents.map(obj => ({ Key: obj.Key as string }));
  console.log(`  Found ${keys.length} objects, deleting...`);

  await s3.send(new DeleteObjectsCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Delete: { Objects: keys },
  }));

  console.log(`  ✅ Deleted ${keys.length} objects`);
  return keys.length;
}

async function deleteRootLevelFiles() {
  console.log('\n🗑️  Deleting root-level files...');
  const objects = await s3.send(new ListObjectsV2Command({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    MaxKeys: 1000,
  }));

  if (!objects.Contents) {
    console.log('  No objects found');
    return 0;
  }

  // Filter to only root-level files (no "/" in key)
  const rootFiles = objects.Contents.filter(obj => obj.Key && !obj.Key.includes('/'));
  
  if (rootFiles.length === 0) {
    console.log('  ℹ️  No root-level files found');
    return 0;
  }

  const keys = rootFiles.map(obj => ({ Key: obj.Key as string }));
  console.log(`  Found ${keys.length} root-level files, deleting...`);
  console.log(`  Files: ${keys.map(k => k.Key).join(', ')}`);

  await s3.send(new DeleteObjectsCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
    Delete: { Objects: keys },
  }));

  console.log(`  ✅ Deleted ${keys.length} root-level files`);
  return keys.length;
}

async function main() {
  console.log('🚀 Final R2 Cleanup\n');
  
  let total = 0;
  total += await deleteRootLevelFiles();
  total += await bulkDelete('featured/');
  total += await bulkDelete('videos/');
  total += await bulkDelete('music/');
  total += await bulkDelete('cover-art/');
  total += await bulkDelete('brand-assets/');
  total += await bulkDelete('social/');
  
  console.log(`\n✅ All done! Deleted ${total} objects total.`);
  console.log('📁 Only galleries/ folder remains.');
}

main().catch(console.error);
