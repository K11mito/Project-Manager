const { Octokit } = require('@octokit/rest');

function parseRepoUrl(url) {
  if (!url) return null;
  // Handle: https://github.com/owner/repo, github.com/owner/repo, owner/repo
  const match = url.match(/(?:github\.com\/)?([^/]+)\/([^/.\s]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

async function getRecentCommits(token, repoUrl) {
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return [];

  try {
    const octokit = new Octokit({ auth: token });
    const { data } = await octokit.repos.listCommits({
      owner: parsed.owner,
      repo: parsed.repo,
      per_page: 10,
    });

    return data.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      date: commit.commit.author.date,
    }));
  } catch (err) {
    console.error('GitHub API error:', err.message);
    return [];
  }
}

module.exports = { getRecentCommits, parseRepoUrl };
