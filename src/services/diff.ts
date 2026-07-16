// Simple line-based diff (LCS) for previewing edits.
// Lightweight and dependency-free — good enough for inline edit / composer previews.

export interface DiffLine {
  type: "same" | "add" | "del";
  text: string;
}

function splitLines(s: string): string[] {
  if (s === "") return [];
  return s.split(/\r?\n/);
}

// Compute LCS table
function lcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

export function computeDiff(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const dp = lcs(a, b);
  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "del", text: a[i] });
      i++;
    } else {
      result.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < a.length) {
    result.push({ type: "del", text: a[i++] });
  }
  while (j < b.length) {
    result.push({ type: "add", text: b[j++] });
  }
  return result;
}
