import {
  createTimestamp,
  dateNow,
  getMonthDayFromTimestamp,
  getYearFromTimestamp,
  MethodDef,
  MS_PER_DAY,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_SECOND,
  num,
  P,
} from "./MethodHelpers";

export const dateHelpers: Record<string, MethodDef> = {
  now: {
    doc: "Returns current Unix timestamp in milliseconds",
    ex: "wsl.now() // => 1762071908493",
    fn: () => Date.now(),
  },
  timestamp: {
    doc: "Creates a timestamp from date components (UTC)",
    ex: "wsl.timestamp(2024, 12, 25, 10, 30) // => 1735119000000",
    fn: (year?: P, month?: P, day?: P, hour?: P, minute?: P, second?: P) => {
      if (typeof year === "undefined") return Date.now();
      const current = dateNow.current();
      const y = year == null ? current.getUTCFullYear() : num(year);
      const m = month == null ? current.getUTCMonth() + 1 : num(month);
      const d = day == null ? current.getUTCDate() : num(day);
      const h = hour == null ? current.getUTCHours() : num(hour);
      const min = minute == null ? current.getUTCMinutes() : num(minute);
      const s = second == null ? current.getUTCSeconds() : num(second);
      return createTimestamp(y, m, d, h, min, s);
    },
  },
  year: {
    doc: "Gets the year from a timestamp",
    ex: "wsl.year(1735689600000) // => 2025",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      return getYearFromTimestamp(ts);
    },
  },
  month: {
    doc: "Gets the month (1-12) from a timestamp",
    ex: "wsl.month(1735689600000) // => 1",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      return getMonthDayFromTimestamp(ts).month;
    },
  },
  day: {
    doc: "Gets the day of month from a timestamp",
    ex: "wsl.day(1735689600000) // => 1",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      return getMonthDayFromTimestamp(ts).day;
    },
  },
  hour: {
    doc: "Gets the hour (0-23) from a timestamp",
    ex: "wsl.hour(1735732800000) // => 12",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      return Math.floor((ts % MS_PER_DAY) / MS_PER_HOUR);
    },
  },
  minute: {
    doc: "Gets the minute (0-59) from a timestamp",
    ex: "wsl.minute(1735734600000) // => 30",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      return Math.floor((ts % MS_PER_HOUR) / MS_PER_MINUTE);
    },
  },
  second: {
    doc: "Gets the second (0-59) from a timestamp",
    ex: "wsl.second(1735734645000) // => 45",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      return Math.floor((ts % MS_PER_MINUTE) / MS_PER_SECOND);
    },
  },
  weekday: {
    doc: "Gets the weekday (0=Sunday, 6=Saturday) from a timestamp",
    ex: "wsl.weekday(1735689600000) // => 3",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      const days = Math.floor(ts / MS_PER_DAY);
      return (days + 4) % 7;
    },
  },
  weekdayName: {
    doc: "Gets the weekday name from a timestamp",
    ex: "wsl.weekdayName(1735689600000) // => 'Wednesday'",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const weekday = (Math.floor(ts / MS_PER_DAY) + 4) % 7;
      return days[weekday];
    },
  },
  monthName: {
    doc: "Gets the month name from a timestamp",
    ex: "wsl.monthName(1735689600000) // => 'January'",
    fn: (timestamp?: P) => {
      const ts = timestamp == null ? Date.now() : num(timestamp);
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const month = getMonthDayFromTimestamp(ts).month;
      return months[month - 1] || "January";
    },
  },
  daysUntil: {
    doc: "Calculates days until a target timestamp",
    ex: "wsl.daysUntil(1735689600000) // => 5",
    fn: (targetTimestamp: P, fromTimestamp?: P) => {
      const target = num(targetTimestamp);
      const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
      return Math.ceil((target - from) / MS_PER_DAY);
    },
  },
  daysSince: {
    doc: "Calculates days since a past timestamp",
    ex: "wsl.daysSince(1735603200000) // => 1",
    fn: (pastTimestamp: P, fromTimestamp?: P) => {
      const past = num(pastTimestamp);
      const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
      return Math.floor((from - past) / MS_PER_DAY);
    },
  },
  hoursUntil: {
    doc: "Calculates hours until a target timestamp",
    ex: "wsl.hoursUntil(1735732800000) // => 24",
    fn: (targetTimestamp: P, fromTimestamp?: P) => {
      const target = num(targetTimestamp);
      const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
      return Math.ceil((target - from) / MS_PER_HOUR);
    },
  },
  hoursSince: {
    doc: "Calculates hours since a past timestamp",
    ex: "wsl.hoursSince(1735689600000) // => 12",
    fn: (pastTimestamp: P, fromTimestamp?: P) => {
      const past = num(pastTimestamp);
      const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
      return Math.floor((from - past) / MS_PER_HOUR);
    },
  },
  minutesUntil: {
    doc: "Calculates minutes until a target timestamp",
    ex: "wsl.minutesUntil(1735734600000) // => 30",
    fn: (targetTimestamp: P, fromTimestamp?: P) => {
      const target = num(targetTimestamp);
      const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
      return Math.ceil((target - from) / MS_PER_MINUTE);
    },
  },
  minutesSince: {
    doc: "Calculates minutes since a past timestamp",
    ex: "wsl.minutesSince(1735732800000) // => 30",
    fn: (pastTimestamp: P, fromTimestamp?: P) => {
      const past = num(pastTimestamp);
      const from = fromTimestamp == null ? Date.now() : num(fromTimestamp);
      return Math.floor((from - past) / MS_PER_MINUTE);
    },
  },
  msToDecimalHours: {
    doc: "Converts milliseconds to decimal hours",
    ex: "wsl.msToDecimalHours(3600000) // => 1",
    fn: (ms: P) => {
      const milliseconds = num(ms);
      return milliseconds / 3600000;
    },
  },
  decimalHoursToClock: {
    doc: "Converts decimal hours to clock format",
    ex: "wsl.decimalHoursToClock(2.5) // => '2:30'",
    fn: (hours: P) => {
      const h = Math.trunc(num(hours));
      const m = Math.round((Math.abs(num(hours)) % 1) * 60);
      return `${h}:${String(m).padStart(2, "0")}`;
    },
  },
};
