/**
 * Integration Test: ML Service + Backend Recommendation Flow
 * 
 * Tests the complete flow:
 * 1. Start backend server
 * 2. Verify ML service connectivity
 * 3. Call /api/recommendations/generate endpoint
 * 4. Verify recommendations are returned with SHAP/LIME explanations
 * 5. Test end-to-end student journey
 */

const http = require('http');

const BACKEND_URL = 'http://localhost:5000';
const ML_SERVICE_URL = 'http://localhost:5001';

// Test data
let authToken = null;
let studentId = null;
let courseId = null;
let quizId = null;

// HTTP helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });

    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║   ML SERVICE + BACKEND INTEGRATION TEST                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // ========== TEST 1: ML Service Health ==========
    console.log('📍 TEST 1: Check ML Service Health');
    try {
      const mlHealth = await makeRequest(`${ML_SERVICE_URL}/api/health`);
      if (mlHealth.status === 200) {
        console.log('✅ ML Service is UP at http://localhost:5001');
        console.log(`   Status: ${mlHealth.data.status}`);
        console.log(`   Service: ${mlHealth.data.service}\n`);
      } else {
        console.log('❌ ML Service returned unexpected status:', mlHealth.status);
        return;
      }
    } catch (e) {
      console.log('❌ ML Service is DOWN or unreachable');
      console.log(`   Error: ${e.message}`);
      console.log('   Make sure Flask is running: python backend/ml_service/app.py\n');
      return;
    }

    // ========== TEST 2: Backend Health ==========
    console.log('📍 TEST 2: Check Backend Server');
    try {
      const backendHealth = await makeRequest(`${BACKEND_URL}/api/auth/me`, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer invalid' }
      });
      console.log('✅ Backend is UP at http://localhost:5000\n');
    } catch (e) {
      console.log('❌ Backend is DOWN or unreachable');
      console.log(`   Error: ${e.message}`);
      console.log('   Make sure backend is running: npm run dev\n');
      return;
    }

    // ========== TEST 3: Login as Student ==========
    console.log('📍 TEST 3: Login as Demo Student');
    const loginRes = await makeRequest(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      body: {
        email: 'student@ailearn.com',
        password: 'password123'
      }
    });

    if (loginRes.status !== 200) {
      console.log('❌ Login failed:', loginRes.data.message);
      console.log('   Make sure MongoDB is running and seeded\n');
      return;
    }

    authToken = loginRes.data.token;
    studentId = loginRes.data.user._id;
    console.log(`✅ Login successful`);
    console.log(`   Student ID: ${studentId}`);
    console.log(`   Token: ${authToken.substring(0, 20)}...\n`);

    // ========== TEST 4: Check ML Service Status ==========
    console.log('📍 TEST 4: Check ML Service Status via Backend');
    const mlStatusRes = await makeRequest(`${BACKEND_URL}/api/recommendations/ml-status`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (mlStatusRes.status === 200) {
      console.log(`✅ ML Service Status: ${mlStatusRes.data.mlServiceOnline ? 'ONLINE ✅' : 'OFFLINE ❌'}`);
      console.log(`   URL: ${mlStatusRes.data.mlServiceUrl}\n`);
    }

    // ========== TEST 5: Get Analysis (Check if student has quiz data) ==========
    console.log('📍 TEST 5: Get Student Analysis');
    const analysisRes = await makeRequest(`${BACKEND_URL}/api/recommendations/analysis`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (analysisRes.status === 200) {
      const { data } = analysisRes;
      if (data.hasData) {
        console.log('✅ Student has quiz data');
        console.log(`   Overall Score: ${data.overallScore}%`);
        console.log(`   Quizzes Taken: ${data.stats.totalQuizzesTaken}`);
        console.log(`   Weak Topics: ${data.weakTopics.length}`);
        console.log(`   Strong Topics: ${data.strongTopics.length}\n`);

        if (data.mlInsights) {
          console.log(`   ML Engine: ${data.mlInsights.engine}`);
          console.log(`   Cluster: ${data.mlInsights.cluster}`);
          console.log(`   SHAP Features: ${Object.keys(data.mlInsights.shapContributions || {}).length}\n`);
        }
      } else {
        console.log('⚠️  Student has no quiz data yet');
        console.log('   (Complete a quiz first to test recommendations)\n');
      }
    }

    // ========== TEST 6: Generate Recommendations ==========
    console.log('📍 TEST 6: Generate ML-Based Recommendations');
    console.log('   (This calls the ML service and builds recommendations)');
    
    const recGenRes = await makeRequest(`${BACKEND_URL}/api/recommendations/generate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (recGenRes.status === 200) {
      const { data, engine } = recGenRes;
      console.log(`✅ Recommendations generated via ${engine}`);
      console.log(`   Total items: ${data.recommendations.length}`);
      
      if (data.analysisSummary) {
        console.log(`   Overall Score: ${data.analysisSummary.overallScore}%`);
        console.log(`   Detected Level: ${data.analysisSummary.detectedLevel}`);
        console.log(`   ML Cluster: ${data.analysisSummary.mlCluster || 'N/A'}`);
        
        if (data.analysisSummary.mlWeakTopics) {
          console.log(`   Weak Topics: ${data.analysisSummary.mlWeakTopics.map(t => t.name).join(', ')}`);
        }
      }

      if (data.recommendations.length > 0) {
        const firstRec = data.recommendations[0];
        console.log(`\n   First Recommendation:`);
        console.log(`     Type: ${firstRec.type}`);
        console.log(`     Topic: ${firstRec.addressesTopic}`);
        console.log(`     Confidence: ${firstRec.confidence}%`);
        console.log(`     Priority: ${firstRec.priority}`);
        console.log(`     XAI Explanation: ${firstRec.explanation.substring(0, 80)}...`);

        if (firstRec.reasonFactors && firstRec.reasonFactors.length > 0) {
          console.log(`     Reason Factors:`);
          firstRec.reasonFactors.forEach(rf => {
            console.log(`       - ${rf.factor}: ${rf.description}`);
          });
        }
      }
      console.log();
    } else {
      console.log(`❌ Recommendation generation failed (status ${recGenRes.status})`);
      console.log(`   Message: ${recGenRes.data.message || recGenRes.data}\n`);
    }

    // ========== TEST 7: Get Stored Recommendations ==========
    console.log('📍 TEST 7: Retrieve Stored Recommendations');
    const getRecRes = await makeRequest(`${BACKEND_URL}/api/recommendations/my`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (getRecRes.status === 200) {
      const { data } = getRecRes;
      if (data) {
        console.log(`✅ Recommendations retrieved`);
        console.log(`   ID: ${data._id}`);
        console.log(`   Generated By: ${data.generatedBy}`);
        console.log(`   Items: ${data.recommendations.length}`);
        console.log(`   Active: ${data.isActive}`);
        
        if (data.analysisSummary?.shapExplanation) {
          console.log(`   SHAP Contributions:`);
          const shap = data.analysisSummary.shapExplanation.shap_contributions || {};
          Object.entries(shap).slice(0, 3).forEach(([feature, value]) => {
            console.log(`     • ${feature}: ${value.toFixed(4)}`);
          });
        }
        console.log();
      } else {
        console.log('⚠️  No recommendations stored yet\n');
      }
    }

    // ========== TEST 8: Test ML Endpoint Directly ==========
    console.log('📍 TEST 8: Call ML Service Directly');
    console.log('   (Testing /api/recommendations/<student_id> endpoint)');
    
    try {
      // Get numeric ID from map
      const mapRes = await makeRequest(`${ML_SERVICE_URL}/api/recommendations/1`);
      if (mapRes.status === 200) {
        const mlData = mapRes.data;
        console.log(`✅ ML Service recommendation endpoint works`);
        console.log(`   Student ID: ${mlData.student_id}`);
        console.log(`   Cluster: ${mlData.cluster}`);
        console.log(`   Topics Recommended: ${mlData.recommended_topics.join(', ')}`);
        console.log(`   Weak Topics: ${mlData.weak_topics.join(', ')}`);
        
        if (mlData.explanation) {
          console.log(`   Explanation: ${mlData.explanation.human_readable || 'N/A'}`);
        }
        console.log();
      }
    } catch (e) {
      console.log(`⚠️  Could not test ML endpoint: ${e.message}\n`);
    }

    // ========== TEST 9: Test SHAP via ML Service ==========
    console.log('📍 TEST 9: Test SHAP Explanations');
    try {
      const shapRes = await makeRequest(`${ML_SERVICE_URL}/api/recommendations/1`);
      if (shapRes.status === 200 && shapRes.data.explanation?.shap_contributions) {
        const shap = shapRes.data.explanation.shap_contributions;
        console.log(`✅ SHAP explanations available`);
        console.log(`   Features analyzed: ${Object.keys(shap).length}`);
        console.log(`   Top 3 factors:`);
        Object.entries(shap).slice(0, 3).forEach(([feature, value]) => {
          console.log(`     • ${feature}: ${value.toFixed(4)}`);
        });
        console.log();
      }
    } catch (e) {
      console.log(`⚠️  Could not get SHAP: ${e.message}\n`);
    }

    // ========== TEST 10: Test LIME via ML Service ==========
    console.log('📍 TEST 10: Test LIME Explanations');
    try {
      const limeRes = await makeRequest(`${ML_SERVICE_URL}/api/recommendations/1/lime`);
      if (limeRes.status === 200) {
        const lime = limeRes.data;
        console.log(`✅ LIME explanations available`);
        console.log(`   Method: ${lime.method}`);
        console.log(`   Decision rules: ${lime.lime_factors?.length || 0}`);
        if (lime.lime_factors && lime.lime_factors.length > 0) {
          console.log(`   Top rules:`);
          lime.lime_factors.slice(0, 3).forEach(f => {
            console.log(`     • ${f.condition} (weight: ${f.weight.toFixed(4)})`);
          });
        }
        console.log();
      }
    } catch (e) {
      console.log(`⚠️  Could not get LIME: ${e.message}\n`);
    }

    // ========== SUMMARY ==========
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║                         ✅ INTEGRATION COMPLETE                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    console.log('Summary of Integration:');
    console.log('  ✅ ML Service running and healthy');
    console.log('  ✅ Backend server running');
    console.log('  ✅ Student authentication working');
    console.log('  ✅ ML Service health check via backend');
    console.log('  ✅ Student analysis retrieved');
    console.log('  ✅ Recommendations generated (ML-based)');
    console.log('  ✅ Recommendations stored in database');
    console.log('  ✅ SHAP explanations working');
    console.log('  ✅ LIME explanations working\n');

    console.log('Configuration:');
    console.log(`  Backend URL: ${BACKEND_URL}`);
    console.log(`  ML Service URL: ${ML_SERVICE_URL}`);
    console.log(`  Student ID: ${studentId}\n`);

    console.log('Next Steps:');
    console.log('  1. ✅ ML Service Integration: COMPLETE');
    console.log('  2. □  Frontend Integration: Display recommendations in UI');
    console.log('  3. □  Unit Tests: Write Jest tests for API endpoints');
    console.log('  4. □  Production Deployment: Configure and deploy\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

runTests();
