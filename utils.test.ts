import { describe, it, expect } from 'vitest';
import { isDateOutsideAllConfigs } from './utils';
import { TimeConfig } from './types';

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
