// 测试 xiaohongshu API
async function testXiaohongshu() {
  const response = await fetch('http://localhost:3000/api/xiaohongshu/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentContent: '今天学习了一些关于教学方法的知识，包括支架式教学、抛锚式教学和随机通达教学。这些方法都有助于提高学习效果。',
      topic: '教学方法分享',
      language: 'zh',
    }),
  });

  console.log('Status:', response.status);
  const result = await response.json();
  console.log('Result:', JSON.stringify(result, null, 2));
}

testXiaohongshu().catch(console.error);
