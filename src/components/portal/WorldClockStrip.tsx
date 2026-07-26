import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudLightning } from 'lucide-react';
import { SystemSettings } from '../../types';
import { parseWorldClockHolidays } from '../../utils';
import { Tooltip } from '../common/Tooltip';

interface ClockTime {
  timeStr: string;
  status: 'Holiday' | 'Weekend' | 'SchoolHoliday' | 'Working';
  isHoliday: boolean;
  holidayName: string;
  isWeekend: boolean;
}

// States with an official Friday-Saturday weekend (and the matching KPM school-calendar
// Kumpulan A). Johor observed this from 2014 but reverted to the standard Saturday-Sunday
// weekend on 2025-01-01 -- do not add it back without checking current state policy first.
const FRIDAY_SATURDAY_WEEKEND_CITIES = ['Kota Bharu', 'Kuala Terengganu', 'Alor Setar'];

const CITY_SETS = [
  // Set 1 (Default)
  [
    { name: 'Kangar', tz: 'Asia/Kuala_Lumpur', stateCode: 'PLS', lat: 6.4414, lon: 100.1986 },
    { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', stateCode: 'KUL', lat: 3.1390, lon: 101.6869 },
    { name: 'Kota Bharu', tz: 'Asia/Kuala_Lumpur', stateCode: 'KTN', lat: 6.1254, lon: 102.2381 },
    { name: 'Johor Bahru', tz: 'Asia/Kuala_Lumpur', stateCode: 'JHR', lat: 1.4927, lon: 103.7414 },
    { name: 'Kota Kinabalu', tz: 'Asia/Kuala_Lumpur', stateCode: 'SBH', lat: 5.9804, lon: 116.0735 }
  ],
  // Set 2
  [
    { name: 'Alor Setar', tz: 'Asia/Kuala_Lumpur', stateCode: 'KDH', lat: 6.1248, lon: 100.3678 },
    { name: 'Shah Alam', tz: 'Asia/Kuala_Lumpur', stateCode: 'SGR', lat: 3.0738, lon: 101.5183 },
    { name: 'Seremban', tz: 'Asia/Kuala_Lumpur', stateCode: 'NSN', lat: 2.7258, lon: 101.9424 },
    { name: 'Kuantan', tz: 'Asia/Kuala_Lumpur', stateCode: 'PHG', lat: 3.8077, lon: 103.3260 },
    { name: 'Labuan', tz: 'Asia/Kuala_Lumpur', stateCode: 'LBN', lat: 5.2831, lon: 115.2308 }
  ],
  // Set 3
  [
    { name: 'George Town', tz: 'Asia/Kuala_Lumpur', stateCode: 'PNG', lat: 5.4164, lon: 100.3327 },
    { name: 'Ipoh', tz: 'Asia/Kuala_Lumpur', stateCode: 'PRK', lat: 4.5975, lon: 101.0901 },
    { name: 'Bandaraya Melaka', tz: 'Asia/Kuala_Lumpur', stateCode: 'MLK', lat: 2.1896, lon: 102.2501 },
    { name: 'Kuala Terengganu', tz: 'Asia/Kuala_Lumpur', stateCode: 'TRG', lat: 5.3302, lon: 103.1408 },
    { name: 'Kuching', tz: 'Asia/Kuala_Lumpur', stateCode: 'SWK', lat: 1.5533, lon: 110.3592 }
  ]
];

const DEFAULT_CITY_WEATHER: Record<string, { temp: number; code: number; label: string }> = {
  'Kangar': { temp: 31, code: 1, label: 'Berawan' },
  'Kuala Lumpur': { temp: 32, code: 2, label: 'Berawan' },
  'Kota Bharu': { temp: 30, code: 61, label: 'Hujan' },
  'Johor Bahru': { temp: 31, code: 2, label: 'Berawan' },
  'Kota Kinabalu': { temp: 31, code: 0, label: 'Cerah' },
  'Alor Setar': { temp: 32, code: 1, label: 'Berawan' },
  'Shah Alam': { temp: 33, code: 2, label: 'Berawan' },
  'Seremban': { temp: 31, code: 1, label: 'Berawan' },
  'Kuantan': { temp: 30, code: 61, label: 'Hujan' },
  'Labuan': { temp: 30, code: 0, label: 'Cerah' },
  'George Town': { temp: 31, code: 1, label: 'Berawan' },
  'Ipoh': { temp: 32, code: 2, label: 'Berawan' },
  'Bandaraya Melaka': { temp: 31, code: 1, label: 'Berawan' },
  'Kuala Terengganu': { temp: 29, code: 61, label: 'Hujan' },
  'Kuching': { temp: 29, code: 2, label: 'Berawan' }
};

const getWeatherDetails = (code: number) => {
  if (code === 0) return { icon: Sun, label: 'Cerah' };
  if (code === 1 || code === 2) return { icon: CloudSun, label: 'Berawan' };
  if (code === 3) return { icon: Cloud, label: 'Redup' };
  if (code === 45 || code === 48) return { icon: CloudFog, label: 'Kabut' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: CloudRain, label: 'Hujan' };
  if ([95, 96, 99].includes(code)) return { icon: CloudLightning, label: 'Ribut Petir' };
  return { icon: CloudSun, label: 'Berawan' };
};

const HOLIDAYS_2026: Record<string, Record<string, string>> = {
  'Kuala Lumpur': {
    '01/01': "Tahun Baharu",
    '02/01': "Hari Wilayah Persekutuan",
    '05/01': "Hari Pekerja",
    '08/31': "Hari Kebangsaan",
    '09/16': "Hari Malaysia",
    '12/25': "Hari Krismas"
  }
};

interface WorldClockStripProps {
  systemSettings: SystemSettings;
  worldClockHolidaysGoogleDocText?: string;
  apiHolidaysData?: any;
}

const renderCityCard = (
  c: { name: string; tz: string; stateCode: string },
  timesMap: Record<string, ClockTime>,
  cityWeather: Record<string, { temp: number; code: number }>
) => {
  const timeData = timesMap[c.name];
  const weather = cityWeather[c.name] || DEFAULT_CITY_WEATHER[c.name] || { temp: 30, code: 1, label: 'Berawan' };
  const { icon: WeatherIcon, label: weatherLabel } = getWeatherDetails(weather.code);

  let cityColor = 'text-[#802334] font-semibold';
  let weatherColor = 'text-[#802334]';
  let isHoliday = false;
  let holidayName = '';

  if (timeData) {
    isHoliday = timeData.status === 'Holiday';
    holidayName = timeData.holidayName || '';

    if (timeData.status === 'Holiday') {
      cityColor = 'text-[#1F1F1F] font-bold border-b border-dashed border-[#1F1F1F]/40';
      weatherColor = 'text-[#1F1F1F]';
    } else if (timeData.status === 'Weekend') {
      cityColor = 'text-stone-400 font-light';
      weatherColor = 'text-stone-400';
    } else if (timeData.status === 'SchoolHoliday') {
      cityColor = 'text-[#C06C84] font-medium';
      weatherColor = 'text-[#C06C84]';
    } else {
      cityColor = 'text-[#802334] font-semibold';
      weatherColor = 'text-[#802334]';
    }
  }

  return (
    <div className="h-[60px] w-full flex flex-col items-center justify-center select-none py-1 group relative">
      {/* Weather Icon & Temp synced with City Status Color */}
      <Tooltip text={weatherLabel}>
        <div
          className={`flex items-center justify-center gap-1 ${weatherColor} mb-0.5 select-none transition-transform duration-200 group-hover:scale-105`}
        >
          <WeatherIcon className={`w-3.5 h-3.5 ${weatherColor} stroke-[2.2]`} />
          <span className={`font-mono text-[9px] font-bold ${weatherColor} tracking-tight`}>
            {Math.round(weather.temp)}°C
          </span>
        </div>
      </Tooltip>

      <p className={`font-sans text-[9px] tracking-editorial uppercase mb-0.5 inline-block select-none transition-colors duration-200 ${cityColor} ${isHoliday ? 'cursor-help' : ''}`}>
        {c.name}
      </p>
      {isHoliday && holidayName && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:flex flex-col items-center bg-[#FAF7F0] text-[#1F1F1F] px-3 py-1.5 rounded-sm shadow-md whitespace-nowrap z-[100] pointer-events-none border border-[#802334]/30 text-center animate-fade-in">
          <span className="font-sans text-[8px] uppercase tracking-widest text-[#802334] font-bold">Cuti Umum</span>
          <span className="font-serif text-[11px] text-[#1F1F1F] font-medium tracking-tight">{holidayName}</span>
        </div>
      )}
      <p className="font-serif text-[10px] sm:text-[11px] md:text-xs text-[#1F1F1F] font-light tracking-tight whitespace-nowrap">
        {timeData ? timeData.timeStr : 'Loading...'}
      </p>
    </div>
  );
};

export const WorldClockStrip: React.FC<WorldClockStripProps> = React.memo(({
  systemSettings,
  worldClockHolidaysGoogleDocText = '',
  apiHolidaysData
}) => {
  const [worldClockSetIndex, setWorldClockSetIndex] = useState<number>(0);
  const [displaySetIndex, setDisplaySetIndex] = useState<number>(0);
  const [prevSetIndex, setPrevSetIndex] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const [timesMap, setTimesMap] = useState<Record<string, ClockTime>>({});
  const [cityWeather, setCityWeather] = useState<Record<string, { temp: number; code: number }>>({});

  // Official JAKIM Hijri date (fetched once -- it's a calendar day, not something that needs
  // per-second polling like the clock). Falls back to a local islamic-umalqura estimate (computed
  // in updateTime below) if this fetch fails; confirmed via direct comparison against JAKIM's own
  // data that the local estimate can drift a day off the real one, so this is preferred whenever
  // it's reachable.
  const [jakimHijriDate, setJakimHijriDate] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/system/hijri-date')
      .then(res => res.json())
      .then(data => {
        if (data && data.hijri) setJakimHijriDate(data.hijri); // "YYYY-MM-DD"
      })
      .catch(() => {});
  }, []);

  const triggerNextSet = () => {
    if (isAnimating) return;
    const nextIdx = (displaySetIndex + 1) % 3;
    setPrevSetIndex(displaySetIndex);
    setWorldClockSetIndex(nextIdx);
    setIsAnimating(true);
  };

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => {
        setDisplaySetIndex(worldClockSetIndex);
        setIsAnimating(false);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, worldClockSetIndex]);

  // 1. Live Weather Fetcher for All 15 Cities
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const allCities = CITY_SETS.flat();
        const lats = allCities.map(c => c.lat).join(',');
        const lons = allCities.map(c => c.lon).join(',');
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          const weatherMap: Record<string, { temp: number; code: number }> = {};
          data.forEach((item: any, idx: number) => {
            if (item && item.current) {
              weatherMap[allCities[idx].name] = {
                temp: item.current.temperature_2m,
                code: item.current.weather_code
              };
            }
          });
          setCityWeather(weatherMap);
        }
      } catch (err) {}
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Auto-rotate World Clock Set (default 60s / 1 min)
  useEffect(() => {
    const intervalSec = systemSettings.worldClockIntervalSec !== undefined ? Number(systemSettings.worldClockIntervalSec) : 60;
    if (intervalSec <= 0) return;

    const timer = setInterval(() => {
      triggerNextSet();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [systemSettings.worldClockIntervalSec, displaySetIndex, isAnimating]);

  // 3. Document-level Background Click Handler
  useEffect(() => {
    const handleWindowClick = (e: MouseEvent) => {
      const bgClickEnabled = systemSettings.worldClockBgClickEnabled !== false;
      if (!bgClickEnabled) return;
      const target = e.target as HTMLElement;
      if (!target) return;
      if (target.closest('button, a, input, select, textarea, [data-prevent-bg-click], .modal-container, #news-overlay, nav, header')) {
        return;
      }
      triggerNextSet();
    };

    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, [systemSettings.worldClockBgClickEnabled, displaySetIndex, isAnimating]);

  // 4. Update Time & Holiday Status locally
  useEffect(() => {
    const allCities = CITY_SETS.flat();
    const stateMap: Record<string, string> = {
      'Kangar': 'PLS',
      'Kuala Lumpur': 'KUL',
      'Kota Bharu': 'KTN',
      'Johor Bahru': 'JHR',
      'Kota Kinabalu': 'SBH',
      'Alor Setar': 'KDH',
      'Shah Alam': 'SGR',
      'Seremban': 'NSN',
      'Kuantan': 'PHG',
      'Labuan': 'LBN',
      'George Town': 'PNG',
      'Ipoh': 'PRK',
      'Bandaraya Melaka': 'MLK',
      'Kuala Terengganu': 'TRG',
      'Kuching': 'SWK'
    };

    const updateTime = () => {
      const newTimesMap: Record<string, ClockTime> = {};
      allCities.forEach(c => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: c.tz,
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          const parts = formatter.formatToParts(new Date());
          const obj: any = {};
          parts.forEach(p => { obj[p.type] = p.value; });

          const dateStr = `${obj.day}/${obj.month}/${obj.year}`;

          // Kedah/Terengganu/Kelantan (same 3 states as FRIDAY_SATURDAY_WEEKEND_CITIES) show a
          // Hijri date instead of Gregorian, same DD/MM/YY display format. Only the display
          // string changes -- dateStr/gregKey above stay Gregorian since holiday matching (both
          // HOLIDAYS_2026 and custom-holiday text) is keyed to the Gregorian calendar.
          let displayDateStr = dateStr;
          if (FRIDAY_SATURDAY_WEEKEND_CITIES.includes(c.name)) {
            if (jakimHijriDate) {
              // "YYYY-MM-DD" (Hijri, from JAKIM) -> "DD/MM/YY" to match the Gregorian display format.
              const [hy, hm, hd] = jakimHijriDate.split('-');
              displayDateStr = `${hd}/${hm}/${hy.slice(-2)}`;
            } else {
              // Fallback only: local islamic-umalqura estimate, used when the JAKIM proxy is
              // unreachable. Confirmed to drift up to a day off JAKIM's actual calendar.
              const hijriFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
                timeZone: c.tz,
                year: '2-digit',
                month: '2-digit',
                day: '2-digit'
              });
              const hijriParts: any = {};
              hijriFormatter.formatToParts(new Date()).forEach(p => { hijriParts[p.type] = p.value; });
              displayDateStr = `${hijriParts.day}/${hijriParts.month}/${hijriParts.year}`;
            }
          }

          // Parse custom holidays
          const { items: customHolidaysText } = parseWorldClockHolidays(systemSettings.worldClockHolidaysText || '');
          const { items: customHolidaysGoogle } = parseWorldClockHolidays(worldClockHolidaysGoogleDocText || '');
          const allCustomHolidays = [...customHolidaysText, ...customHolidaysGoogle];

          // Find match for this city and dateStr
          const customMatches = allCustomHolidays.filter(h => 
            h.city.toLowerCase() === c.name.toLowerCase() && 
            h.dateStr === dateStr
          );

          let isHoliday = false;
          let holidayName = '';
          let isWeekend = false;
          let isSchoolHoliday = false;

          const day = obj.weekday.toUpperCase();

          const gregKey = `${obj.month}/${obj.day}`;
          let cityHolidays = HOLIDAYS_2026[c.name];
          if (!cityHolidays && c.tz === 'Asia/Kuala_Lumpur') {
            cityHolidays = HOLIDAYS_2026['Kuala Lumpur'] || {};
          }
          if (cityHolidays && cityHolidays[gregKey]) {
            isHoliday = true;
            holidayName = cityHolidays[gregKey];
          }

          if (apiHolidaysData && Array.isArray(apiHolidaysData.publicHolidays)) {
            const targetStateCode = stateMap[c.name];
            const apiMatch = apiHolidaysData.publicHolidays.find((h: any) => {
              const [yr, mn, dy] = h.date.split('-');
              const matchDate = `${dy}/${mn}/${yr.slice(-2)}`;
              const isDateMatch = matchDate === dateStr;
              const isStateMatch = !targetStateCode || (h.state_codes && h.state_codes.includes(targetStateCode));
              return isDateMatch && isStateMatch;
            });

            if (apiMatch) {
              isHoliday = true;
              holidayName = apiMatch.name;
            }
          }

          if (apiHolidaysData && Array.isArray(apiHolidaysData.schoolHolidays)) {
            const today = new Date();
            const yearStr = today.getFullYear();
            const monthStr = String(today.getMonth() + 1).padStart(2, '0');
            const dayStrVal = String(today.getDate()).padStart(2, '0');
            const todayISO = `${yearStr}-${monthStr}-${dayStrVal}`;
            
            const isGroupA = FRIDAY_SATURDAY_WEEKEND_CITIES.includes(c.name);
            const schoolMatch = apiHolidaysData.schoolHolidays.find((sh: any) => {
              const groupMatch = isGroupA ? sh.group === 'A' : sh.group === 'B';
              return groupMatch && todayISO >= sh.start && todayISO <= sh.end;
            });
            if (schoolMatch) {
              isSchoolHoliday = true;
            }
          }

          const isGroupAWeekend = FRIDAY_SATURDAY_WEEKEND_CITIES.includes(c.name);
          const isDefaultWeekend = isGroupAWeekend
            ? (day === 'FRI' || day === 'SAT')
            : (day === 'SAT' || day === 'SUN');
          isWeekend = isDefaultWeekend;

          const customHolidayMatch = customMatches.find(m => m.status === 'Holiday');
          if (customHolidayMatch) {
            isHoliday = true;
            holidayName = customHolidayMatch.holidayName || holidayName || 'Cuti Umum';
          }

          const customSchoolHolidayMatch = customMatches.find(m => m.status === 'SchoolHoliday');
          if (customSchoolHolidayMatch) {
            isSchoolHoliday = true;
          }

          const customWeekendMatch = customMatches.find(m => m.status === 'Weekend');
          if (customWeekendMatch) {
            isWeekend = true;
          }

          const customWorkingMatch = customMatches.find(m => m.status === 'Working');
          if (customWorkingMatch) {
            isHoliday = false;
            isWeekend = false;
            isSchoolHoliday = false;
          }

          let finalStatus: 'Holiday' | 'Weekend' | 'SchoolHoliday' | 'Working' = 'Working';
          if (isHoliday) {
            finalStatus = 'Holiday';
          } else if (isWeekend) {
            finalStatus = 'Weekend';
          } else if (isSchoolHoliday) {
            finalStatus = 'SchoolHoliday';
          }

          const DAY_LABEL_MS: Record<string, string> = {
            MON: 'ISN', TUE: 'SEL', WED: 'RAB', THU: 'KHA', FRI: 'JUM', SAT: 'SAB', SUN: 'AHD'
          };
          const dayLabel = DAY_LABEL_MS[day] || day;
          const timeStr = `${displayDateStr} · ${dayLabel} · ${obj.hour}:${obj.minute} ${obj.dayPeriod}`;

          newTimesMap[c.name] = {
            timeStr,
            status: finalStatus,
            holidayName,
            isHoliday,
            isWeekend
          };
        } catch (e) {}
      });
      setTimesMap(newTimesMap);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [systemSettings.worldClockHolidaysText, worldClockHolidaysGoogleDocText, apiHolidaysData, jakimHijriDate]);

  return (
    <div
      className="relative w-full overflow-hidden min-h-[68px] py-1 flex justify-center items-center text-center cursor-pointer select-none"
      id="world-clock"
      onClick={(e) => {
        const bgClickEnabled = systemSettings.worldClockBgClickEnabled !== false;
        if (!bgClickEnabled) return;
        triggerNextSet();
      }}
    >
      <div className="grid grid-cols-5 gap-1 sm:gap-3 md:gap-6 px-2 w-full max-w-6xl mx-auto">
        {[0, 1, 2, 3, 4].map((colIndex) => {
          const currentCity = CITY_SETS[displaySetIndex][colIndex];
          const targetCity = CITY_SETS[worldClockSetIndex][colIndex];
          const isEvenCol = colIndex % 2 === 0;

          // Downward spin drum (Cols 0, 2, 4): Target city is placed ABOVE (-60px), track slides down (y: 0 -> 60px)
          // Upward spin drum (Cols 1, 3): Target city is placed BELOW (+60px), track slides up (y: 0 -> -60px)
          const slideTargetY = isEvenCol ? 60 : -60;

          return (
            <div 
              key={`odometer-reel-${colIndex}`} 
              className="relative h-[60px] overflow-hidden flex flex-col items-center justify-center w-full px-0.5"
            >
              {isAnimating ? (
                <motion.div
                  key={`anim-${prevSetIndex}-to-${worldClockSetIndex}-${colIndex}`}
                  initial={{ y: 0 }}
                  animate={{ y: slideTargetY }}
                  transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
                  className="absolute inset-x-0 flex flex-col items-center justify-center"
                  style={{ top: isEvenCol ? '-60px' : '0px' }}
                >
                  {isEvenCol ? (
                    <>
                      {renderCityCard(targetCity, timesMap, cityWeather)}
                      {renderCityCard(currentCity, timesMap, cityWeather)}
                    </>
                  ) : (
                    <>
                      {renderCityCard(currentCity, timesMap, cityWeather)}
                      {renderCityCard(targetCity, timesMap, cityWeather)}
                    </>
                  )}
                </motion.div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {renderCityCard(currentCity, timesMap, cityWeather)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
