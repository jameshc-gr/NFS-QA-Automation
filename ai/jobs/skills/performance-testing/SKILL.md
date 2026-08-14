---
name: performance-testing
description: 'Performance benchmarking, Web Vitals monitoring (LCP, CLS, FID/INP), network response SLAs, and k6 load testing strategies.'
argument-hint: 'Audit performance metrics or load SLAs'
model: gpt-4o-mini
# Economical Model: gpt-4o-mini / claude-3.5-haiku / gemini-2.0-flash (Tier 3 - Fast Metric Evaluation & SLA Check)
---

# Performance Testing Skill

Use this skill to measure web performance metrics, enforce Core Web Vitals thresholds, and execute API performance/load testing scripts.

## When to Use
- Benchmarking page load performance and Core Web Vitals (Largest Contentful Paint, Cumulative Layout Shift, Total Blocking Time)
- Verifying API response time SLAs under load
- Profiling client-side network request waterfall and resource load sizes
- Designing k6 performance/load testing scenarios

## Inputs
- Target page URL or API endpoint
- Performance thresholds / SLAs (e.g. LCP < 2.5s, CLS < 0.1, API Response < 500ms)
- Execution scope (Client-side Web Vitals audit vs. Backend k6 load test)

## Procedure
1. **Client-Side Web Vitals Audit (Playwright)**:
   - Capture Performance Navigation Timing API metrics in Playwright:
     ```ts
     const performanceTiming = JSON.parse(
       await page.evaluate(() => JSON.stringify(window.performance.timing))
     );
     const pageLoadTime = performanceTiming.loadEventEnd - performanceTiming.navigationStart;
     expect(pageLoadTime).toBeLessThan(3000);
     ```
2. **Network Response SLA Verification**:
   - Measure API response duration during E2E flow or API runner execution.
   - Assert response time stays within threshold SLA (e.g., < 500ms).
3. **k6 Load Testing (API/Backend)**:
   - Configure k6 test options with virtual users (VUs), duration, and thresholds:
     ```js
     export const options = {
       stages: [
         { duration: '30s', target: 20 },
         { duration: '1m', target: 20 },
         { duration: '10s', target: 0 },
       ],
       thresholds: {
         http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
       },
     };
     ```
4. **Report Performance Metrics**:
   - Generate summary table with latency metrics, request rate, and threshold pass/fail state.

## Output Contract
- Performance metrics table (LCP, CLS, TTFB, API Response p95/p99)
- SLA Compliance status (Passed / Threshold Exceeded)
- Recommendations for performance optimization (unoptimized images, slow endpoints, excessive bundle size)

## Guardrails
- Ensure client-side performance tests run in headless browser with consistent CPU/network throttling to prevent noisy metrics.
- Never run high-VU load tests against Production environments without pre-authorization.
