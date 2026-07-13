// Netlify's equivalent of the Vercel Cron in vercel.json: fires on the same
// schedule and just calls the app's existing /api/cron/sync-email route, so
// the sync logic itself only lives in one place (src/lib/emailSync.ts).
export default async () => {
  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    console.error("scheduled-sync: no site URL available in the function environment.");
    return;
  }

  const res = await fetch(`${siteUrl}/api/cron/sync-email`, {
    headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
  });
  const body = await res.text();
  console.log(`scheduled-sync: ${res.status} ${body}`);
};

export const config = {
  schedule: "0 11 * * *",
};
