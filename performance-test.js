// Performance test for language detection
import { detectLanguage } from './src/lib/article-translation.service';

// Generate test texts of various sizes
function generateTestText(size, isChinese = false) {
  if (isChinese) {
    // Chinese characters
    const chineseChars = '这是一个用于测试的中文句子。它包含一些技术术语和数字如123和英文词如test。';
    return chineseChars.repeat(Math.ceil(size / chineseChars.length)).substring(0, size);
  } else {
    // English text
    const englishText = 'This is a test sentence for performance testing. It contains some technical terms and numbers like 123 and Chinese words like 测试。';
    return englishText.repeat(Math.ceil(size / englishText.length)).substring(0, size);
  }
}

const testSizes = [100, 500, 1000, 5000, 10000]; // characters
const iterations = 5; // Run each test multiple times

console.log('Language Detection Performance Test\n');
console.log('Size (chars)\tAvg Time (ms)\tMin Time (ms)\tMax Time (ms)');

for (const size of testSizes) {
  const times = [];
  
  // Test English text
  for (let i = 0; i < iterations; i++) {
    const text = generateTestText(size, false);
    const start = performance.now();
    detectLanguage(text);
    const end = performance.now();
    times.push(end - start);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`${size}\t\t${avgTime.toFixed(2)}\t\t${minTime.toFixed(2)}\t\t${maxTime.toFixed(2)}`);
}

console.log('\nNote: These times represent client-side processing only.');
console.log('Network API call time for translation is external and unavoidable.');