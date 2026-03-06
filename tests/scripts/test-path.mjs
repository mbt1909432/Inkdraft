/**
 * 测试文件是否在 artifacts/ 路径下
 */

import 'dotenv/config';
import { AcontextClient, SANDBOX_TOOLS } from '@acontext/acontext';

async function main() {
  const apiKey = process.env.ACONTEXT_API_KEY;
  if (!apiKey) {
    console.error('请设置 ACONTEXT_API_KEY 环境变量');
    process.exit(1);
  }

  const client = new AcontextClient({ apiKey });

  // 创建 disk 和 sandbox
  console.log('创建 disk 和 sandbox...');
  const disk = await client.disks.create();
  const sandbox = await client.sandboxes.create();

  try {
    // 创建测试文件
    console.log('创建测试文件...');
    const ctx1 = await SANDBOX_TOOLS.formatContext(client, sandbox.sandbox_id, disk.id);
    await SANDBOX_TOOLS.executeTool(ctx1, 'text_editor_sandbox', {
      command: 'create',
      path: '/workspace/test.png',
      file_text: 'fake image content',
    });

    // 导出文件
    console.log('\n导出文件...');
    const ctx2 = await SANDBOX_TOOLS.formatContext(client, sandbox.sandbox_id, disk.id);
    const resultStr = await SANDBOX_TOOLS.executeTool(ctx2, 'export_file_sandbox', {
      sandbox_path: '/workspace/',
      sandbox_filename: 'test.png',
    });

    const result = JSON.parse(resultStr);
    console.log('导出结果:', result);

    // 列出 disk 上的所有文件
    console.log('\n列出 disk 上的文件...');
    const artifacts = await client.disks.artifacts.list(disk.id);
    console.log('Artifacts:', JSON.stringify(artifacts, null, 2));

    // 尝试用不同路径获取文件
    const testPaths = [
      'artifacts/test.png',
      '/artifacts/test.png',
      'test.png',
      '/test.png',
    ];

    for (const testPath of testPaths) {
      console.log(`\n尝试获取: ${testPath}`);
      try {
        const parts = testPath.replace(/^\/+/, '').split('/');
        const filename = parts.pop() || '';
        const filePath = parts.length > 0 ? '/' + parts.join('/') + '/' : '/';

        const artifact = await client.disks.artifacts.get(disk.id, {
          filePath,
          filename,
          withPublicUrl: true,
          withContent: false,
        });
        console.log(`  成功! public_url:`, artifact.public_url?.slice(0, 80) + '...');
      } catch (err) {
        console.log(`  失败:`, err.message);
      }
    }

  } finally {
    console.log('\n清理 sandbox...');
    await client.sandboxes.kill(sandbox.sandbox_id);
    console.log('完成!');
  }
}

main().catch(console.error);
