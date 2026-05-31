// services/emailService.js
// ─────────────────────────────────────────────────────────────────────────────
// Nodemailer-based transactional email service.
//
// Three public helpers — all fire-and-forget (never throw to callers):
//   sendEnrollmentEmail(user, course)
//   sendQuizResultEmail(user, quiz, attempt)
//   sendRecommendationEmail(user, recommendation)
//
// Transport auto-selects:
//   • SMTP_HOST set  → real SMTP (Gmail, SendGrid, etc.)
//   • otherwise      → Ethereal (dev catch-all, prints preview URL to console)
// ─────────────────────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer');

// ── Brand tokens ──────────────────────────────────────────────────────────────
const BRAND = {
  name:    'AI Learning Platform',
  color:   '#6366F1',          // indigo
  accent:  '#A5F3FC',          // cyan
  dark:    '#1E1B4B',
  url:     process.env.CLIENT_URL || 'http://localhost:3000',
};

// ── Transport factory ─────────────────────────────────────────────────────────
let _transport = null;

async function getTransport() {
  if (_transport) return _transport;

  if (process.env.SMTP_HOST) {
    // Production / real SMTP
    _transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',   // true for port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development fallback — Ethereal (messages visible at ethereal.email)
    const testAccount = await nodemailer.createTestAccount();
    _transport = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('[Email] ⚠️  No SMTP_HOST set — using Ethereal test account:', testAccount.user);
  }

  return _transport;
}

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
function wrapHtml(title, bodyHtml) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND.dark};padding:28px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">
              🎓 ${BRAND.name}
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;color:#1E293B;font-size:15px;line-height:1.7;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:20px 40px;text-align:center;
                     color:#94A3B8;font-size:12px;border-top:1px solid #E2E8F0;">
            © ${new Date().getFullYear()} ${BRAND.name} &nbsp;·&nbsp;
            <a href="${BRAND.url}" style="color:${BRAND.color};text-decoration:none;">Visit Platform</a>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

// ── Badge helper ──────────────────────────────────────────────────────────────
function badge(text, bg = BRAND.color, fg = '#fff') {
  return `<span style="display:inline-block;background:${bg};color:${fg};
    padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">${text}</span>`;
}

// ── CTA button helper ─────────────────────────────────────────────────────────
function ctaBtn(text, href) {
  return `
  <div style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:${BRAND.color};color:#fff;
       padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;
       text-decoration:none;letter-spacing:.2px;">
      ${text}
    </a>
  </div>`;
}

