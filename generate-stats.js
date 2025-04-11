// CommonJSモジュールで動的インポートを使用する方法
const fs = require('fs-extra');

// ユーザー名
const username = 'tomoya0318';

// 含める組織名を実際の組織名に変更
const organizations = ['TestMate-Team', 'Programming-Training']; 

// 除外したいリポジトリ
const excludeRepos = ['tomoya-readme', 'TestMate'];

// メイン処理を実行する非同期関数
async function run() {
  try {
    // 動的インポートを使用
    const { Octokit } = await import('@octokit/rest');
    
    // GitHub API クライアントを初期化（プライベートリポジトリへのアクセスを許可）
    const octokit = new Octokit({
      auth: process.env.GH_TOKEN,
    });
    
    await generateStats(octokit);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

async function generateStats(octokit) {
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

    // ユーザーの個人リポジトリの統計を取得（プライベートリポジトリも含む）
    console.log('個人リポジトリの情報を取得中...');
    
    // 注意: listForUserではなくlistForAuthenticatedUserを使用
    const { data: userRepos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      affiliation: 'owner' // 個人所有のリポジトリのみ
    });
    
    // 除外リポジトリをフィルタリング
    const filteredUserRepos = userRepos.filter(repo => !excludeRepos.includes(repo.name));
    
    // 個人リポジトリの統計を集計
    for (const repo of filteredUserRepos) {
      console.log(`処理中: ${repo.name} (プライベート: ${repo.private ? 'はい' : 'いいえ'})`);
      await processRepo(octokit, repo.owner.login, repo.name, stats);
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
        // 組織のリポジトリを取得（プライベートリポジトリを含む）
        const { data: orgRepos } = await octokit.repos.listForOrg({
          org,
          per_page: 100,
          type: 'all' // パブリックとプライベート両方を含める
        });
        
        // 除外リポジトリをフィルタリング
        const filteredOrgRepos = orgRepos.filter(repo => !excludeRepos.includes(repo.name));
        
        stats.organizations[org].repositories = filteredOrgRepos.length;
        
        // 組織の各リポジトリについて統計を集計
        for (const repo of filteredOrgRepos) {
          console.log(`処理中: ${org}/${repo.name} (プライベート: ${repo.private ? 'はい' : 'いいえ'})`);
          await processRepo(octokit, org, repo.name, stats, true);
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

// 残りの関数は変更なし
// ...

// 実行
run();
