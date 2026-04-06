// src/components/course/CourseCard.js
import React from 'react';
import { Link } from 'react-router-dom';

const CATEGORY_COLORS = {
  programming: '#6C63FF', mathematics: '#3B82F6', science: '#10B981',
  language: '#F59E0B', 'data-science': '#EF4444', 'web-development': '#8B5CF6',
  'machine-learning': '#EC4899', other: '#64748B',
};

export default function CourseCard({ course, enrolled, completionPct }) {
  const color = CATEGORY_COLORS[course.category] || '#6C63FF';

  return (
    <Link to={`/courses/${course._id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card card-hover" style={{ overflow: 'hidden' }}>
        {/* Thumbnail / color band */}
        <div style={{
          height: 140,
          background: course.thumbnail
            ? `url(${course.thumbnail}) center/cover`
            : `linear-gradient(135deg, ${color}22, ${color}44)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {!course.thumbnail && (
            <span style={{ fontSize: '3rem' }}>
              {course.category === 'programming' ? '💻'
                : course.category === 'mathematics' ? '📐'
                : course.category === 'data-science' ? '📊'
                : course.category === 'machine-learning' ? '🤖' : '📚'}
            </span>
          )}
          {/* Level badge */}
          <span style={{
            position: 'absolute', top: 10, right: 10,
            background: '#fff', color, fontWeight: 700,
            fontSize: '.7rem', padding: '.2rem .6rem', borderRadius: 99,
            textTransform: 'capitalize',
          }}>
            {course.level}
          </span>
          {/* Free badge */}
          {course.isFree && (
            <span style={{
              position: 'absolute', top: 10, left: 10,
              background: '#10B981', color: '#fff', fontWeight: 700,
              fontSize: '.7rem', padding: '.2rem .6rem', borderRadius: 99,
            }}>FREE</span>
          )}
        </div>

        <div style={{ padding: '1rem' }}>
          {/* Category */}
          <span style={{ fontSize: '.72rem', color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {course.category?.replace('-', ' ')}
          </span>

          {/* Title */}
          <h3 style={{ fontSize: '1rem', margin: '.4rem 0 .5rem', lineHeight: 1.3, color: 'var(--text-primary)' }}>
            {course.title}
          </h3>

          {/* Tutor */}
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '.75rem' }}>
            by {course.tutor?.name || 'Instructor'}
          </div>

          {/* Enrollment progress if enrolled */}
          {enrolled && completionPct !== undefined && (
            <div style={{ marginBottom: '.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: '.25rem' }}>
                <span>Progress</span><span style={{ fontWeight: 600 }}>{completionPct}%</span>
              </div>
              <div style={{ background: 'var(--border)', borderRadius: 99, height: 6 }}>
                <div style={{ width: `${completionPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: 99 }} />
              </div>
            </div>
          )}

          {/* Footer stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '.75rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              👥 {course.enrollmentCount || 0} students
            </span>
            {course.rating > 0 && (
              <span style={{ fontSize: '.78rem', color: 'var(--accent)', fontWeight: 600 }}>
                ⭐ {course.rating?.toFixed(1)}
              </span>
            )}
            {enrolled ? (
              <span style={{ fontSize: '.78rem', color: 'var(--secondary)', fontWeight: 600 }}>✓ Enrolled</span>
            ) : (
              <span style={{ fontSize: '.78rem', color: color, fontWeight: 600 }}>
                {course.isFree ? 'Free' : `$${course.price}`}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
