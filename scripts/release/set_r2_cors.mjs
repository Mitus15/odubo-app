/**
 * Set the R2 bucket's CORS policy so browser uploads work.
 *
 *   node --env-file=.env.local scripts/release/set_r2_cors.mjs           # show current + planned
 *   node --env-file=.env.local scripts/release/set_r2_cors.mjs --apply   # write it
 *
 * WHY THIS EXISTS
 * ---------------
 * Every large upload in this app (Arsenal's videos, the warehouse's masters)
 * goes browser → R2 directly, because a 100MB request body cannot pass
 * through a Function. That means the browser does a cross-origin PUT to a
 * presigned URL, and two things must be true or it fails:
 *
 *   1. the page's origin is in AllowedOrigins, and
 *   2. ETag is in ExposeHeaders — without it the browser hides the ETag,
 *      and a multipart upload cannot be completed.
 *
 * Probed 2026-08-24, the live policy allows https://odubo.studio and exposes
 * ETag correctly, but returns 403 for https://odubo-app.vercel.app. Since
 * odubo.studio is lapsed and the site is served from the vercel.app URL,
 * browser uploads are broken in production right now — for Arsenal as much
 * as for the warehouse.
 *
 * R2 GOTCHA: unlike AWS S3, R2 does NOT accept "*" for headers. Every header
 * must be listed explicitly.
 *
 * NOTE: this needs a token with R2 *admin* rights. The R2 keys in .env.local
 * can read and write objects but not change bucket configuration, so running
 * this with them returns AccessDenied — that is expected, not a bug. Create
 * an "Admin Read & Write" R2 API token in the Cloudflare dashboard and pass
 * it as R2_ADMIN_ACCESS_KEY_ID / R2_ADMIN_SECRET_ACCESS_KEY, or set the same
 * policy by hand under R2 → the bucket → Settings → CORS Policy.
 */
import { S3Client, GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET;
const ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT;

const s3 = new S3Client({
  region: 'auto',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId:
      process.env.R2_ADMIN_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey:
      process.env.R2_ADMIN_SECRET_ACCESS_KEY ||
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      '',
  },
});

/**
 * Origins that must be able to upload. Deployment previews get a wildcard
 * entry; R2 accepts a wildcard in an ORIGIN, just never in a header list.
 * Never hardcode a single domain as the only entry — odubo.studio has lapsed
 * once already and may not come back.
 */
const ALLOWED_ORIGINS = [
  'https://odubo.studio',
  'https://www.odubo.studio',
  'https://admin.odubo.studio',
  'https://odubo-app.vercel.app',
  'https://*.vercel.app',
  'http://localhost:3000',
  'http://localhost:3111',
  'http://localhost:3112',
  'http://localhost:3113',
];

const RULES = [
  {
    AllowedOrigins: ALLOWED_ORIGINS,
    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
    // Explicit. R2 rejects "*" here, and a silent rejection looks exactly
    // like a network failure from the browser.
    AllowedHeaders: [
      'content-type',
      'content-md5',
      'content-length',
      'authorization',
      'x-amz-date',
      'x-amz-content-sha256',
      'x-amz-acl',
      'x-amz-user-agent',
      'range',
    ],
    // The whole point: without ETag a multipart upload cannot be completed.
    ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type', 'Content-Range', 'Accept-Ranges'],
    MaxAgeSeconds: 3600,
  },
];

async function main() {
  if (!BUCKET || !ENDPOINT) {
    console.error('CLOUDFLARE_R2_BUCKET_NAME and CLOUDFLARE_R2_ENDPOINT must be set.');
    process.exit(1);
  }
  console.log(`Bucket: ${BUCKET}\n`);

  try {
    const current = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
    console.log('Current policy:\n' + JSON.stringify(current.CORSRules, null, 2) + '\n');
  } catch (err) {
    console.log(`Could not read the current policy (${err.name}).`);
    if (err.name === 'AccessDenied') {
      console.log('These R2 keys can move objects but not change bucket config — expected.\n');
    }
  }

  if (!process.argv.includes('--apply')) {
    console.log('Planned policy (re-run with --apply to write it):\n');
    console.log(JSON.stringify(RULES, null, 2));
    return;
  }

  await s3.send(new PutBucketCorsCommand({ Bucket: BUCKET, CORSConfiguration: { CORSRules: RULES } }));
  console.log('Applied. Re-run the browser upload probe to confirm ETag comes back exposed.');
}

main().catch((err) => {
  console.error(`\nFailed: ${err.name} — ${err.message}`);
  if (err.name === 'AccessDenied') {
    console.error(
      '\nNeeds an R2 token with admin rights. Create one in the Cloudflare dashboard\n' +
        '(R2 → Manage API tokens → Admin Read & Write) and set R2_ADMIN_ACCESS_KEY_ID /\n' +
        'R2_ADMIN_SECRET_ACCESS_KEY, or paste the printed policy into\n' +
        'R2 → the bucket → Settings → CORS Policy.'
    );
  }
  process.exit(1);
});
