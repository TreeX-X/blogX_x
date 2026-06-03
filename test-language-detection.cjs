const { detectLanguage } = require('./src/lib/article-translation.service.ts');

// Test cases
const testCases = [
  {
    text: "Hello, this is an English article about technology.",
    expected: 'en',
    description: 'Simple English text'
  },
  {
    text: "这是一篇关于技术的中文文章。",
    expected: 'zh',
    description: 'Simple Chinese text'
  },
  {
    text: "Hello 世界, this is a mixed English and Chinese sentence.",
    expected: 'unknown', // Should be unknown as neither dominates
    description: 'Mixed text with equal characters'
  },
  {
    text: "This is an English sentence with some Chinese words like 你好 and 谢谢。",
    expected: 'en', // English should dominate
    description: 'English with some Chinese words'
  },
  {
    text: "这是一个中文句子，包含一些英文单词 like hello 和 thanks。",
    expected: 'zh', // Chinese should dominate
    description: 'Chinese with some English words'
  },
  {
    text: "",
    expected: 'unknown',
    description: 'Empty text'
  },
  {
    text: "   ",
    expected: 'unknown',
    description: 'Only whitespace'
  },
  {
    text: "<p>这是一个HTML段落，包含一些标签。</p>",
    expected: 'zh',
    description: 'HTML with Chinese content'
  },
  {
    text: "<p>This is an HTML paragraph with some tags.</p>",
    expected: 'en',
    description: 'HTML with English content'
  }
];

console.log('Testing language detection function:\n');

let passed = 0;
let total = testCases.length;

testCases.forEach((testCase, index) => {
  const result = detectLanguage(testCase.text);
  const passedTest = result === testCase.expected;
  
  if (passedTest) {
    passed++;
    console.log(`✓ Test ${index + 1}: ${testCase.description}`);
    console.log(`  Text: "${testCase.text}"`);
    console.log(`  Expected: ${testCase.expected}, Got: ${result}\n`);
  } else {
    console.log(`✗ Test ${index + 1}: ${testCase.description}`);
    console.log(`  Text: "${testCase.text}"`);
    console.log(`  Expected: ${testCase.expected}, Got: ${result}\n`);
  }
});

console.log(`Results: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('All tests passed! Language detection is working correctly.');
  process.exit(0);
} else {
  console.log('Some tests failed. Please review the language detection implementation.');
  process.exit(1);
}