// ── Core send function ────────────────────────────────────────────────────────
async function sendMail({ to, subject, html }) {
  const from = `"${BRAND.name}" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@ai-learning.dev'}>`;
  const transport = await getTransport();
  const info = await transport.sendMail({ from, to, subject, html });

  if (nodemailer.getTestMessageUrl(info)) {
    console.log(`[Email] ✉️  Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  } else {
    console.log(`[Email] ✅ Sent "${subject}" → ${to}`);
  }
}

// ── Fire-and-forget wrapper ────────────────────────────────────────────────────
function fireAndForget(promise, label) {
  promise.catch((err) =>
    console.error(`[Email] ⚠️  Failed to send ${label}:`, err.message)
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. ENROLLMENT EMAIL
// ═════════════════════════════════════════════════════════════════════════════
/**
 * @param {Object} user   - { name, email }
 * @param {Object} course - { title, category, level, estimatedDuration }
 */
function sendEnrollmentEmail(user, course) {
  const subject = `🎉 You're enrolled in "${course.title}"`;
  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;font-size:22px;color:#1E293B;">Welcome aboard, ${user.name}! 🎉</h2>
    <p style="color:#64748B;margin:0 0 24px;">
      You've successfully enrolled in the course below. Your learning journey starts now!
    </p>

    <!-- Course card -->
    <div style="background:#F8FAFF;border:1px solid #E0E7FF;border-radius:12px;padding:24px;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;color:#1E293B;margin-bottom:10px;">
        📚 ${course.title}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
        ${badge(course.category || 'Course', '#E0E7FF', BRAND.color)}
        ${badge(course.level   || 'All levels', '#F0FDF4', '#16A34A')}
        ${course.estimatedDuration ? badge(`⏱ ${course.estimatedDuration} hrs`, '#FEF3C7', '#B45309') : ''}
      </div>
    </div>

    <p style="color:#475569;margin:0 0 4px;">
      ✅ &nbsp;Your enrollment is <strong>active</strong> and ready to go.<br/>
      📈 &nbsp;Track your progress anytime from your student dashboard.
    </p>

    ${ctaBtn('🚀 Start Learning Now', `${BRAND.url}/courses`)}

    <p style="color:#94A3B8;font-size:13px;margin:0;">
      Questions? Just reply to this email and our team will help you out.
    </p>
  `);

  fireAndForget(sendMail({ to: user.email, subject, html }), 'enrollment email');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. QUIZ RESULT EMAIL
// ═════════════════════════════════════════════════════════════════════════════
/**
 * @param {Object} user    - { name, email }
 * @param {Object} quiz    - { title }
 * @param {Object} attempt - { score, isPassed, pointsEarned, totalPoints, weakTopics, attemptNumber }
 */
function sendQuizResultEmail(user, quiz, attempt) {
  const passed     = attempt.isPassed;
  const scoreColor = passed ? '#16A34A' : '#DC2626';
  const scoreBg    = passed ? '#F0FDF4' : '#FEF2F2';
  const subject    = passed
    ? `✅ You passed "${quiz.title}" — ${attempt.score}%`
    : `📊 Quiz result: "${quiz.title}" — ${attempt.score}%`;

  const weakSection = attempt.weakTopics?.length
    ? `
    <div style="background:#FEF2F2;border-left:4px solid #F87171;border-radius:8px;padding:14px 18px;margin:18px 0;">
      <div style="font-weight:700;color:#DC2626;margin-bottom:6px;">📌 Topics to revisit:</div>
      <ul style="margin:0;padding-left:18px;color:#7F1D1D;">
        ${attempt.weakTopics.map(t => `<li>${t}</li>`).join('')}
      </ul>
    </div>`
    : '';

  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;font-size:22px;color:#1E293B;">
      ${passed ? '🎊 Great job,' : '📊 Quiz result for'} ${user.name}!
    </h2>
    <p style="color:#64748B;margin:0 0 24px;">
      Here's a summary of your attempt on <strong>${quiz.title}</strong>.
    </p>

    <!-- Score card -->
    <div style="background:${scoreBg};border:1px solid ${scoreColor}33;border-radius:12px;
                padding:24px;text-align:center;margin-bottom:20px;">
      <div style="font-size:48px;font-weight:800;color:${scoreColor};line-height:1;">
        ${attempt.score}%
      </div>
      <div style="font-size:14px;color:${scoreColor};margin-top:6px;font-weight:600;">
        ${passed ? '✅ PASSED' : '❌ NOT PASSED'}
      </div>
      <div style="color:#64748B;font-size:13px;margin-top:8px;">
        ${attempt.pointsEarned ?? '—'} / ${attempt.totalPoints ?? '—'} points
        &nbsp;·&nbsp; Attempt #${attempt.attemptNumber || 1}
      </div>
    </div>

    ${weakSection}

    <p style="color:#475569;margin:0 0 4px;">
      ${passed
        ? '🌟 Your result has been saved. Keep up the great momentum!'
        : '💡 Don\'t worry — review the topics above and try again. You\'ve got this!'}
    </p>

    ${ctaBtn(passed ? '🏆 View My Results' : '🔄 Retake Quiz', `${BRAND.url}/courses`)}
  `);

  fireAndForget(sendMail({ to: user.email, subject, html }), 'quiz result email');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. RECOMMENDATION EMAIL
// ═════════════════════════════════════════════════════════════════════════════
/**
 * @param {Object} user           - { name, email }
 * @param {Object} recommendation - { recommendations[], analysisSummary, generatedBy }
 */
function sendRecommendationEmail(user, recommendation) {
  const summary  = recommendation.analysisSummary || {};
  const items    = (recommendation.recommendations || []).slice(0, 4);
  const engine   = recommendation.generatedBy === 'ml-v1' ? '🤖 ML-Powered' : '📊 Rule-Based';
  const subject  = `✨ Your personalised learning path is ready, ${user.name}!`;

  const itemsHtml = items.map((item, i) => `
    <div style="border:1px solid #E0E7FF;border-radius:10px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:20px;">${item.type === 'quiz' ? '📝' : '📘'}</span>
        <div>
          <div style="font-weight:700;color:#1E293B;font-size:14px;margin-bottom:3px;">
            ${item.type === 'quiz' ? 'Practice Quiz' : 'Lesson'} #${i + 1}
            ${badge(`${item.confidence ?? 0}% match`, '#EDE9FE', '#7C3AED')}
          </div>
          <div style="color:#64748B;font-size:13px;line-height:1.6;">
            ${item.explanation || 'Personalised recommendation based on your activity.'}
          </div>
          ${item.addressesTopic
            ? `<div style="margin-top:5px;">${badge('Topic: ' + item.addressesTopic, '#F0FDF4', '#16A34A')}</div>`
            : ''}
        </div>
      </div>
    </div>`).join('');

  const weakList = (summary.weakTopics || []).slice(0, 3);
  const weakSection = weakList.length ? `
    <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:12px 16px;margin:18px 0;">
      <div style="font-weight:700;color:#92400E;margin-bottom:4px;">🎯 Focus areas identified:</div>
      ${weakList.map(t => `<div style="color:#78350F;font-size:13px;">• ${t.topic} — ${t.score ?? '?'}%</div>`).join('')}
    </div>` : '';

  const html = wrapHtml(subject, `
    <h2 style="margin:0 0 8px;font-size:22px;color:#1E293B;">
      ✨ Your personalised path is ready!
    </h2>
    <p style="color:#64748B;margin:0 0 8px;">
      Hi <strong>${user.name}</strong>, our ${engine} engine has analysed your activity
      and built a learning path just for you.
    </p>
    <div style="margin-bottom:20px;">
      ${badge(`Overall score: ${summary.overallScore ?? '—'}%`, BRAND.dark, '#fff')}
      &nbsp;
      ${badge(`Level: ${summary.detectedLevel || 'beginner'}`, BRAND.color, '#fff')}
      &nbsp;
      ${badge(engine, '#1E1B4B', BRAND.accent)}
    </div>

    ${weakSection}

    <div style="font-weight:700;color:#1E293B;margin-bottom:12px;font-size:15px;">
      📋 Top recommendations for you:
    </div>
    ${itemsHtml}

    ${ctaBtn('🚀 View Full Learning Path', `${BRAND.url}/recommendations`)}

    <p style="color:#94A3B8;font-size:12px;margin:0;">
      Recommendations refresh as you complete more quizzes and lessons.
      Generate a new path anytime from your dashboard.
    </p>
  `);

  fireAndForget(sendMail({ to: user.email, subject, html }), 'recommendation email');
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  sendEnrollmentEmail,
  sendQuizResultEmail,
  sendRecommendationEmail,
};
