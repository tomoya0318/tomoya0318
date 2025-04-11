const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');

// GitHub API クライアントを初期化
const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
});

// ユーザー名
const username = 'tomoya0318';

// 含める組織名（あなたの組織名に変更）
const organizations = ['組織名1', '組織名2']; // 実際の組織名に置き換え

// 除外したいリポジトリ
const excludeRepos = ['tomoya-readme', 'TestMate'];

async function generateStats() {
  try {
    console.log('GitHub統計の生成を開始...');
    
    // 統計情報を格納するオブジェクト
    const stats = {
      totalCommits: 0,
      totalPRs: 0,
      totalIssues: 0,
      languages: {},
      organizations: {},
      repos: {}
    };

    // ユーザーの個人リポジトリの統計を取得
    console.log('個人リポジトリの情報を取得中...');
    const { data: userRepos } = await octokit.repos.listForUser({
      username,
      per_page: 100
    });
    
    // 除外リポジトリをフィルタリング
    const filteredUserRepos = userRepos.filter(repo => !excludeRepos.includes(repo.name));
    
    // 個人リポジトリの統計を集計
    for (const repo of filteredUserRepos) {
      await processRepo(repo.owner.login, repo.name, stats);
    }

    // 組織リポジトリの統計を取得
    for (const org of organizations) {
      console.log(`組織 ${org} の情報を取得中...`);
      stats.organizations[org] = {
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        repositories: 0
      };
      
      try {
        const { data: orgRepos } = await octokit.repos.listForOrg({
          org,
          per_page: 100
        });
        
        // 除外リポジトリをフィルタリング
        const filteredOrgRepos = orgRepos.filter(repo => !excludeRepos.includes(repo.name));
        
        stats.organizations[org].repositories = filteredOrgRepos.length;
        
        // 組織の各リポジトリについて統計を集計
        for (const repo of filteredOrgRepos) {
          await processRepo(org, repo.name, stats, true);
        }
      } catch (error) {
        console.error(`組織 ${org} の情報取得中にエラー: ${error.message}`);
      }
    }

    // 統計情報をJSON形式で保存
    await fs.writeJson('./github-stats.json', stats, { spaces: 2 });
    
    // SVG形式での統計情報も生成
    const svgContent = generateSVG(stats);
    await fs.writeFile('./github-stats.svg', svgContent);

    // マークダウン形式でも保存（README用）
    const mdContent = generateMarkdown(stats);
    await fs.writeFile('./github-stats.md', mdContent);

    console.log('GitHub統計の生成が完了しました！');
  } catch (error) {
    console.error('統計生成中にエラーが発生しました:', error);
  }
}

async function processRepo(owner, repo, stats, isOrg = false) {
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

// SVGを生成する関数
function generateSVG(stats) {
  const width = 800;
  const height = 500;
  
  // 組織情報を表示するテキスト
  let orgSections = '';
  let yOffset = 180;
  
  Object.entries(stats.organizations).forEach(([org, data], index) => {
    orgSections += `
      <g transform="translate(25, ${yOffset + index * 70})">
        <text x="0" y="0" class="stat-title">Organization: ${org}</text>
        <text x="0" y="25" class="stat">Commits: ${data.totalCommits}</text>
        <text x="150" y="25" class="stat">PRs: ${data.totalPRs}</text>
        <text x="250" y="25" class="stat">Issues: ${data.totalIssues}</text>
        <text x="350" y="25" class="stat">Repos: ${data.repositories}</text>
      </g>
    `;
  });

  // 言語情報を表示
  let languageSection = '';
  const topLanguages = Object.entries(stats.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  topLanguages.forEach(([language, bytes], index) => {
    const percentage = (bytes / Object.values(stats.languages).reduce((a, b) => a + b, 0) * 100).toFixed(1);
    languageSection += `
      <text x="500" y="${200 + index * 25}" class="stat">${language}: ${percentage}%</text>
    `;
  });

  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .bg { fill: #0d1117; }
      .title { fill: #f0f6fc; font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; }
      .stat-title { fill: #58a6ff; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; }
      .stat { fill: #8b949e; font-family: Arial, sans-serif; font-size: 16px; }
      .footer { fill: #8b949e; font-family: Arial, sans-serif; font-size: 12px; }
    </style>
    <rect class="bg" x="0" y="0" width="${width}" height="${height}" rx="10"/>
    <g transform="translate(25, 40)">
      <text x="0" y="0" class="title">${username}'s GitHub Stats</text>
      <text x="0" y="40" class="stat-title">Total Contributions</text>
      <text x="0" y="70" class="stat">Commits: ${stats.totalCommits}</text>
      <text x="150" y="70" class="stat">PRs: ${stats.totalPRs}</text>
      <text x="250" y="70" class="stat">Issues: ${stats.totalIssues}</text>
      
      <text x="500" y="40" class="stat-title">Top Languages</text>
      ${languageSection}
      
      <text x="0" y="130" class="stat-title">Organization Contributions</text>
      ${orgSections}
      
      <text x="0" y="${height - 30}" class="footer">Last updated: ${new Date().toISOString().split('T')[0]}</text>
    </g>
  </svg>
  `;
}

// マークダウンを生成する関数
function generateMarkdown(stats) {
  let md = `# ${username}'s GitHub Statistics\n\n`;
  
  md += `## Overall Stats\n\n`;
  md += `- **Total Commits:** ${stats.totalCommits}\n`;
  md += `- **Total Pull Requests:** ${stats.totalPRs}\n`;
  md += `- **Total Issues:** ${stats.totalIssues}\n\n`;
  
  md += `## Organization Contributions\n\n`;
  for (const [org, data] of Object.entries(stats.organizations)) {
    md += `### ${org}\n\n`;
    md += `- **Commits:** ${data.totalCommits}\n`;
    md += `- **Pull Requests:** ${data.totalPRs}\n`;
    md += `- **Issues:** ${data.totalIssues}\n`;
    md += `- **Repositories:** ${data.repositories}\n\n`;
  }
  
  md += `## Top Languages\n\n`;
  const totalBytes = Object.values(stats.languages).reduce((a, b) => a + b, 0);
  const topLanguages = Object.entries(stats.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [language, bytes] of topLanguages) {
    const percentage = (bytes / totalBytes * 100).toFixed(2);
    md += `- **${language}:** ${percentage}%\n`;
  }
  
  md += `\n*Last updated: ${new Date().toISOString().split('T')[0]}*\n`;
  
  return md;
}

// メイン処理を実行
generateStats();
