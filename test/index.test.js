/**
 * @moltbook/voting Test Suite
 */

const { VotingSystem, VotingError, createMemoryAdapter, VOTE } = require('../src');

// Test framework
let passed = 0;
let failed = 0;
const tests = [];

function describe(name, fn) {
  tests.push({ type: 'describe', name });
  fn();
}

function test(name, fn) {
  tests.push({ type: 'test', name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

async function runTests() {
  console.log('\n@moltbook/voting Test Suite\n');
  console.log('='.repeat(50));

  for (const item of tests) {
    if (item.type === 'describe') {
      console.log(`\n[${item.name}]\n`);
    } else {
      try {
        await item.fn();
        console.log(`  + ${item.name}`);
        passed++;
      } catch (error) {
        console.log(`  - ${item.name}`);
        console.log(`    Error: ${error.message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

// Tests

describe('VotingSystem Creation', () => {
  test('creates with valid adapter', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);
    assert(voting instanceof VotingSystem);
  });

  test('throws on invalid adapter', async () => {
    let threw = false;
    try {
      new VotingSystem({});
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Should throw on invalid adapter');
  });

  test('accepts custom options', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter, {
      allowSelfVote: true,
      karmaMultiplier: { post: 2 }
    });
    assert(voting.options.allowSelfVote === true);
  });
});

describe('Upvoting', () => {
  test('upvote creates new vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const result = await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'upvoted');
    assertEqual(result.currentVote, 1);
    assertEqual(result.karmaChange, 1);
  });

  test('upvote same post twice removes vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const result = await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'removed');
    assertEqual(result.currentVote, null);
    assertEqual(result.karmaChange, -1);
  });

  test('upvote updates author karma', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const karma = await adapter.getKarma('author1');
    assertEqual(karma, 1);
  });
});

describe('Downvoting', () => {
  test('downvote creates negative vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const result = await voting.downvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'downvoted');
    assertEqual(result.currentVote, -1);
    assertEqual(result.karmaChange, -1);
  });

  test('downvote reduces karma', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.downvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const karma = await adapter.getKarma('author1');
    assertEqual(karma, -1);
  });
});

describe('Vote Transitions', () => {
  test('upvote to downvote changes vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const result = await voting.downvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'changed');
    assertEqual(result.previousVote, 1);
    assertEqual(result.currentVote, -1);
    assertEqual(result.karmaChange, -2);
  });

  test('downvote to upvote changes vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.downvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const result = await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'changed');
    assertEqual(result.karmaChange, 2);
  });
});

describe('Self Vote Prevention', () => {
  test('prevents self voting by default', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    let threw = false;
    let errorCode = null;

    try {
      await voting.upvote({
        agentId: 'agent1',
        targetId: 'post1',
        targetType: 'post',
        authorId: 'agent1'
      });
    } catch (e) {
      threw = true;
      errorCode = e.code;
    }

    assert(threw, 'Should throw on self vote');
    assertEqual(errorCode, 'SELF_VOTE');
  });

  test('allows self vote when enabled', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter, { allowSelfVote: true });

    const result = await voting.upvote({
      agentId: 'agent1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'agent1'
    });

    assertEqual(result.action, 'upvoted');
  });
});

describe('Target Type Validation', () => {
  test('accepts post target type', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const result = await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assert(result.success);
  });

  test('accepts comment target type', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const result = await voting.upvote({
      agentId: 'voter1',
      targetId: 'comment1',
      targetType: 'comment',
      authorId: 'author1'
    });

    assert(result.success);
  });

  test('rejects invalid target type', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    let threw = false;
    let errorCode = null;

    try {
      await voting.upvote({
        agentId: 'voter1',
        targetId: 'something1',
        targetType: 'invalid',
        authorId: 'author1'
      });
    } catch (e) {
      threw = true;
      errorCode = e.code;
    }

    assert(threw);
    assertEqual(errorCode, 'INVALID_TARGET');
  });
});

describe('Remove Vote', () => {
  test('removes existing vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const result = await voting.removeVote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'removed');
    assertEqual(result.previousVote, 1);
  });

  test('handles removing non-existent vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const result = await voting.removeVote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    assertEqual(result.action, 'none');
    assertEqual(result.karmaChange, 0);
  });
});

describe('Get Vote', () => {
  test('returns vote when exists', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const vote = await voting.getVote('voter1', 'post1', 'post');
    assertEqual(vote.value, 1);
  });

  test('returns null when no vote', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const vote = await voting.getVote('voter1', 'post1', 'post');
    assertEqual(vote, null);
  });
});

describe('Has Voted', () => {
  test('returns true when voted', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({
      agentId: 'voter1',
      targetId: 'post1',
      targetType: 'post',
      authorId: 'author1'
    });

    const hasVoted = await voting.hasVoted('voter1', 'post1', 'post');
    assertEqual(hasVoted, true);
  });

  test('returns false when not voted', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    const hasVoted = await voting.hasVoted('voter1', 'post1', 'post');
    assertEqual(hasVoted, false);
  });
});

describe('Vote Count', () => {
  test('counts votes correctly', async () => {
    const adapter = createMemoryAdapter();
    const voting = new VotingSystem(adapter);

    await voting.upvote({ agentId: 'v1', targetId: 'p1', targetType: 'post', authorId: 'a1' });
    await voting.upvote({ agentId: 'v2', targetId: 'p1', targetType: 'post', authorId: 'a1' });
    await voting.downvote({ agentId: 'v3', targetId: 'p1', targetType: 'post', authorId: 'a1' });

    const counts = await voting.getVoteCount('p1', 'post');
    assertEqual(counts.upvotes, 2);
    assertEqual(counts.downvotes, 1);
    assertEqual(counts.score, 1);
  });
});

describe('Constants', () => {
  test('VOTE constants are correct', async () => {
    assertEqual(VOTE.UP, 1);
    assertEqual(VOTE.DOWN, -1);
    assertEqual(VOTE.NONE, 0);
  });
});

describe('VotingError', () => {
  test('creates error with code', async () => {
    const error = new VotingError('Test message', 'TEST_CODE');
    assertEqual(error.message, 'Test message');
    assertEqual(error.code, 'TEST_CODE');
    assert(error instanceof Error);
  });
});

// Run
runTests();
