#!/usr/bin/env node
/**
 * 真实天气搜索测试
 * 验证 web_search 和 web_fetch 能否获取到真实的天气数据
 */

import { createWebTools } from './src/tools/web/web-tools.js';

console.log('=== 开始真实天气搜索测试 ===\n');

async function testWeatherSearch() {
  const webTools = createWebTools();
  const webSearch = webTools.find(t => t.name === 'web_search');
  const webFetch = webTools.find(t => t.name === 'web_fetch');

  if (!webSearch || !webFetch) {
    console.error('❌ 找不到 web_search 或 web_fetch 工具');
    return false;
  }

  // 测试1: 搜索上海天气
  console.log('📌 测试1: 搜索 "Shanghai current weather"');
  const searchResult = await webSearch.handler(
    { query: 'Shanghai current weather', max_results: 5 },
    { debug: true, ui: { debugEvent: (label, details) => console.log(`  [${label}]`, details) } }
  );

  console.log('\n🔍 搜索结果:');
  console.log(searchResult.substring(0, 1000)); // 只显示前1000个字符

  let parsedResults;
  try {
    parsedResults = JSON.parse(searchResult);
    console.log('\n✅ 搜索成功，获取到', parsedResults.results?.length || 0, '个结果');
  } catch (e) {
    console.error('\n❌ 搜索结果不是有效的 JSON');
    return false;
  }

  // 测试2: 尝试获取第一个结果的详情
  if (parsedResults.results && parsedResults.results.length > 0) {
    const firstResult = parsedResults.results[0];
    console.log('\n📌 测试2: 获取第一个结果的详情');
    console.log('  标题:', firstResult.title);
    console.log('  URL:', firstResult.url);
    console.log('  摘要:', firstResult.snippet?.substring(0, 200));

    try {
      const fetchResult = await webFetch.handler(
        { url: firstResult.url, max_chars: 5000 },
        { debug: true, ui: { debugEvent: () => {} } }
      );

      console.log('\n📄 获取到的页面内容 (前500字符):');
      try {
        const parsedFetch = JSON.parse(fetchResult);
        console.log(parsedFetch.text?.substring(0, 500) || fetchResult.substring(0, 500));
      } catch {
        console.log(fetchResult.substring(0, 500));
      }

      console.log('\n✅ 页面获取成功');

      // 检查是否包含天气相关关键词
      const weatherKeywords = ['temperature', 'weather', 'humidity', '°C', '°F', 'rain', 'sunny', 'cloudy'];
      const fetchText = fetchResult.toLowerCase();
      const foundKeywords = weatherKeywords.filter(k => fetchText.includes(k));

      if (foundKeywords.length > 0) {
        console.log('\n🌤️  检测到天气相关关键词:', foundKeywords);
        console.log('\n🎉 天气搜索功能测试通过！');
        return true;
      } else {
        console.log('\n⚠️  没有检测到天气相关关键词');
      }
    } catch (e) {
      console.error('\n❌ 获取详情失败:', e.message);
      return false;
    }
  }

  return false;
}

testWeatherSearch().then((success) => {
  console.log('\n=== 测试结束 ===');
  process.exit(success ? 0 : 1);
}).catch((e) => {
  console.error('\n❌ 测试过程出错:', e);
  process.exit(1);
});
