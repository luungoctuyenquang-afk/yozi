import { describe, it, expect, beforeEach } from 'vitest';
import { WorldBookEngine } from '../engine.js';
import { WorldBookImporter } from '../importer.js';
import { WorldBook, Entry } from '../types.js';

describe('WorldBook Engine', () => {
  let engine: WorldBookEngine;
  let sampleBook: WorldBook;

  beforeEach(() => {
    engine = new WorldBookEngine();
    sampleBook = {
      name: 'Test Book',
      entries: [
        {
          id: 'test1',
          name: 'Test Entry 1',
          keys: ['test', 'example'],
          content: 'This is a test entry',
          enabled: true,
          priority: 50,
          order: 1
        },
        {
          id: 'test2',
          name: 'Test Entry 2',
          keys: ['sample', 'demo'],
          content: 'This is a sample entry',
          enabled: true,
          priority: 30,
          order: 2
        },
        {
          id: 'constant1',
          name: 'Constant Entry',
          keys: [],
          content: 'Always active entry',
          enabled: true,
          constant: true,
          priority: 100
        }
      ]
    };
  });

  it('should activate constant entries', () => {
    const result = engine.process(sampleBook, 'random text');
    
    const constantEntry = result.activatedEntries.find(e => e.id === 'constant1');
    expect(constantEntry).toBeDefined();
    expect(constantEntry?.constant).toBe(true);
  });

  it('should activate entries based on keyword matches', () => {
    const result = engine.process(sampleBook, 'This is a test message');
    
    const testEntry = result.activatedEntries.find(e => e.id === 'test1');
    expect(testEntry).toBeDefined();
    expect(testEntry?.matchedKeys).toContain('test');
  });

  it('should respect priority ordering', () => {
    const result = engine.process(sampleBook, 'test sample');
    
    const sorted = result.activatedEntries.sort((a, b) => (b.activationScore || 0) - (a.activationScore || 0));
    expect(sorted[0].priority).toBeGreaterThanOrEqual(sorted[1]?.priority || 0);
  });

  it('should handle group scoring', () => {
    const bookWithGroups: WorldBook = {
      name: 'Group Test',
      entries: [
        {
          id: 'group1a',
          keys: ['alpha'],
          content: 'Group 1 Entry A',
          group: 'test-group',
          priority: 10
        },
        {
          id: 'group1b', 
          keys: ['alpha'],
          content: 'Group 1 Entry B',
          group: 'test-group',
          priority: 20
        }
      ]
    };

    const result = engine.process(bookWithGroups, 'alpha test');
    
    // Should only include highest priority from group
    const groupEntries = result.activatedEntries.filter(e => e.group === 'test-group');
    expect(groupEntries.length).toBeLessThanOrEqual(1);
    if (groupEntries.length > 0) {
      expect(groupEntries[0].id).toBe('group1b'); // Higher priority
    }
  });

  it('should handle probability filtering', () => {
    const probabilityBook: WorldBook = {
      name: 'Probability Test',
      entries: [
        {
          id: 'prob1',
          keys: ['maybe'],
          content: 'Maybe activated',
          probability: 0.0 // Never activate
        },
        {
          id: 'prob2',
          keys: ['always'],
          content: 'Always activated',
          probability: 1.0 // Always activate
        }
      ]
    };

    // Run multiple times to test probability
    let alwaysCount = 0;
    let maybeCount = 0;
    
    for (let i = 0; i < 10; i++) {
      const result = engine.process(probabilityBook, 'maybe always test');
      if (result.activatedEntries.some(e => e.id === 'prob2')) alwaysCount++;
      if (result.activatedEntries.some(e => e.id === 'prob1')) maybeCount++;
    }

    expect(alwaysCount).toBe(10); // Should always activate
    expect(maybeCount).toBe(0);   // Should never activate
  });

  it('should handle sticky behavior overriding probability', () => {
    const stickyBook: WorldBook = {
      name: 'Sticky Test',
      entries: [
        {
          id: 'sticky1',
          keys: ['sticky'],
          content: 'Sticky entry',
          probability: 0.1, // Low probability
          sticky: 5 // Sticky for 5 seconds
        }
      ]
    };

    // First activation
    const result1 = engine.process(stickyBook, 'sticky test');
    const activated1 = result1.activatedEntries.some(e => e.id === 'sticky1');

    if (activated1) {
      // Should remain active due to sticky behavior
      const result2 = engine.process(stickyBook, 'sticky test again');
      const activated2 = result2.activatedEntries.some(e => e.id === 'sticky1');
      expect(activated2).toBe(true);
    }
  });

  it('should handle recursion blocking', () => {
    const recursiveBook: WorldBook = {
      name: 'Recursive Test',
      entries: [
        {
          id: 'recursive1',
          keys: ['start'],
          content: 'This contains recursive keywords',
          recursive: true,
          nonRecursable: true // Should block further recursion
        },
        {
          id: 'recursive2',
          keys: ['recursive'],
          content: 'Should not be activated recursively'
        }
      ]
    };

    engine.setOptions({ recursive: true, maxRecursionSteps: 5 });
    const result = engine.process(recursiveBook, 'start test');
    
    // Should activate first entry but not recurse into second
    expect(result.activatedEntries.some(e => e.id === 'recursive1')).toBe(true);
    
    // Check recursion was properly handled
    const recursiveEntry = result.activatedEntries.find(e => e.id === 'recursive2');
    expect(recursiveEntry?.depth).toBeUndefined(); // Should not be recursively activated
  });

  it('should respect token budget limits', () => {
    const budgetBook: WorldBook = {
      name: 'Budget Test',
      entries: Array.from({ length: 10 }, (_, i) => ({
        id: `budget${i}`,
        keys: ['budget'],
        content: 'A'.repeat(100), // 100 chars each
        priority: 100 - i // Descending priority
      }))
    };

    engine.setOptions({ tokenBudget: 200 }); // Very limited budget
    const result = engine.process(budgetBook, 'budget test');
    
    const totalTokens = result.totalTokens || 0;
    expect(totalTokens).toBeLessThanOrEqual(200);
    expect(result.activatedEntries.length).toBeLessThan(10); // Should be truncated
  });

  it('should handle position organization', () => {
    const positionBook: WorldBook = {
      name: 'Position Test',
      entries: [
        {
          id: 'before1',
          keys: ['test'],
          content: 'Before char',
          position: 'before_char'
        },
        {
          id: 'after1',
          keys: ['test'],
          content: 'After char',
          position: 'after_char'
        },
        {
          id: 'example1',
          keys: ['test'],
          content: 'Before example',
          position: 'before_example'
        }
      ]
    };

    const result = engine.process(positionBook, 'test message');
    
    expect(result.slots).toBeDefined();
    expect(result.slots.length).toBeGreaterThan(0);
    
    const positions = result.slots.map(slot => slot.position);
    expect(positions).toContain('before_char');
    expect(positions).toContain('after_char');
    expect(positions).toContain('before_example');
  });

  it('should handle mutual exclusion through groups', () => {
    const exclusiveBook: WorldBook = {
      name: 'Exclusive Test',
      entries: [
        {
          id: 'exclusive1',
          keys: ['mutual'],
          content: 'Option A',
          group: 'exclusive',
          priority: 10
        },
        {
          id: 'exclusive2',
          keys: ['mutual'],
          content: 'Option B',
          group: 'exclusive',
          priority: 20
        },
        {
          id: 'independent',
          keys: ['mutual'],
          content: 'Independent option'
          // No group - should activate independently
        }
      ]
    };

    const result = engine.process(exclusiveBook, 'mutual test');
    
    // Should only activate one from the group
    const groupEntries = result.activatedEntries.filter(e => e.group === 'exclusive');
    expect(groupEntries.length).toBeLessThanOrEqual(1);
    
    // Independent entry should still activate
    const independent = result.activatedEntries.find(e => e.id === 'independent');
    expect(independent).toBeDefined();
  });

  it('should handle Chinese text matching', () => {
    const chineseBook: WorldBook = {
      name: 'Chinese Test',
      entries: [
        {
          id: 'chinese1',
          keys: ['测试', 'test'],
          content: '这是中文测试条目'
        },
        {
          id: 'english1',
          keys: ['travel', '旅行'],
          content: 'English and Chinese keywords'
        }
      ]
    };

    const result1 = engine.process(chineseBook, '我想进行测试');
    expect(result1.activatedEntries.some(e => e.id === 'chinese1')).toBe(true);

    const result2 = engine.process(chineseBook, '我要去旅行');
    expect(result2.activatedEntries.some(e => e.id === 'english1')).toBe(true);
  });
});

