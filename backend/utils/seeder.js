// ============================================================
// utils/seeder.js - Safe Database Seeder
// ============================================================
// Run: node utils/seeder.js
//
// ✅ SAFE by default — will NEVER delete your real data.
//    Only creates the 3 default accounts + 1 sample course
//    IF they don't already exist in the database.
//
// ⚠️  There is NO --force flag anymore to prevent accidental
//    data loss. If you truly need a full reset, manually drop
//    the database from MongoDB Compass instead.
// ============================================================

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User   = require('../models/User');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Quiz   = require('../models/Quiz');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected for seeding');
};

const seedData = async () => {
  try {
    console.log('\n🌱 Running safe seeder — your real data is protected.\n');

    // ============================================================
    // SEED DEFAULT USERS — only if they don't exist
    // ============================================================
    const defaultUsers = [
      { name: 'Admin User',    email: 'admin@ailearn.com',   role: 'admin',   password: 'password123' },
      { name: 'John Tutor',    email: 'tutor@ailearn.com',   role: 'tutor',   password: 'password123' },
      { name: 'Alice Student', email: 'student@ailearn.com', role: 'student', password: 'password123' },
    ];

    let tutorUser = null;

    for (const userData of defaultUsers) {
      const existing = await User.findOne({ email: userData.email });

      if (existing) {
        console.log(`⏭️  User already exists: ${userData.email} — skipping`);
        if (userData.role === 'tutor') tutorUser = existing;
        continue;
      }

      // Create user one by one so pre('save') bcrypt hook runs
      const created = await User.create({
        name:     userData.name,
        email:    userData.email,
        password: userData.password,
        role:     userData.role,
        isActive: true,
      });

      if (userData.role === 'tutor') tutorUser = created;
      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
    }

    // ============================================================
    // SEED SAMPLE COURSE — only if no courses exist at all
    // ============================================================
    const courseCount = await Course.countDocuments();

    if (courseCount > 0) {
      console.log(`⏭️  ${courseCount} course(s) already exist — skipping sample course`);
    } else {
      if (!tutorUser) {
        tutorUser = await User.findOne({ email: 'tutor@ailearn.com' });
      }

      const course = await Course.create({
        title: 'Complete JavaScript & Data Structures Masterclass',
        description: 'Learn JavaScript from scratch and master data structures. Perfect for beginners to intermediate developers.',
        shortDescription: 'From JS basics to advanced data structures',
        category: 'programming',
        level: 'beginner',
        tutor: tutorUser._id,
        isPublished: true,
        isFree: true,
        tags: ['javascript', 'data-structures', 'algorithms', 'programming'],
        topicsCovered: ['variables', 'functions', 'arrays', 'objects', 'loops', 'recursion', 'sorting', 'searching'],
        learningOutcomes: [
          'Understand JavaScript fundamentals',
          'Work with arrays and objects',
          'Implement common data structures',
          'Solve algorithmic problems',
        ],
        estimatedDuration: 480,
      });
      console.log(`✅ Created sample course: ${course.title}`);

      // Modules
      const module1 = await Module.create({ title: 'JavaScript Fundamentals', description: 'Variables, functions, and control flow', course: course._id, order: 1, topics: ['variables', 'functions', 'loops', 'conditions'], isPublished: true });
      const module2 = await Module.create({ title: 'Arrays & Objects',        description: 'Deep dive into arrays and objects',      course: course._id, order: 2, topics: ['arrays', 'objects', 'iteration'],             isPublished: true });
      const module3 = await Module.create({ title: 'Data Structures',         description: 'Linked lists, stacks, queues, and trees', course: course._id, order: 3, topics: ['linked-lists', 'stacks', 'queues', 'trees', 'recursion'], isPublished: true });
      console.log('✅ Created modules');

      // Lessons
      await Lesson.create([
        { title: 'Variables and Data Types', module: module1._id, course: course._id, contentType: 'video', order: 1, isPublished: true, topics: ['variables'], estimatedDuration: 10, content: { videoUrl: 'https://www.youtube.com/embed/W6NZfCO5SIk', videoDuration: 600, text: '# Variables and Data Types\n\nLearn about JavaScript variables and data types.' } },
        { title: 'Functions and Scope',      module: module1._id, course: course._id, contentType: 'text',  order: 2, isPublished: true, topics: ['functions'], estimatedDuration: 20, content: { text: '# Functions in JavaScript\n\n## Function Declaration\n```javascript\nfunction greet(name) {\n  return "Hello, " + name;\n}\n```' } },
        { title: 'Loops and Iteration',      module: module1._id, course: course._id, contentType: 'text',  order: 3, isPublished: true, topics: ['loops'],     estimatedDuration: 18, content: { text: '# Loops\n\n## for loop\n```javascript\nfor (let i = 0; i < 5; i++) { console.log(i); }\n```' } },
        { title: 'Working with Arrays',      module: module2._id, course: course._id, contentType: 'text',  order: 1, isPublished: true, topics: ['arrays'],    estimatedDuration: 25, content: { text: '# Arrays\n\n```javascript\nconst fruits = ["apple","banana"];\nfruits.push("cherry");\n```' } },
        { title: 'Objects and JSON',         module: module2._id, course: course._id, contentType: 'text',  order: 2, isPublished: true, topics: ['objects'],   estimatedDuration: 20, content: { text: '# Objects\n\n```javascript\nconst person = { name: "Alice", age: 25 };\n```' } },
        { title: 'Introduction to Data Structures', module: module3._id, course: course._id, contentType: 'text', order: 1, isPublished: true, topics: ['linked-lists', 'stacks'], estimatedDuration: 30, content: { text: '# Data Structures\n\n## Stack\n```javascript\nclass Stack { constructor() { this.items = []; } }\n```' } },
      ]);
      console.log('✅ Created lessons');

      // Quizzes
      await Quiz.create({
        title: 'JavaScript Fundamentals Quiz',
        description: 'Test your knowledge of JS basics',
        module: module1._id, course: course._id, createdBy: tutorUser._id,
        isPublished: true, passingScore: 60, maxAttempts: 5,
        topicsTested: ['variables', 'functions', 'loops'],
        questions: [
          { question: 'Which keyword creates a block-scoped variable?', questionType: 'multiple-choice', options: [{ text: 'var', isCorrect: false }, { text: 'let', isCorrect: true }, { text: 'const', isCorrect: false }, { text: 'define', isCorrect: false }], explanation: 'let is block-scoped.', points: 2, topic: 'variables', difficulty: 'easy' },
          { question: 'Arrow functions have their own "this" keyword.', questionType: 'true-false', correctAnswer: 'false', explanation: 'Arrow functions inherit "this" from lexical scope.', points: 2, topic: 'functions', difficulty: 'medium' },
        ],
      });
      console.log('✅ Created sample quiz');
    }

    // ============================================================
    // DONE
    // ============================================================
    console.log('\n✅ ============ SEEDER COMPLETE ============');
    console.log('🔑 Default login credentials (password: password123)');
    console.log('   👑 Admin:   admin@ailearn.com');
    console.log('   👨‍🏫 Tutor:   tutor@ailearn.com');
    console.log('   🎓 Student: student@ailearn.com');
    console.log('   ✅ All your real courses and data are safe.');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
};

connectDB().then(seedData);