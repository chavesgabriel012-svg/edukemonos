import { describe, expect, it } from "vitest";
import { NEW_SESSION_GAP_MS, recordActivity, REST_AFTER_MS, shouldRemind } from "../src/lib/activity";

const min = 60_000;

describe("rest reminder", () => {
  it("shows after one hour of continuous activity, once", () => {
    let s = recordActivity(null, 0);
    for (let t = 4 * min; t <= 60 * min; t += 4 * min) s = recordActivity(s, t);
    expect(s.last - s.start).toBe(REST_AFTER_MS);
    expect(shouldRemind(s)).toBe(true);
    expect(shouldRemind({ ...s, reminded: true })).toBe(false);
  });

  it("does not show before the hour", () => {
    let s = recordActivity(null, 0);
    s = recordActivity(s, 59 * min);
    expect(shouldRemind(recordActivity(recordActivity(null, 0), 4 * min))).toBe(false);
    expect(s.start).toBe(59 * min); // a 59-minute gap is a new session
  });

  it("a pause longer than 5 minutes starts a new session", () => {
    let s = recordActivity(null, 0);
    for (let t = 3 * min; t <= 50 * min; t += 3 * min) s = recordActivity(s, t);
    s = recordActivity(s, s.last + NEW_SESSION_GAP_MS + 1);
    expect(s.start).toBe(s.last);
    expect(s.reminded).toBe(false);
  });
});