describe('WorldBook Importer', () => {
  it('should import and normalize basic worldbook data', () => {
    const raw = {
      name: 'Test Import',
      entries: [
        {
          id: 'import1',
          key: 'test,sample', // String format
          content: 'Test content',
          position: 0 // Numeric position
        }
      ]
    };

    const imported = WorldBookImporter.import(raw);
    
    expect(imported.name).toBe('Test Import');
    expect(imported.entries[0].keys).toEqual(['test', 'sample']);
    expect(imported.entries[0].position).toBe('before_char');
  });

  it('should expand English keywords to Chinese', () => {
    const raw = {
      entries: [
        {
          id: 'expand1',
          keys: ['weather', 'travel'],
          content: 'Weather and travel info'
        }
      ]
    };

    const imported = WorldBookImporter.import(raw);
    const keys = imported.entries[0].keys;
    
    expect(keys).toContain('weather');
    expect(keys).toContain('travel');
    expect(keys).toContain('天气');
    expect(keys).toContain('旅行');
  });

  it('should validate worldbook structure', () => {
    const validBook: WorldBook = {
      entries: [
        {
          id: 'valid1',
          keys: ['test'],
          content: 'Valid entry'
        }
      ]
    };

    const invalidBook = {
      entries: [
        {
          // Missing required fields
          content: 'Invalid entry'
        }
      ]
    };

    const validResult = WorldBookImporter.validate(validBook);
    expect(validResult.valid).toBe(true);

    const invalidResult = WorldBookImporter.validate(invalidBook as any);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});