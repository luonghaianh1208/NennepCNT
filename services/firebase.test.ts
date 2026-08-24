import { describe, it, expect } from 'vitest';
import { sanitize } from './firebase';

/**
 * Hai lỗi thật gặp khi chuyển từ Apps Script sang Firestore, nay được chặn ở
 * tầng ghi dữ liệu — có test để lần sau sửa code không vô tình mở lại.
 */
describe('sanitize — dọn bản ghi trước khi ghi xuống Firestore', () => {
  it('bỏ field undefined (vi phạm tập thể không có studentId)', () => {
    const out = sanitize({ id: 'V1', classId: '10A1', studentId: undefined, points: 10 });
    expect('studentId' in out).toBe(false);
    expect(out.classId).toBe('10A1');
  });

  it('bỏ field undefined của học sinh không có số xe', () => {
    const out = sanitize({ id: 'S1', name: 'Nguyễn Văn A', bikeNumber: undefined });
    expect('bikeNumber' in out).toBe(false);
  });

  it('chuẩn hoá ngày người dùng gõ tay trong Excel', () => {
    expect(sanitize({ date: '20/05/2026' }).date).toBe('2026-05-20');
    expect(sanitize({ date: new Date(2026, 4, 20) }).date).toBe('2026-05-20');
  });

  it('giữ nguyên ngày đã đúng chuẩn và các field khác', () => {
    const out = sanitize({ date: '2026-05-20', points: -30, note: '', images: [], isSecurityReport: false });
    expect(out.date).toBe('2026-05-20');
    expect(out.points).toBe(-30);
    expect(out.note).toBe('');
    expect(out.images).toEqual([]);
    expect(out.isSecurityReport).toBe(false);
  });

  it('giữ giá trị null và chuỗi rỗng — chỉ undefined mới bị loại', () => {
    const out = sanitize({ a: null, b: '', c: 0 });
    expect(out).toEqual({ a: null, b: '', c: 0 });
  });
});
