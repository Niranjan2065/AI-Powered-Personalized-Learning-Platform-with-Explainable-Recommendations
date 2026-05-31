// utils/testEmail.js
// ─────────────────────────────────────────────────────────────────────────────
// Script to test and verify all Nodemailer templates (Enrollment, Quiz Result, ML Recommendation)
// Run from the backend directory:
//   node utils/testEmail.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const {
  sendEnrollmentEmail,
  sendQuizResultEmail,
  sendRecommendationEmail
} = require('../services/emailService');

console.log('🏁 Starting email service verification test...');
console.log(`📡 SMTP Host: ${process.env.SMTP_HOST || 'None (Using Ethereal developer test mode)'}`);

const testUser = {
  name: 'Test Learner',
  email: 'test-learner@example.com'
};

// 1. Test Course Enrollment Template
const testCourse = {
  title: 'Introduction to Explainable AI (XAI)',
  category: 'Artificial Intelligence',
  level: 'Intermediate',
  estimatedDuration: 12
};

console.log('\n✉️  1. Sending Test Enrollment Email...');
sendEnrollmentEmail(testUser, testCourse);

// 2. Test Quiz Result Template
const testQuiz = {
  title: 'Neural Networks Fundamentals'
};

const testAttempt = {
  score: 85,
  isPassed: true,
  pointsEarned: 17,
  totalPoints: 20,
  weakTopics: ['backpropagation', 'activation functions'],
  attemptNumber: 1
};

console.log('✉️  2. Sending Test Quiz Result Email...');
sendQuizResultEmail(testUser, testQuiz, testAttempt);

// 3. Test Recommendation Template
const testRecommendation = {
  recommendations: [
    {
      type: 'lesson',
      confidence: 95,
      explanation: 'Based on your recent scores, this lesson on Explainable AI will clarify feature attribution weights.',
      addressesTopic: 'shap values'
    },
    {
      type: 'quiz',
      confidence: 88,
      explanation: 'Practice quiz on Neural Networks will help reinforce backpropagation concept understanding.',
      addressesTopic: 'backpropagation'
    }
  ],
  analysisSummary: {
    overallScore: 72,
    detectedLevel: 'intermediate',
    weakTopics: [
      { topic: 'backpropagation', score: 45 },
      { topic: 'activation functions', score: 55 }
    ]
  },
  generatedBy: 'ml-v1'
};

console.log('✉️  3. Sending Test Recommendation Email...');
sendRecommendationEmail(testUser, testRecommendation);

console.log('\n🚀 All test calls triggered!');
console.log('💡 Check the console logs below for Ethereal Preview URLs or delivery reports.');
