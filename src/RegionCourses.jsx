import { useEffect, useRef } from 'react';

const formatKm = (km) => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(km < 10 ? 1 : 0)}km`);

function CourseCard({ course, selected, onSelect, focusedId, onFocusStop, onSaveAll, savedCount }) {
  const ref = useRef(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  const allSaved = savedCount === course.stops.length;
  return (
    <li ref={ref} className={`course-card ${selected ? 'selected' : ''}`}>
      <button className="course-card-head" onClick={() => onSelect(selected ? null : course.id)} aria-expanded={selected}>
        {course.image ? <img src={course.image} alt="" loading="lazy" /> : <div className="course-card-noimg">🧭</div>}
        <div className="course-card-body">
          <span className={`badge ${course.source === 'auto' ? 'auto' : 'official'}`}>
            {course.source === 'auto' ? '자동 추천' : '관광공사 추천'}
          </span>
          <strong>{course.title}</strong>
          <span className="muted small">
            {course.subtitle ? `${course.subtitle} · ` : ''}
            {course.stops.length}곳 · 직선 {formatKm(course.km)}
          </span>
          {!selected && (
            <span className="course-card-preview">{course.stops.map((s) => s.title).join(' → ')}</span>
          )}
        </div>
      </button>

      {selected && (
        <div className="course-card-detail">
          <ol className="course-stops">
            {course.stops.map((s, i) => (
              <li key={s.id} className={focusedId === s.id ? 'focused' : ''}>
                <button onClick={() => onFocusStop(s.id)}>
                  <span className="stop-num">{i + 1}</span>
                  {s.image ? <img src={s.image} alt="" loading="lazy" /> : null}
                  <span className="course-stop-title">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
          {course.total > course.stops.length && (
            <p className="muted small">
              전체 {course.total}곳 중 위치를 확인할 수 있는 {course.stops.length}곳만 표시했어요.
            </p>
          )}
          <button className="primary" onClick={() => onSaveAll(course)} disabled={allSaved}>
            {allSaved ? '♥ 모두 내 코스에 담겨 있어요' : '♥ 내 코스로 담고 이동 시간 보기'}
          </button>
        </div>
      )}
    </li>
  );
}

export default function RegionCourses({ courses, selectedId, onSelect, focusedId, onFocusStop, onSaveAll, isFavorite }) {
  if (!courses.length) {
    return <p className="empty-msg">이 지역에는 아직 추천 코스가 없습니다.</p>;
  }
  return (
    <ul className="course-cards">
      {courses.map((c) => (
        <CourseCard
          key={c.id}
          course={c}
          selected={c.id === selectedId}
          onSelect={onSelect}
          focusedId={focusedId}
          onFocusStop={onFocusStop}
          onSaveAll={onSaveAll}
          savedCount={c.stops.filter((s) => isFavorite(s.id)).length}
        />
      ))}
    </ul>
  );
}
