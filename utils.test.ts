import { describe, it, expect } from 'vitest';
import { isDateOutsideAllConfigs, toISODate } from './utils';
import { TimeConfig } from './types';

describe('toISODate — chuẩn hoá ngày trước khi lưu', () => {
  it('giữ nguyên ngày đã đúng chuẩn', () => {
    expect(toISODate('2026-05-20')).toBe('2026-05-20');
  });

  it('đổi ngày kiểu Việt Nam trong Excel: 20/05/2026', () => {
    expect(toISODate('20/05/2026')).toBe('2026-05-20');
    expect(toISODate('5/9/2026')).toBe('2026-09-05');
    expect(toISODate('20-05-2026')).toBe('2026-05-20');
  });

  it('đổi ô Excel kiểu ngày (đối tượng Date) theo giờ địa phương', () => {
    expect(toISODate(new Date(2026, 4, 20))).toBe('2026-05-20');
  });

  it('đổi dạng năm trước: 2026/05/20', () => {
    expect(toISODate('2026/05/20')).toBe('2026-05-20');
  });

  it('đổi số thứ tự ngày của Excel, không lệch dù máy ở múi giờ nào', () => {
    // Số thứ tự Excel tính từ 30/12/1899
    const serialFor = (y: number, m: number, d: number) =>
      Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);

    expect(toISODate(serialFor(2026, 5, 21))).toBe('2026-05-21');
    expect(toISODate(serialFor(2025, 9, 5))).toBe('2025-09-05');
    expect(toISODate(serialFor(2026, 1, 1))).toBe('2026-01-01');
  });

  it('ô trống hoặc không đọc được thì trả về chuỗi rỗng', () => {
    expect(toISODate('')).toBe('');
    expect(toISODate(null)).toBe('');
    expect(toISODate('không phải ngày')).toBe('');
  });
});

const configs: TimeConfig[] = [
  { id: 'W1', name: 'Tuần 1', type: 'WEEK', startDate: '2025-09-05', endDate: '2025-09-14' },
  { id: 'W2', name: 'Tuần 2', type: 'WEEK', startDate: '2025-09-15', endDate: '2025-09-21' },
  { id: 'HK1', name: 'Học kỳ I', type: 'SEMESTER', startDate: '2025-09-05', endDate: '2026-01-11' },
];

describe('isDateOutsideAllConfigs', () => {
  it('ngày nằm trong một mốc thì không cảnh báo', () => {
    expect(isDateOutsideAllConfigs('2025-09-10', configs)).toBe(false);
  });

  it('ngày trùng đúng biên của mốc vẫn tính là nằm trong', () => {
    expect(isDateOutsideAllConfigs('2025-09-05', configs)).toBe(false);
    expect(isDateOutsideAllConfigs('2026-01-11', configs)).toBe(false);
  });

  it('ngày sau khi năm học kết thúc thì cảnh báo — chính là lỗi đã gặp', () => {
    expect(isDateOutsideAllConfigs('2026-08-24', configs)).toBe(true);
  });

  it('ngày trước khi năm học bắt đầu thì cảnh báo', () => {
    expect(isDateOutsideAllConfigs('2025-08-30', configs)).toBe(true);
  });

  it('chưa cấu hình mốc nào thì không cảnh báo cho phiền', () => {
    expect(isDateOutsideAllConfigs('2026-08-24', [])).toBe(false);
  });

  it('ngày rỗng thì không cảnh báo', () => {
    expect(isDateOutsideAllConfigs('', configs)).toBe(false);
  });
});
