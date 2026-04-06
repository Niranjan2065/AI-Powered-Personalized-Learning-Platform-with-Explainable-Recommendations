// src/pages/CoursesPage.js
import React, { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import CourseCard from '../components/course/CourseCard';
import { Spinner, EmptyState } from '../components/common/StatCard';
import { getCourses } from '../utils/api';

const CATEGORIES = ['all','programming','mathematics','science','language','data-science','web-development','machine-learning'];
const LEVELS = ['all','beginner','intermediate','advanced'];

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: 'all', level: 'all', search: '' });
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filters.category !== 'all') params.category = filters.category;
        if (filters.level !== 'all') params.level = filters.level;
        if (filters.search) params.search = filters.search;
        const { data } = await getCourses(params);
        setCourses(data.data);
        setTotal(data.total);
      } catch {}
      setLoading(false);
    };
    fetch();
  }, [filters.category, filters.level]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(f => ({ ...f })); // trigger useEffect
  };

  return (
    <div>
      <Navbar />
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', padding: '3rem 0', color: '#fff' }}>
        <div className="container">
          <h1 style={{ fontSize: '2rem', marginBottom: '.5rem' }}>Browse Courses</h1>
          <p style={{ opacity: .85 }}>Explore {total} courses across all categories</p>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '.75rem', marginTop: '1.5rem', maxWidth: 500 }}>
            <input className="form-control" placeholder="Search courses..." value={filters.search}
              onChange={e => setFilters(f => ({...f, search: e.target.value}))}
              style={{ background: 'rgba(255,255,255,.9)', flex: 1 }} />
            <button type="submit" className="btn" style={{ background: '#fff', color: '#667eea', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '.5rem' }}>Category:</span>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setFilters(f => ({...f, category: c}))}
                className="btn btn-sm" style={{ marginRight: '.4rem', marginBottom: '.3rem',
                  background: filters.category === c ? 'var(--primary)' : 'var(--bg)',
                  color: filters.category === c ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>
                {c === 'all' ? 'All' : c.replace('-', ' ')}
              </button>
            ))}
          </div>
          <div>
            <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '.5rem' }}>Level:</span>
            {LEVELS.map(l => (
              <button key={l} onClick={() => setFilters(f => ({...f, level: l}))}
                className="btn btn-sm" style={{ marginRight: '.4rem',
                  background: filters.level === l ? 'var(--secondary)' : 'var(--bg)',
                  color: filters.level === l ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}>
                {l === 'all' ? 'All Levels' : l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? <Spinner center /> : courses.length === 0 ? (
          <EmptyState icon="🔍" title="No courses found" message="Try adjusting your filters or search term" />
        ) : (
          <div className="grid-3">
            {courses.map(c => <CourseCard key={c._id} course={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
