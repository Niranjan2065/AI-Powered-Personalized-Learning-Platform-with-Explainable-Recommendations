// src/pages/AdminDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import Navbar from '../components/common/Navbar';
import { StatCard, Spinner } from '../components/common/StatCard';
import { getAdminStats, getAllUsers, toggleUserStatus, getAllCoursesAdmin, getPerformanceOverview } from '../utils/api';

export default function AdminDashboard() {
  const [stats, setStats]           = useState(null);
  const [users, setUsers]           = useState([]);
  const [courses, setCourses]       = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab]               = useState('overview');
  const [userFilter, setUserFilter] = useState('all');

  // ✅ FIX: Extracted fetch logic into useCallback so it can be called
  // both on mount AND when the admin clicks the Refresh button.
  // Previously data was only fetched once on mount and never updated.
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // ✅ FIX: getAllUsers now fetches with limit=200 to get ALL users,
      // not just the first 20 (the old default which hid newly created users).
      const [sRes, uRes, cRes, pRes] = await Promise.all([
        getAdminStats(),
        getAllUsers({ limit: 200 }),
        getAllCoursesAdmin(),
        getPerformanceOverview(),
      ]);
      setStats(sRes.data.data);
      setUsers(uRes.data.data);
      setCourses(cRes.data.data);
      setPerformance(pRes.data.data);
    } catch (err) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleToggleUser = async (userId) => {
    try {
      const { data } = await toggleUserStatus(userId);
      setUsers(us => us.map(u => u._id === userId ? { ...u, isActive: data.data.isActive } : u));
      toast.success(`User ${data.data.isActive ? 'activated' : 'deactivated'}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <><Navbar /><Spinner center /></>;

  // ✅ FIX: Filter now matches both "tutor" AND "teacher" roles so tutors
  // registered via the normal signup flow (role="teacher") are shown.
  const filteredUsers = userFilter === 'all'
    ? users
    : userFilter === 'tutor'
      ? users.filter(u => u.role === 'tutor' || u.role === 'teacher')
      : users.filter(u => u.role === userFilter);

  const tabs = ['overview', 'users', 'courses', 'performance'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div className="container" style={{ padding: '2rem 1.5rem' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          color: '#fff', borderRadius: 'var(--radius-lg)',
          padding: '2rem', marginBottom: '2rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
        }}>
          <div>
            <div style={{ fontSize: '1.75rem', marginBottom: '.4rem' }}>🛡️ Admin Dashboard</div>
            <p style={{ opacity: .7, fontSize: '.875rem' }}>Platform overview and management</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* ✅ NEW: Refresh button so admin can reload live data anytime */}
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              style={{
                background: 'rgba(255,255,255,.12)', color: '#fff',
                border: '1px solid rgba(255,255,255,.2)', padding: '.5rem 1.1rem',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '.8rem',
                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '.4rem',
              }}>
              {refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
            </button>
            {[
              { label: 'Total Users',   val: stats?.users?.total },
              { label: 'Courses',       val: stats?.courses?.total },
              { label: 'Enrollments',   val: stats?.enrollments?.total },
            ].map(({ label, val }) => (
              <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,.08)', borderRadius: 'var(--radius-sm)', padding: '.75rem 1.25rem' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{val ?? '—'}</div>
                <div style={{ fontSize: '.72rem', opacity: .65 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          <StatCard icon="👥" label="Total Students"    value={stats?.users?.students}          color="var(--primary)"   trend={`+${stats?.users?.newLast30Days} this month`} />
          <StatCard icon="👨‍🏫" label="Total Tutors"      value={stats?.users?.tutors}            color="var(--secondary)" />
          <StatCard icon="✅" label="Published Courses" value={stats?.courses?.published}        color="var(--info)"      />
          <StatCard icon="📝" label="Avg Quiz Score"    value={`${stats?.quizzes?.averageScore}%`} color="var(--accent)"  />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '.5rem' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: tab === t ? 'var(--primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-secondary)',
                border: 'none', padding: '.5rem 1.25rem', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', fontWeight: 600, fontSize: '.875rem', textTransform: 'capitalize',
                transition: 'all .15s',
              }}>
              {t === 'overview' ? '📊 Overview' : t === 'users' ? '👥 Users' : t === 'courses' ? '📚 Courses' : '🏆 Performance'}
            </button>
          ))}
        </div>

        {/* ---- OVERVIEW TAB ---- */}
        {tab === 'overview' && (
          <div className="grid-2">
            {/* Platform health */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>📈 Platform Health</h3>
              {[
                { label: 'Course Publish Rate', value: Math.round((stats?.courses?.published / stats?.courses?.total) * 100) || 0, color: 'var(--secondary)' },
                { label: 'Quiz Pass Rate',       value: stats?.quizzes?.averageScore || 0,                                          color: 'var(--primary)'   },
                { label: 'Active Users',         value: Math.round((users.filter(u => u.isActive).length / (users.length || 1)) * 100), color: 'var(--info)'  },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', marginBottom: '.3rem' }}>
                    <span>{label}</span><span style={{ fontWeight: 700, color }}>{value}%</span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 99, height: 8 }}>
                    <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Users — ✅ shows last 6 by creation date */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>🆕 Recent Users ({users.length} total)</h3>
              {users.slice(0, 6).map(u => (
                <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: u.role === 'student' ? '#EEF2FF' : (u.role === 'tutor' || u.role === 'teacher') ? '#D1FAE5' : '#FEE2E2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '.9rem',
                    color: u.role === 'student' ? 'var(--primary)' : (u.role === 'tutor' || u.role === 'teacher') ? 'var(--secondary)' : 'var(--danger)',
                    flexShrink: 0,
                  }}>
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                  <span className={`badge ${u.role === 'student' ? 'badge-primary' : (u.role === 'tutor' || u.role === 'teacher') ? 'badge-success' : 'badge-danger'}`}
                    style={{ fontSize: '.68rem' }}>{u.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---- USERS TAB ---- */}
        {tab === 'users' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            {/* Filter */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
              {/* ✅ FIX: Added 'teacher' filter and fixed counts to match both tutor/teacher */}
              {['all', 'student', 'tutor', 'teacher', 'admin'].map(r => {
                const count = r === 'all'
                  ? users.length
                  : r === 'tutor'
                    ? users.filter(u => u.role === 'tutor' || u.role === 'teacher').length
                    : users.filter(u => u.role === r).length;
                return (
                  <button key={r} onClick={() => setUserFilter(r)}
                    style={{
                      background: userFilter === r ? 'var(--primary)' : 'var(--bg)',
                      color: userFilter === r ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)', padding: '.35rem .85rem',
                      borderRadius: 99, cursor: 'pointer', fontSize: '.78rem',
                      fontWeight: 600, textTransform: 'capitalize',
                    }}>
                    {r} ({count})
                  </button>
                );
              })}
              <span style={{ marginLeft: 'auto', fontSize: '.78rem', color: 'var(--text-muted)' }}>
                Showing {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', fontSize: '.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {['User', 'Role', 'Level', 'Joined', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '.7rem 1.1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem' }}>
                        No users found
                      </td>
                    </tr>
                  ) : filteredUsers.map((u, i) => (
                    <tr key={u._id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--bg)' : '#fff' }}>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '.8rem', color: 'var(--primary)' }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '.82rem' }}>{u.name}</div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        <span className={`badge ${u.role === 'student' ? 'badge-primary' : (u.role === 'tutor' || u.role === 'teacher') ? 'badge-success' : 'badge-danger'}`}
                          style={{ fontSize: '.68rem', textTransform: 'capitalize' }}>{u.role}</span>
                      </td>
                      <td style={{ padding: '.8rem 1.1rem', fontSize: '.8rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                        {u.learningLevel || '—'}
                      </td>
                      <td style={{ padding: '.8rem 1.1rem', fontSize: '.78rem', color: 'var(--text-muted)' }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '.68rem' }}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        {u.role !== 'admin' && (
                          <button onClick={() => handleToggleUser(u._id)}
                            className="btn btn-sm"
                            style={{ background: u.isActive ? '#FEE2E2' : '#D1FAE5', color: u.isActive ? '#991B1B' : '#065F46', border: 'none', cursor: 'pointer' }}>
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- COURSES TAB ---- */}
        {tab === 'courses' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem' }}>All Courses ({courses.length})</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', fontSize: '.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    {['Course', 'Tutor', 'Category', 'Level', 'Students', 'Status'].map(h => (
                      <th key={h} style={{ padding: '.7rem 1.1rem', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '.875rem' }}>
                        No courses found
                      </td>
                    </tr>
                  ) : courses.map((c, i) => (
                    <tr key={c._id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--bg)' : '#fff' }}>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '.82rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{c.isFree ? 'Free' : `$${c.price}`}</div>
                      </td>
                      <td style={{ padding: '.8rem 1.1rem', fontSize: '.82rem' }}>{c.tutor?.name || '—'}</td>
                      <td style={{ padding: '.8rem 1.1rem', fontSize: '.78rem', textTransform: 'capitalize' }}>{c.category?.replace('-', ' ')}</td>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        <span className={`badge ${c.level === 'beginner' ? 'badge-success' : c.level === 'advanced' ? 'badge-danger' : 'badge-warning'}`}
                          style={{ fontSize: '.68rem', textTransform: 'capitalize' }}>{c.level}</span>
                      </td>
                      <td style={{ padding: '.8rem 1.1rem', fontWeight: 700, fontSize: '.875rem' }}>{c.enrollmentCount || 0}</td>
                      <td style={{ padding: '.8rem 1.1rem' }}>
                        <span className={`badge ${c.isPublished ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: '.68rem' }}>
                          {c.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---- PERFORMANCE TAB ---- */}
        {tab === 'performance' && (
          <div className="grid-2">
            {/* Top Students */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>🏆 Top Performing Students</h3>
              {performance?.topStudents?.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No quiz data available yet</p>
              )}
              {performance?.topStudents?.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.85rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: i < 3 ? ['#FEF3C7','#F3F4F6','#FEE2E2'][i] : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.85rem', flexShrink: 0 }}>
                    {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{s.student?.name}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{s.quizzesTaken} quiz{s.quizzesTaken !== 1 ? 'zes' : ''} taken</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: s.avgScore >= 80 ? 'var(--secondary)' : s.avgScore >= 60 ? 'var(--accent)' : 'var(--danger)' }}>
                    {s.avgScore}%
                  </div>
                </div>
              ))}
            </div>

            {/* Popular Courses */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>📚 Most Popular Courses</h3>
              {performance?.popularCourses?.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No enrollment data yet</p>
              )}
              {performance?.popularCourses?.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.85rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    📚
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.course?.title}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.course?.category?.replace('-',' ')}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap', fontSize: '.9rem' }}>
                    👥 {c.count}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Recommendations Stats */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>🤖 AI Engine Status</h3>
              {[
                { label: 'AI Model',            value: 'Rule-based v1',              color: 'var(--primary)'   },
                { label: 'XAI Enabled',         value: '✓ Active',                   color: 'var(--secondary)' },
                { label: 'Total Quiz Attempts', value: stats?.quizzes?.totalAttempts, color: 'var(--info)'      },
                { label: 'Average Score',       value: `${stats?.quizzes?.averageScore}%`, color: 'var(--accent)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.65rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontWeight: 700, color, fontSize: '.875rem' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* System Info */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem' }}>⚙️ System Information</h3>
              {[
                { label: 'Backend',    value: 'Node.js + Express'     },
                { label: 'Database',   value: 'MongoDB + Mongoose'    },
                { label: 'Auth',       value: 'JWT (7-day expiry)'    },
                { label: 'Frontend',   value: 'React.js'              },
                { label: 'AI Engine',  value: 'Rule-based + Scoring'  },
                { label: 'XAI',        value: 'Explainable AI v1'     },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}