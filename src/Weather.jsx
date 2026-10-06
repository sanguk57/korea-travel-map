// 기상청 단기예보 3일치 (데이터 수집 시각 기준)
const ICON = { rain: '🌧️', sleet: '🌨️', snow: '❄️', shower: '🌦️', clear: '☀️', cloudy: '⛅', overcast: '☁️' };

function iconOf(day) {
  if (day.pty === 1) return [ICON.rain, '비'];
  if (day.pty === 2) return [ICON.sleet, '비/눈'];
  if (day.pty === 3) return [ICON.snow, '눈'];
  if (day.pty === 4) return [ICON.shower, '소나기'];
  if (day.sky === 4) return [ICON.overcast, '흐림'];
  if (day.sky === 3) return [ICON.cloudy, '구름많음'];
  return [ICON.clear, '맑음'];
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function label(yyyymmdd) {
  const d = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T00:00:00+09:00`);
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');
  const diff = Math.round((d - new Date(`${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T00:00:00+09:00`)) / 86400e3);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  return `${Number(yyyymmdd.slice(6, 8))}일(${WEEKDAY[d.getUTCDay()]})`;
}

export default function Weather({ weather }) {
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');
  const days = weather?.days?.filter((d) => d.date >= today);
  if (!days?.length) return null;
  return (
    <div className="weather" aria-label="날씨 예보">
      {days.map((d) => {
        const [icon, text] = iconOf(d);
        return (
          <div key={d.date} className="weather-day" title={`${text}${d.pop != null ? `, 강수확률 ${d.pop}%` : ''}`}>
            <span className="weather-label">{label(d.date)}</span>
            <span className="weather-icon" aria-label={text}>
              {icon}
            </span>
            <span className="weather-temp">
              <b>{d.tmax}°</b> <span className="muted">{d.tmin}°</span>
            </span>
            {d.pop >= 30 && <span className="weather-pop">☔ {d.pop}%</span>}
          </div>
        );
      })}
    </div>
  );
}
