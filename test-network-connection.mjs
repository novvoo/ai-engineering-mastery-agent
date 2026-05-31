#!/usr/bin/env node
/**
 * 网络连接诊断测试
 */

console.log('=== 网络连接诊断 ===\n');

// 测试1: 测试基础 fetch
console.log('📌 测试1: 基础 fetch 功能');
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  console.log('  正在请求 https://example.com ...');
  const response = await fetch('https://example.com', {
    signal: controller.signal,
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  clearTimeout(timeout);
  
  console.log('  ✅ HTTP 状态:', response.status);
  console.log('  ✅ 内容长度:', response.headers.get('content-length') || '未知');
} catch (e) {
  console.error('  ❌ 失败:', e.message);
  console.error('  堆栈:', e.stack);
}

console.log('\n📌 测试2: 检查代理环境变量');
console.log('  HTTP_PROXY:', process.env.HTTP_PROXY || '未设置');
console.log('  HTTPS_PROXY:', process.env.HTTPS_PROXY || '未设置');
console.log('  http_proxy:', process.env.http_proxy || '未设置');
console.log('  https_proxy:', process.env.https_proxy || '未设置');
console.log('  NO_PROXY:', process.env.NO_PROXY || '未设置');

console.log('\n📌 测试3: 检查 DNS 解析');
try {
  const { Resolver } = await import('dns').catch(() => null);
  if (Resolver) {
    const resolver = new Resolver();
    const addresses = await new Promise((resolve, reject) => {
      resolver.resolve4('duckduckgo.com', (err, addrs) => {
        if (err) reject(err);
        else resolve(addrs);
      });
    });
    console.log('  ✅ duckduckgo.com 解析到:', addresses);
  } else {
    console.log('  ⚠️  dns 模块不可用');
  }
} catch (e) {
  console.error('  ❌ DNS 解析失败:', e.message);
}

console.log('\n=== 诊断结束 ===');
