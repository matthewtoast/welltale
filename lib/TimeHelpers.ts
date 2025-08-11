export function years_to_seconds(years: number): number {
  return years * 365.25 * 24 * 60 * 60;
}

export function seconds_to_years(seconds: number): number {
  return seconds / (365.25 * 24 * 60 * 60);
}
