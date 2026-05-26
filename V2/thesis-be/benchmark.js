const autocannon = require('autocannon');
const fs = require('fs');

// const BASE_URL = 'http://localhost:3000/api';
const BASE_URL = 'https://thesis-management-system-production.up.railway.app/api';
// Giữ nguyên Token và ID bạn đã lấy
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkZTBmZWQ5Yi1hZjZhLTQxZTAtOGUzYi01MDM0MTY4MjE5ZWMiLCJlbWFpbCI6ImFkbWluQGl1aC5lZHUudm4iLCJyb2xlIjoiQURNSU4iLCJkZXBhcnRtZW50SWQiOiJjNTVkMjUwMS0zMTEzLTQ0YjYtYTdlOC04NjJhOTgzMWE1NzgiLCJpYXQiOjE3Nzk3OTMyNjEsImV4cCI6MTc3OTgwMDQ2MX0._altVMv3M63ctFaETSHgoM1x40_1EnxOKasITG3YUqA';
const SAMPLE_TOPIC_ID = '5fbd2694-dec6-46f3-a3c6-40c2222e16e7';

const tests = [
  {
    name: '01_BASELINE_HEALTH_CHECK',
    // url: `http://localhost:3000/health`,
    url: `https://thesis-management-system-production.up.railway.app/health`,
    method: 'GET'
  },
  {
    name: '02_WRITE_INTENSIVE_TOPIC_REGISTRATION',
    url: `${BASE_URL}/registrations/topic/${SAMPLE_TOPIC_ID}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  },
  {
    name: '03_HEAVY_READ_GRADING_SUMMARY',
    url: `${BASE_URL}/grading/grade-summary`,
    method: 'GET'
  },
  {
    name: '04_BUSINESS_LOGIC_AUTO_COMPUTE',
    url: `${BASE_URL}/grading/${SAMPLE_TOPIC_ID}/compute`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }
];

// Mức tải mới "mượt" hơn cho luận văn
const loads = [10, 50, 100, 150, 200];

let results = [];
results.push(['Scenario', 'Connections', 'Requests/Sec', 'Avg Latency (ms)', 'P95 Latency (ms)', 'Errors'].join(','));

async function runTest(test, load) {
  return new Promise((resolve) => {
    autocannon({
      url: test.url,
      method: test.method,
      connections: load,
      duration: 10,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        ...test.headers
      }
    }, (err, result) => {
      if (err) {
        resolve({ rps: 0, avg: 0, p95: 0, errors: 1 });
      } else {
        resolve({
          rps: result.requests.average,
          avg: result.latency.average,
          // Lấy P95 hoặc các mức lân cận nếu phiên bản cũ không có p95
          p95: result.latency.p95 || result.latency.p97_5 || result.latency.p99 || 0,
          errors: result.errors
        });
      }
    });
  });
}

(async () => {
  console.log('🚀 BẮT ĐẦU KIỂM THỬ HIỆU NĂNG TMS-V2');

  for (const test of tests) {
    console.log(`\n▶️ Kịch bản: ${test.name}`);
    for (const load of loads) {
      process.stdout.write(`   Mức tải ${load} users: `);
      const res = await runTest(test, load);
      results.push([test.name, load, res.rps, res.avg, res.p95, res.errors].join(','));
      console.log(`RPS: ${Math.round(res.rps)} | Latency: ${Math.round(res.avg)}ms | P95: ${Math.round(res.p95)}ms`);
    }
  }

  let counter = 1;
  while (fs.existsSync(`benchmark_results_${counter}.csv`)) {
    counter++;
  }
  const filename = `benchmark_results_${counter}.csv`;
  fs.writeFileSync(filename, results.join('\n'));
  console.log(`\n✅ HOÀN TẤT! Dữ liệu đã lưu vào ${filename}`);
})();
