import { writeFile } from 'node:fs/promises';

const { GITHUB_SHA, LAUNCHER_COMMIT, LAUNCHER_WEBSITE_RUN } = process.env;
if (![GITHUB_SHA, LAUNCHER_COMMIT].every(value => /^[a-f0-9]{40}$/.test(value || '')) ||
    !/^\d+$/.test(LAUNCHER_WEBSITE_RUN || '') || !process.argv[2]) {
  throw new Error('Missing or invalid deployment revisions');
}

await writeFile(process.argv[2], `${JSON.stringify({
  homepageCommit: GITHUB_SHA,
  launcherCommit: LAUNCHER_COMMIT,
  launcherWebsiteRun: LAUNCHER_WEBSITE_RUN,
}, null, 2)}\n`);
