import { describe, expect, it } from "vitest";
import { isManualBackfillAllowed } from "@/features/practice/judge-test-cases";

/**
 * app/api/data/route.ts imports "cloudflare:workers" at module scope, which this
 * project's vitest config (unlike the app's own Cloudflare build) has no shim for —
 * the same limitation documented in tests/submissions-route.test.ts's history. The
 * trust-boundary gate itself is extracted into isManualBackfillAllowed specifically
 * so it can be unit-tested here without that dependency; the route's actual HTTP
 * behavior (403 on a forged validated-problem score) is verified live against the
 * deployed instance as part of this phase's regression pass — see the Phase 4 report.
 */
describe("/api/data 的 Manual Review 信任邊界（isManualBackfillAllowed）", () => {
  it("已 validated 的題目（112-2、113-1、114-3）不允許手動回填", () => {
    expect(isManualBackfillAllowed("112-2")).toBe(false);
    expect(isManualBackfillAllowed("113-1")).toBe(false);
    expect(isManualBackfillAllowed("114-3")).toBe(false);
  });

  it("沒有 validated 測資的題目（Manual Review）允許手動回填，行為不變", () => {
    expect(isManualBackfillAllowed("112-1")).toBe(true);
    expect(isManualBackfillAllowed("114-1")).toBe(true);
    expect(isManualBackfillAllowed("999-99")).toBe(true);
  });
});
