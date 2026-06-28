// 阶段 1：测试 OpenAI 生图 API 是否连通
// 用法：OPENAI_API_KEY=sk-xxx node scripts/test-openai.mjs

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('❌ 请设置 OPENAI_API_KEY 环境变量');
  console.error('   Windows PowerShell: $env:OPENAI_API_KEY="sk-xxx"');
  console.error('   Windows CMD:        set OPENAI_API_KEY=sk-xxx');
  process.exit(1);
}

const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

const body = {
  model: 'gpt-image-2',
  prompt: '一只水墨画风格的中国龙，简单构图，适合游戏图标测试',
  size: '512x512',
  quality: 'low',        // 测试用最低品质，省成本
  n: 1,
};

console.log('🚀 测试 OpenAI 生图 API...');
console.log(`   model: ${body.model}`);
console.log(`   size: ${body.size}`);
console.log(`   quality: ${body.quality}`);

try {
  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`❌ API 返回错误 (${res.status}):`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('✅ API 连通成功！');
  console.log(`   生成图片 URL: ${data.data?.[0]?.url}`);
  if (data.data?.[0]?.revised_prompt) {
    console.log(`   GPT 优化后的 prompt: ${data.data[0].revised_prompt}`);
  }
} catch (err) {
  console.error('❌ 网络请求失败:', err.message);
  process.exit(1);
}
