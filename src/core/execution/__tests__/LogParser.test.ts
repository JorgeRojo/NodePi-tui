import { describe, expect, it, vi } from 'vitest';

import { LogParser } from '../LogParser.js';

describe('LogParser', () => {
  it('should parse standard newline separated logs', () => {
    const cb = vi.fn();
    const parser = new LogParser(cb);

    parser.parse('line 1\nline 2\n');

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, 'line 1', false);
    expect(cb).toHaveBeenNthCalledWith(2, 'line 2', false);
  });

  it('should handle carriage return overwriting', () => {
    const cb = vi.fn();
    const parser = new LogParser(cb);

    parser.parse('DL 10%\rDL 20%\r');
    parser.flush();

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, 'DL 10%', false);
    expect(cb).toHaveBeenNthCalledWith(2, 'DL 20%', true);
  });

  it('should handle mixed newlines and carriage returns', () => {
    const cb = vi.fn();
    const parser = new LogParser(cb);

    parser.parse('Hello\nWorld\nDL 10%\rDL 20%\rDone\nNext\n');

    expect(cb).toHaveBeenCalledTimes(6);
    expect(cb).toHaveBeenNthCalledWith(1, 'Hello', false);
    expect(cb).toHaveBeenNthCalledWith(2, 'World', false);
    expect(cb).toHaveBeenNthCalledWith(3, 'DL 10%', false);
    expect(cb).toHaveBeenNthCalledWith(4, 'DL 20%', true);
    expect(cb).toHaveBeenNthCalledWith(5, 'Done', true);
    expect(cb).toHaveBeenNthCalledWith(6, 'Next', false);
  });

  it('should wait for trailing \\n if \\r is at the end of a chunk', () => {
    const cb = vi.fn();
    const parser = new LogParser(cb);

    parser.parse('Hello\r');
    expect(cb).toHaveBeenCalledTimes(0); // Because it waits for potential \n

    parser.parse('\n');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, 'Hello', false); // Resolved to CRLF
  });

  it('should flush remaining buffer', () => {
    const cb = vi.fn();
    const parser = new LogParser(cb);

    parser.parse('Hello');
    expect(cb).toHaveBeenCalledTimes(0);

    parser.flush();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, 'Hello', false);
  });

  it('should treat trailing \\r as flushable if stream ends', () => {
    const cb = vi.fn();
    const parser = new LogParser(cb);

    parser.parse('Hello\r');
    expect(cb).toHaveBeenCalledTimes(0);

    parser.flush();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenNthCalledWith(1, 'Hello', false);
  });
});
