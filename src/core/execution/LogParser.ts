export type LogUpdateCallback = (line: string, overwrite: boolean) => void;

export class LogParser {
  private _callback: LogUpdateCallback;
  private _buffer: string = '';
  private _lastWasCR: boolean = false;

  constructor(callback: LogUpdateCallback) {
    this._callback = callback;
  }

  public parse(chunk: string | Buffer): void {
    this._buffer += chunk.toString();

    let i = 0;
    while (i < this._buffer.length) {
      const lf = this._buffer.indexOf('\n', i);
      const cr = this._buffer.indexOf('\r', i);

      let foundIndex = -1;
      let isCR = false;
      let isCRLF = false;

      if (lf !== -1 && cr !== -1) {
        if (lf < cr) {
          foundIndex = lf;
        } else if (cr === lf - 1) {
          foundIndex = cr;
          isCRLF = true;
        } else {
          foundIndex = cr;
          isCR = true;
        }
      } else if (lf !== -1) {
        foundIndex = lf;
      } else if (cr !== -1) {
        foundIndex = cr;
        isCR = true;
      }

      if (foundIndex !== -1) {
        if (isCR && foundIndex === this._buffer.length - 1) {
          // Wait to see if the next chunk starts with \n
          break;
        }

        const line = this._buffer.slice(i, foundIndex);
        this._callback(line, this._lastWasCR);

        if (isCRLF) {
          i = foundIndex + 2;
          this._lastWasCR = false;
        } else {
          i = foundIndex + 1;
          this._lastWasCR = isCR;
        }
      } else {
        break;
      }
    }

    this._buffer = this._buffer.slice(i);
  }

  public flush(): void {
    if (this._buffer.length > 0) {
      if (this._buffer === '\r') {
        this._callback('', this._lastWasCR);
      } else {
        const cr = this._buffer.endsWith('\r');
        const line = cr ? this._buffer.slice(0, -1) : this._buffer;
        this._callback(line, this._lastWasCR);
      }
      this._buffer = '';
      this._lastWasCR = false;
    }
  }
}
