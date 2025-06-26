export function parseArgs(): { url?: string; companyName?: string; createBot: boolean } {
  const args = process.argv.slice(2);
  return {
    url: args[0],
    companyName: args[0],
    createBot: args.includes('--create-bot')
  };
}

export function printHeader(title: string): void {
  console.log(`🚀 ${title}`);
  console.log('='.repeat(title.length + 4) + '\n');
}

export function printUsage(command: string, description: string, examples: string[]): void {
  console.log(`❌ ${description}`);
  console.log(`\nUsage: ${command}`);
  console.log('Examples:');
  examples.forEach(example => console.log(`  ${example}`));
}

export function handleError(error: Error): void {
  console.log('\n💥 ERROR OCCURRED!');
  console.log('==================');
  console.error('❌ Error details:', error.message);
  console.error('📊 Full error:', error);
  process.exit(1);
}