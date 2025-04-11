async function processRepo(octokit, owner, repo, stats, isOrg = false) {
  try {
    console.log(`リポジトリ ${owner}/${repo} の情報を処理中...`);
    
    // このリポジトリでのコミット数を取得
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo,
        author: username,
        per_page: 100
      });
      
      const commitCount = commits.length;
      
      if (isOrg) {
        stats.organizations[owner].totalCommits += commitCount;
      }
      stats.totalCommits += commitCount;
      
      if (!stats.repos[`${owner}/${repo}`]) {
        stats.repos[`${owner}/${repo}`] = {};
      }
      stats.repos[`${owner}/${repo}`].commits = commitCount;
      
    } catch (error) {
      console.warn(`コミット取得エラー (${owner}/${repo}): ${error.message}`);
    }

    // このリポジトリでのPR数を取得
    try {
      const { data: prs } = await octokit.pulls.list({
        owner,
        repo,
        state: 'all',
        creator: username,
        per_page: 100
      });
      
      const prCount = prs.length;
      
      if (isOrg) {
        stats.organizations[owner].totalPRs += prCount;
      }
      stats.totalPRs += prCount;
      
      if (!stats.repos[`${owner}/${repo}`]) {
        stats.repos[`${owner}/${repo}`] = {};
      }
      stats.repos[`${owner}/${repo}`].prs = prCount;
      
    } catch (error) {
      console.warn(`PR取得エラー (${owner}/${repo}): ${error.message}`);
    }

    // このリポジトリでのIssue数を取得
    try {
      const { data: issues } = await octokit.issues.listForRepo({
        owner,
        repo,
        creator: username,
        state: 'all',
        per_page: 100
      });
      
      const issueCount = issues.length;
      
      if (isOrg) {
        stats.organizations[owner].totalIssues += issueCount;
      }
      stats.totalIssues += issueCount;
      
      if (!stats.repos[`${owner}/${repo}`]) {
        stats.repos[`${owner}/${repo}`] = {};
      }
      stats.repos[`${owner}/${repo}`].issues = issueCount;
      
    } catch (error) {
      console.warn(`Issue取得エラー (${owner}/${repo}): ${error.message}`);
    }

    // リポジトリの言語情報を取得
    try {
      const { data: languages } = await octokit.repos.listLanguages({
        owner,
        repo
      });
      
      // 言語統計を集計
      for (const [language, bytes] of Object.entries(languages)) {
        if (!stats.languages[language]) {
          stats.languages[language] = 0;
        }
        stats.languages[language] += bytes;
      }
    } catch (error) {
      console.warn(`言語取得エラー (${owner}/${repo}): ${error.message}`);
    }
  } catch (error) {
    console.error(`リポジトリ ${owner}/${repo} の処理中にエラー: ${error.message}`);
  }
}
